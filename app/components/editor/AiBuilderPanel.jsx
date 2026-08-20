import { useEffect, useMemo, useRef, useState } from "react";
import { ModalPortal } from "./OverlayManager";
import { VsnButton, VsnSelect, VsnOption, VsnTextArea, VsnTextField, VsnSpinner } from "./EditorUi";
import PolarisIcon from "../ui/PolarisIcon";
import LibraryDesignPreview from "./LibraryDesignPreview";

const MODES=[
  ["section","Prompt → Section"],["page","Prompt → Full Page"],["screenshot","Screenshot/Image → Layout"],["url","URL → Inspiration Layout"],
  ["rewrite","Rewrite Selected Copy"],["responsive","Responsive Repair"],["accessibility","Accessibility Suggestions"],["alternatives","Layout Alternative"],
];

export default function AiBuilderPanel({open,onClose,fetcher,page,elements,globalStyles,selectedElement,commerceContext,onApply}){
  const [operation,setOperation]=useState("section");const[prompt,setPrompt]=useState("");const[sourceUrl,setSourceUrl]=useState("");const[imageData,setImageData]=useState("");const fileRef=useRef(null);
  useEffect(()=>{if(open&&selectedElement&&["heading","text","button","product-title","product-description","collection-title","collection-description"].includes(selectedElement.type))setOperation((current)=>current==="rewrite"?current:"section");},[open,selectedElement]);
  const [result,setResult]=useState(null); const lastDataRef=useRef(null);
  useEffect(()=>{if(!open)setResult(null);},[open]);
  useEffect(()=>{if(fetcher.data&&fetcher.data!==lastDataRef.current){lastDataRef.current=fetcher.data;setResult(fetcher.data);}},[fetcher.data]);
  const data=result;const busy=fetcher.state!=="idle";
  const canGenerate=operation==="accessibility"||operation==="responsive"||operation==="alternatives"||operation==="rewrite"||prompt.trim().length>2||operation==="screenshot"&&imageData||operation==="url"&&sourceUrl;
  const previewNodes=Array.isArray(data?.nodes)?data.nodes:[];
  const issues=useMemo(()=>[...(data?.accessibility||[]).map(x=>({...x,kind:"Accessibility"})),...(data?.responsive||[]).map(x=>({...x,kind:"Responsive"})),...(data?.plan?.suggestions||[]).map(x=>({severity:"info",kind:x.kind||"AI",message:x.message}))],[data]);
  const generate=()=>{setResult(null);const fd=new FormData();fd.set("operation",operation);fd.set("prompt",prompt);fd.set("sourceUrl",sourceUrl);fd.set("imageData",imageData);fd.set("pageId",page?.id||"");fd.set("pageTemplate",page?.template||"page");fd.set("currentPage",JSON.stringify(elements||[]));fd.set("globalStyles",JSON.stringify(globalStyles||{}));fd.set("commerceContext",JSON.stringify(commerceContext||{}));if(selectedElement)fd.set("selectedElementId",selectedElement.id);fetcher.submit(fd,{method:"post",action:"/app/ai"});};
  const readFile=(file)=>{if(!file)return; if(!file.type.startsWith("image/")){setImageData("");return;} if(file.size>8*1024*1024){setImageData("");window.alert("Reference image must be 8 MB or smaller.");return;} const reader=new FileReader();reader.onload=()=>setImageData(String(reader.result||""));reader.readAsDataURL(file);};
  if(!open)return null;
  return <ModalPortal><div className="vsn-editor-modal-backdrop vsn-ai-backdrop" onMouseDown={(e)=>{if(e.currentTarget===e.target&&!busy)onClose?.();}}><div className="vsn-ai-panel" onMouseDown={(e)=>e.stopPropagation()}>
    <header className="vsn-ai-header"><div><strong>VSN AI Builder</strong><span>Structured AI output → existing editable VSN widgets only.</span></div><VsnButton variant="icon" accessibilityLabel="Close AI Builder" data-tooltip="Close AI Builder" disabled={busy} onClick={onClose}><PolarisIcon type="x"/></VsnButton></header>
    <div className="vsn-ai-body">
      <aside className="vsn-ai-controls">
        <label className="vsn-ai-label">Task</label><VsnSelect label="AI task" labelAccessibilityVisibility="exclusive" value={operation} onChange={(e)=>setOperation(e.currentTarget.value)}>{MODES.map(([v,l])=><VsnOption key={v} value={v}>{l}</VsnOption>)}</VsnSelect>
        {operation!=="accessibility"&&operation!=="responsive"?<><label className="vsn-ai-label">Prompt</label><VsnTextArea label="Prompt" labelAccessibilityVisibility="exclusive" rows={6} value={prompt} onInput={(e)=>setPrompt(e.currentTarget.value)} placeholder={operation==="rewrite"?"Rewrite this copy to be clearer and more conversion-focused.":"Describe the layout, content, audience and objective..."}/></>:null}
        {operation==="url"?<><label className="vsn-ai-label">Public inspiration URL</label><VsnTextField label="Public inspiration URL" labelAccessibilityVisibility="exclusive" value={sourceUrl} onInput={(e)=>setSourceUrl(e.currentTarget.value)} placeholder="https://example.com/page"/><p className="vsn-ai-help">VSN extracts limited public text for structure inspiration; it does not copy source HTML/CSS.</p></>:null}
        {operation==="screenshot"?<><label className="vsn-ai-label">Reference image</label><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e)=>readFile(e.currentTarget.files?.[0])} className="vsn-ai-file"/>{imageData?<img className="vsn-ai-thumb" src={imageData} alt="AI reference preview"/>:null}</>:null}
        {operation==="rewrite"?<div className="vsn-ai-context"><b>Selected:</b> {selectedElement?.label||selectedElement?.type||"No supported text element selected"}</div>:null}
        <div className="vsn-ai-context"><b>Brand context:</b> current Global Styles / Brand tokens are sent with the request.</div>
        <VsnButton variant="primary" disabled={!canGenerate||busy||(operation==="rewrite"&&!selectedElement)} loading={busy||undefined} onClick={generate}><PolarisIcon type="sparkles"/>Generate</VsnButton>
        {data?.usage?<div className="vsn-ai-quota">AI usage: <b>{data.usage.used}/{data.usage.quota}</b> this month · {data.usage.remaining} remaining</div>:null}
        {data?.error?<div className="vsn-ai-error">{data.error}</div>:null}
      </aside>
      <main className="vsn-ai-result">
        {busy?<div className="vsn-ai-loading"><VsnSpinner accessibilityLabel="Generating AI design"/><strong>Generating structured VSN design…</strong><span>No editor changes are applied until you choose Apply.</span></div>:null}
        {!busy&&data?.ok?<>
          <div className="vsn-ai-result-head"><div><strong>{data.plan?.title||"AI result"}</strong><span>{data.plan?.summary||"Review before applying."}</span></div>{data.usage?.model?<small>{data.usage.model}</small>:null}</div>
          {data.plan?.replacementText?<div className="vsn-ai-copy-preview"><span>Replacement copy</span><p>{data.plan.replacementText}</p></div>:null}
          {previewNodes.length?<div className="vsn-ai-design-preview"><LibraryDesignPreview content={previewNodes} title="AI generated VSN layout preview"/></div>:null}
          {issues.length?<div className="vsn-ai-issues"><strong>Post-generation checks</strong>{issues.slice(0,12).map((issue,i)=><div key={`${issue.kind}-${i}`} className={`vsn-ai-issue is-${issue.severity||"info"}`}><b>{issue.kind}</b><span>{issue.message}</span></div>)}</div>:<div className="vsn-ai-good"><PolarisIcon type="check"/>Responsive/accessibility quick checks found no obvious issues.</div>}
          <div className="vsn-ai-actions"><VsnButton onClick={()=>setResult(null)}>Discard</VsnButton>{operation!=="accessibility"?<VsnButton variant="primary" onClick={()=>onApply?.({operation,data})}><PolarisIcon type="check"/>Apply to editor</VsnButton>:null}</div>
        </>:null}
        {!busy&&!data?.ok?<div className="vsn-ai-empty"><PolarisIcon type="sparkles" size={28}/><strong>Generate an editable VSN design</strong><span>AI output is validated against the current widget registry before it reaches the editor.</span></div>:null}
      </main>
    </div>
  </div></div></ModalPortal>;
}
