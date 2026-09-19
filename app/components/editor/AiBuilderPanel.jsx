import { useEffect, useMemo, useRef, useState } from "react";
import { ModalPortal } from "./OverlayManager";
import { VsnButton, VsnSelect, VsnOption, VsnTextArea, VsnTextField, VsnSpinner } from "./EditorUi";
import PolarisIcon from "../ui/PolarisIcon";
import LibraryDesignPreview from "./LibraryDesignPreview";

const MODES=[
  ["agent","Agent · Multi-step Edit"],
  ["section","Prompt → Section"],["page","Prompt → Full Page"],["screenshot","Screenshot/Image → Layout"],["url","URL → Inspiration Layout"],
  ["rewrite","Rewrite Selected Copy"],["responsive","Responsive Repair"],["accessibility","Accessibility Suggestions"],["alternatives","Layout Alternative"],
];
const MAX_AGENT_CONVERSATION=8;

async function readJsonResponse(response){
  const payload=await response.json().catch(()=>({}));
  if(response.ok)return payload;
  return {ok:false,code:payload?.code||"AI_AGENT_FAILED",error:payload?.error||`AI Agent request failed (${response.status}).`};
}

export default function AiBuilderPanel({
  open,onClose,fetcher,page,elements,globalStyles,selectedElement,selectedIds=[],breakpoint="desktop",commerceContext,onApply,
  hasUnsavedChanges=false,onAgentResult,
}){
  const [operation,setOperation]=useState("section");
  const [prompt,setPrompt]=useState("");
  const [sourceUrl,setSourceUrl]=useState("");
  const [imageData,setImageData]=useState("");
  const fileRef=useRef(null);
  const [result,setResult]=useState(null);
  const [agentResult,setAgentResult]=useState(null);
  const [agentBusy,setAgentBusy]=useState(false);
  const [agentConversation,setAgentConversation]=useState([]);
  const [agentCheckpoint,setAgentCheckpoint]=useState("");
  const lastDataRef=useRef(null);

  useEffect(()=>{
    if(open&&selectedElement&&["heading","text","button","product-title","product-description","collection-title","collection-description"].includes(selectedElement.type)){
      setOperation((current)=>["rewrite","agent"].includes(current)?current:"section");
    }
  },[open,selectedElement]);
  useEffect(()=>{if(!open){setResult(null);setAgentResult(null);}},[open]);
  useEffect(()=>{
    if(fetcher.data&&fetcher.data!==lastDataRef.current){
      lastDataRef.current=fetcher.data;
      setResult(fetcher.data);
    }
  },[fetcher.data]);

  const isAgent=operation==="agent";
  const data=isAgent?agentResult:result;
  const busy=isAgent?agentBusy:fetcher.state!=="idle";
  const canGenerate=isAgent
    ? prompt.trim().length>2&&!hasUnsavedChanges
    : operation==="accessibility"||operation==="responsive"||operation==="alternatives"||operation==="rewrite"||prompt.trim().length>2||operation==="screenshot"&&imageData||operation==="url"&&sourceUrl;
  const previewNodes=Array.isArray(data?.nodes)?data.nodes:[];
  const issues=useMemo(()=>[
    ...(data?.accessibility||[]).map(x=>({...x,kind:"Accessibility"})),
    ...(data?.responsive||[]).map(x=>({...x,kind:"Responsive"})),
    ...(data?.plan?.suggestions||[]).map(x=>({severity:"info",kind:x.kind||"AI",message:x.message})),
  ],[data]);

  const runAgent=async()=>{
    if(agentBusy||hasUnsavedChanges||prompt.trim().length<3)return;
    const userText=prompt.trim();
    setAgentBusy(true);setAgentResult(null);
    try{
      const response=await fetch("/app/ai-agent",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({
          pageId:page?.id||"",
          prompt:userText,
          breakpoint,
          selectedIds:Array.isArray(selectedIds)?selectedIds:[],
          conversation:agentConversation,
        }),
      });
      const payload=await readJsonResponse(response);
      setAgentResult(payload);
      const assistantText=String(payload?.message||payload?.error||"Agent turn completed.");
      setAgentConversation((current)=>[
        ...current,
        {role:"user",text:userText},
        {role:"assistant",text:assistantText},
      ].slice(-MAX_AGENT_CONVERSATION));
      if(payload?.checkpointRevisionId)setAgentCheckpoint(payload.checkpointRevisionId);
      if(Array.isArray(payload?.page?.content))onAgentResult?.(payload);
      if(response.ok)setPrompt("");
    }catch(error){
      setAgentResult({ok:false,error:error instanceof Error?error.message:"AI Agent request failed."});
    }finally{setAgentBusy(false);}
  };

  const revertAgentTurn=async()=>{
    if(!agentCheckpoint||agentBusy)return;
    setAgentBusy(true);
    try{
      const response=await fetch("/app/ai-agent",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({intent:"revert",pageId:page?.id||"",revisionId:agentCheckpoint}),
      });
      const payload=await readJsonResponse(response);
      setAgentResult(payload);
      if(response.ok&&Array.isArray(payload?.page?.content)){
        onAgentResult?.(payload);
        setAgentConversation((current)=>[
          ...current,
          {role:"assistant",text:"Reverted the last Agent turn to its checkpoint."},
        ].slice(-MAX_AGENT_CONVERSATION));
        setAgentCheckpoint("");
      }
    }catch(error){
      setAgentResult({ok:false,error:error instanceof Error?error.message:"Agent checkpoint restore failed."});
    }finally{setAgentBusy(false);}
  };

  const generate=()=>{
    if(isAgent){void runAgent();return;}
    setResult(null);
    const fd=new FormData();
    fd.set("operation",operation);fd.set("prompt",prompt);fd.set("sourceUrl",sourceUrl);fd.set("imageData",imageData);
    fd.set("pageId",page?.id||"");fd.set("pageTemplate",page?.template||"page");fd.set("currentPage",JSON.stringify(elements||[]));
    fd.set("globalStyles",JSON.stringify(globalStyles||{}));fd.set("commerceContext",JSON.stringify(commerceContext||{}));
    if(selectedElement)fd.set("selectedElementId",selectedElement.id);
    fetcher.submit(fd,{method:"post",action:"/app/ai"});
  };
  const readFile=(file)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){setImageData("");return;}
    if(file.size>8*1024*1024){setImageData("");window.alert("Reference image must be 8 MB or smaller.");return;}
    const reader=new FileReader();reader.onload=()=>setImageData(String(reader.result||""));reader.readAsDataURL(file);
  };

  if(!open)return null;
  return <ModalPortal><div className="vsn-editor-modal-backdrop vsn-ai-backdrop" onMouseDown={(e)=>{if(e.currentTarget===e.target&&!busy)onClose?.();}}><div className="vsn-ai-panel" onMouseDown={(e)=>e.stopPropagation()}>
    <header className="vsn-ai-header"><div><strong>{isAgent?"VSN Editor Agent":"VSN AI Builder"}</strong><span>{isAgent?"Bounded, reversible draft commands. Publish is never automatic.":"Structured AI output → existing editable VSN widgets only."}</span></div><VsnButton variant="icon" accessibilityLabel="Close AI Builder" data-tooltip="Close AI Builder" disabled={busy} onClick={onClose}><PolarisIcon type="x"/></VsnButton></header>
    <div className="vsn-ai-body">
      <aside className="vsn-ai-controls">
        <label className="vsn-ai-label">Task</label><VsnSelect label="AI task" labelAccessibilityVisibility="exclusive" value={operation} onChange={(e)=>setOperation(e.currentTarget.value)}>{MODES.map(([v,l])=><VsnOption key={v} value={v}>{l}</VsnOption>)}</VsnSelect>
        {operation!=="accessibility"&&operation!=="responsive"?<><label className="vsn-ai-label">{isAgent?"What should the Agent change?":"Prompt"}</label><VsnTextArea label="Prompt" labelAccessibilityVisibility="exclusive" rows={6} value={prompt} onInput={(e)=>setPrompt(e.currentTarget.value)} placeholder={isAgent?"Example: tighten this hero, move the CTA below the copy, and improve mobile spacing.":operation==="rewrite"?"Rewrite this copy to be clearer and more conversion-focused.":"Describe the layout, content, audience and objective..."}/></>:null}
        {operation==="url"?<><label className="vsn-ai-label">Public inspiration URL</label><VsnTextField label="Public inspiration URL" labelAccessibilityVisibility="exclusive" value={sourceUrl} onInput={(e)=>setSourceUrl(e.currentTarget.value)} placeholder="https://example.com/page"/><p className="vsn-ai-help">VSN extracts limited public text for structure inspiration; it does not copy source HTML/CSS.</p></>:null}
        {operation==="screenshot"?<><label className="vsn-ai-label">Reference image</label><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e)=>readFile(e.currentTarget.files?.[0])} className="vsn-ai-file"/>{imageData?<img className="vsn-ai-thumb" src={imageData} alt="AI reference preview"/>:null}</>:null}
        {operation==="rewrite"?<div className="vsn-ai-context"><b>Selected:</b> {selectedElement?.label||selectedElement?.type||"No supported text element selected"}</div>:null}
        {isAgent?<>
          <div className="vsn-ai-context"><b>Context:</b> current saved page, {selectedIds.length||0} selected node(s), {breakpoint} breakpoint, recent revisions/commands and quality findings.</div>
          {hasUnsavedChanges?<div className="vsn-ai-error">Save current editor changes before running the Agent. Server-authoritative commands never overwrite an unsaved local draft.</div>:null}
          <div className="vsn-ai-context"><b>Safety:</b> maximum 6 registered draft commands per turn. No publish, billing, permission, send or schedule action.</div>
        </>:<div className="vsn-ai-context"><b>Brand context:</b> current Global Styles / Brand tokens are sent with the request.</div>}
        <VsnButton variant="primary" disabled={!canGenerate||busy||(operation==="rewrite"&&!selectedElement)} loading={busy||undefined} onClick={generate}><PolarisIcon type="sparkles"/>{isAgent?"Run Agent":"Generate"}</VsnButton>
        {isAgent&&agentCheckpoint?<VsnButton disabled={busy} onClick={()=>void revertAgentTurn()}><PolarisIcon type="undo"/>Undo last Agent turn</VsnButton>:null}
        {data?.usage?<div className="vsn-ai-quota">AI usage: <b>{data.usage.used}/{data.usage.quota}</b> this month · {data.usage.remaining} remaining</div>:null}
        {data?.error?<div className="vsn-ai-error">{data.error}</div>:null}
      </aside>
      <main className="vsn-ai-result">
        {busy?<div className="vsn-ai-loading"><VsnSpinner accessibilityLabel={isAgent?"Running editor Agent":"Generating AI design"}/><strong>{isAgent?"Planning and applying reversible draft edits…":"Generating structured VSN design…"}</strong><span>{isAgent?"Each mutation is version-checked and revision-backed.":"No editor changes are applied until you choose Apply."}</span></div>:null}
        {!busy&&isAgent?<>
          {agentConversation.length?<div className="grid gap-2">{agentConversation.map((turn,index)=><div key={`${turn.role}-${index}`} className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm"><b>{turn.role==="assistant"?"Agent":"You"}</b><p className="mt-1 whitespace-pre-wrap text-[#555]">{turn.text}</p></div>)}</div>:null}
          {data?<div className="mt-4">
            <div className="vsn-ai-result-head"><div><strong>{data.status==="partial_failure"?"Agent stopped safely":data.status==="needs_input"?"Agent needs input":data.status==="no_change"?"No change needed":data.status==="reverted"?"Agent turn reverted":"Agent turn"}</strong><span>{data.message||data.error||"Review the result."}</span></div>{data.model?<small>{data.model}</small>:null}</div>
            {Array.isArray(data?.plan?.steps)&&data.plan.steps.length?<div className="vsn-ai-issues"><strong>Planned commands</strong>{data.plan.steps.map((step,index)=><div key={`${step.command}-${index}`} className="vsn-ai-issue is-info"><b>{step.command}</b><span>{step.summary}</span></div>)}</div>:null}
            {Array.isArray(data?.applied)&&data.applied.length?<div className="vsn-ai-good"><PolarisIcon type="check"/>{data.applied.length} reversible draft command{data.applied.length===1?"":"s"} applied · page v{data.page?.version||"?"}</div>:null}
            {data?.failure?<div className="vsn-ai-error">{data.failure.code}: {data.failure.message}</div>:null}
          </div>:<div className="vsn-ai-empty"><PolarisIcon type="sparkles" size={28}/><strong>Ask the Agent for a multi-step edit</strong><span>Conversation stays in this browser session; authoritative page context is rebuilt on the server every turn.</span></div>}
        </>:null}
        {!busy&&!isAgent&&data?.ok?<>
          <div className="vsn-ai-result-head"><div><strong>{data.plan?.title||"AI result"}</strong><span>{data.plan?.summary||"Review before applying."}</span></div>{data.usage?.model?<small>{data.usage.model}</small>:null}</div>
          {data.plan?.replacementText?<div className="vsn-ai-copy-preview"><span>Replacement copy</span><p>{data.plan.replacementText}</p></div>:null}
          {previewNodes.length?<div className="vsn-ai-design-preview"><LibraryDesignPreview content={previewNodes} title="AI generated VSN layout preview"/></div>:null}
          {issues.length?<div className="vsn-ai-issues"><strong>Post-generation checks</strong>{issues.slice(0,12).map((issue,i)=><div key={`${issue.kind}-${i}`} className={`vsn-ai-issue is-${issue.severity||"info"}`}><b>{issue.kind}</b><span>{issue.message}</span></div>)}</div>:<div className="vsn-ai-good"><PolarisIcon type="check"/>Responsive/accessibility quick checks found no obvious issues.</div>}
          <div className="vsn-ai-actions"><VsnButton onClick={()=>setResult(null)}>Discard</VsnButton>{operation!=="accessibility"?<VsnButton variant="primary" onClick={()=>onApply?.({operation,data})}><PolarisIcon type="check"/>Apply to editor</VsnButton>:null}</div>
        </>:null}
        {!busy&&!isAgent&&!data?.ok?<div className="vsn-ai-empty"><PolarisIcon type="sparkles" size={28}/><strong>Generate an editable VSN design</strong><span>AI output is validated against the current widget registry before it reaches the editor.</span></div>:null}
      </main>
    </div>
  </div></div></ModalPortal>;
}
