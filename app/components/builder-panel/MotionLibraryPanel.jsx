import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Copy, Pencil, Play, Plus, Star } from "lucide-react";
import { VsnButton, VsnCard, VsnEmpty, VsnInput, VsnModal, VsnPage, VsnSearchInput, VsnSelect, VsnTabs, VsnTextarea } from "../ui/VsnToolkit.jsx";
import PanelNotice from "./PanelNotice.jsx";
import MotionAdvancedEditor from "./MotionAdvancedEditor.jsx";
import { humanLabel } from "../../utils/display-format.js";

function frameStyle(frame={}) {
  const x=Number(frame.x||0),y=Number(frame.y||0),scale=Number(frame.scale??1),rotate=Number(frame.rotate||0);
  const out={transform:`translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${rotate}deg)`};
  if(frame.opacity!==null&&frame.opacity!==undefined)out.opacity=String(frame.opacity);
  if(frame.filter)out.filter=String(frame.filter);
  return out;
}
function previewFrames(action={}) {
  return [
    {...frameStyle(action.from||{}),offset:0},
    ...(Array.isArray(action.keyframes)?action.keyframes:[]).map(item=>({...frameStyle(item.frame||{}),offset:Math.max(.01,Math.min(.99,Number(item.offset||.5)))})),
    {...frameStyle(action.to||{}),offset:1},
  ];
}

function compactFrameToObject(values = []) { return { opacity:values[0]??null, x:Number(values[1]||0), y:Number(values[2]||0), scale:Number(values[3]??1), rotate:Number(values[4]||0), filter:String(values[5]||"") }; }
function previewTimelineFor(item = {}) {
  if (item.timeline) return item.timeline;
  const preview=item.preview||{};
  return { trigger:{type:preview.r||"click"}, timeline:{duration:Number(preview.d||400),easing:preview.e||"ease"}, actions:[{type:"animate",from:compactFrameToObject(preview.f),to:compactFrameToObject(preview.t),keyframes:(preview.k||[]).map((row,index)=>({id:`preview-${index}`,offset:Number(row[0]||.5),frame:compactFrameToObject(row.slice(1))}))}] };
}

function MotionPreview({timeline}) {
  const ref=useRef(null);
  const animationRef=useRef(null);
  const action=timeline?.actions?.find((item)=>item.type==="animate")||{};
  const duration=Math.max(120,Math.min(3000,Number(action.duration??timeline?.timeline?.duration??400)||400));
  const easing=action.easing&&action.easing!=="inherit"?action.easing:(timeline?.timeline?.easing||"ease");
  const run=()=>{
    const node=ref.current;if(!node)return;
    animationRef.current?.cancel?.();
    const frames=previewFrames(action);
    Object.assign(node.style,frames[0]||{});
    if(typeof node.animate==="function")animationRef.current=node.animate(frames,{duration,easing,fill:"both"});
    else Object.assign(node.style,frames[frames.length-1]||{});
  };
  useEffect(()=>{run();return()=>animationRef.current?.cancel?.();},[timeline]);
  return <div className="vsn-motion-preview"><div className="vsn-motion-preview-stage"><div ref={ref} className="vsn-motion-preview-object"><span>VSN</span></div></div><VsnButton size="xs" icon={<Play size={13}/>} onClick={run}>Preview</VsnButton></div>;
}

function MotionLibraryPanel({data,actionData,submit,busy=false,confirmAction}) {
  const [query,setQuery]=useState("");
  const [tab,setTab]=useState("library");
  const [category,setCategory]=useState("all");
  const [visible,setVisible]=useState(72);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(null);
  const [pendingBuiltin,setPendingBuiltin]=useState(null);
  const detailFetcher=useFetcher();
  const deferredQuery=useDeferredValue(query);
  const all=useMemo(()=>tab==="trash"?(data.trash||[]):[...(data.builtins||[]),...(data.presets||[])],[tab,data]);
  const categories=useMemo(()=>Array.from(new Set(all.map(item=>String(item.category||"custom")))).sort((a,b)=>a.localeCompare(b)),[all]);
  const rows=useMemo(()=>{const needle=deferredQuery.trim().toLowerCase();return all.filter((item)=>{
    if(category!=="all"&&String(item.category||"custom")!==category)return false;
    return !needle||`${item.name} ${item.description||""} ${item.category||""} ${item.source||""}`.toLowerCase().includes(needle);
  });},[all,deferredQuery,category]);
  useEffect(()=>setVisible(72),[query,category,tab]);
  const shown=rows.slice(0,visible);
  const showEditor=(item=null,timeline=null)=>{const resolved=timeline||item?.timeline||{name:"Custom Motion",enabled:true,trigger:{type:"viewport-enter",once:true,threshold:.15,eventName:"",selector:""},conditions:[],timeline:{duration:500,delay:0,easing:"ease-out",stagger:0,repeat:0,yoyo:false,reducedMotion:"instant"},actions:[{type:"animate",target:{mode:"self",selector:"",slot:""},from:{opacity:0,x:0,y:24,scale:1,rotate:0,filter:""},to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""},delay:0,duration:null,easing:"inherit",keyframes:[]} ]};setEditing(item);setForm({name:item?.builtin?`${item.name} Copy`:(item?.name||"Custom Motion"),description:item?.description||"",category:item?.category||"custom",scope:item?.scope||"global",timeline:JSON.parse(JSON.stringify(resolved))});};
  const openEditor=(item=null)=>{if(item?.builtin&&!item.timeline){setPendingBuiltin(item);detailFetcher.load(`/app/motion-library?builtinId=${encodeURIComponent(item.id)}`);return;}showEditor(item,item?.timeline);};
  useEffect(()=>{if(!pendingBuiltin||detailFetcher.state!=="idle")return;const builtin=detailFetcher.data?.builtin;if(builtin?.timeline){showEditor(pendingBuiltin,builtin.timeline);setPendingBuiltin(null);}else if(detailFetcher.data?.error){setPendingBuiltin(null);}},[detailFetcher.state,detailFetcher.data,pendingBuiltin]);
  const save=()=>{if(!form)return;submit({intent:editing&&!editing.builtin?"update":"create",id:editing?.builtin?"":editing?.id||"",name:form.name,description:form.description,category:form.category,scope:form.scope,timeline:JSON.stringify(form.timeline)});setEditing(null);setForm(null);};
  return <VsnPage title="Motion Library" subtitle="1,300+ deduplicated reusable motion presets plus your own advanced timelines. Search, preview, customize and reuse them across the editor." actions={<VsnButton variant="primary" icon={<Plus size={14}/>} onClick={()=>openEditor()}>Create animation</VsnButton>}>
    <PanelNotice data={actionData}/>
    <div className="vsn-system-stat-grid"><div><span>Built-in presets</span><strong>{data.counts?.builtins||0}</strong></div><div><span>Reference libraries</span><strong>{data.counts?.referenceLibraries||0}</strong></div><div><span>Reference effects</span><strong>{data.counts?.referenceAdded||0}</strong></div><div><span>Animate.css</span><strong>{data.counts?.animateCss||0}</strong></div><div><span>VSN modern</span><strong>{data.counts?.generated||0}</strong></div><div><span>Duplicates removed</span><strong>{data.counts?.duplicateBuiltins||0}</strong></div><div><span>Custom animations</span><strong>{data.counts?.custom||0}</strong></div></div>
    <VsnCard><div className="vsn-motion-filter-row"><VsnSearchInput label="Search animations" hideLabel value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search motion, elastic, robust, fade…"/><VsnSelect label="Category" hideLabel value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</VsnSelect><VsnTabs items={[{value:"library",label:"Motion Library",count:data.counts?.total||0},{value:"trash",label:"Trash",count:data.counts?.trash||0}]} value={tab} onChange={setTab}/></div></VsnCard>
    <div className="vsn-motion-result-meta"><span>Showing {Math.min(shown.length,rows.length)} of {rows.length}</span>{query||category!=="all"?<button type="button" onClick={()=>{setQuery("");setCategory("all");}}>Clear filters</button>:null}</div>
    <div className="vsn-motion-grid">{shown.map(item=><VsnCard key={item.id} className="vsn-motion-card"><div className="vsn-motion-card-head"><div><h3>{item.name}</h3><p>{humanLabel(item.category)} · {humanLabel(item.scope)}{item.tokens?.sourceLibrary?` · ${item.tokens.sourceLibrary}`:item.source==="animate.css"?" · Animate.css":item.builtin?" · VSN preset":""}</p></div>{item.isFavorite?<Star size={15} fill="currentColor"/>:null}</div><MotionPreview timeline={previewTimelineFor(item)}/><p className="vsn-help-text">{item.description||"Reusable VSN motion timeline."}</p><div className="vsn-motion-meta"><span>{humanLabel(item.timeline?.trigger?.type||item.preview?.r||"click")}</span><span>{item.timeline?.timeline?.duration||item.preview?.d||400}ms</span><span>{item.timeline?.actions?.[0]?.keyframes?.length??item.preview?.kc??0} keyframes</span></div><div className="vsn-row-actions">{tab==="trash"?<><VsnButton size="xs" onClick={()=>submit({intent:"restore",id:item.id})}>Restore</VsnButton><VsnButton size="xs" variant="danger" onClick={async()=>{const ok=await confirmAction({title:"Delete animation permanently?",message:`${item.name} will be permanently deleted. This cannot be undone.`,confirmLabel:"Delete permanently",tone:"danger"});if(ok)submit({intent:"hard-delete",id:item.id});}}>Delete forever</VsnButton></>:<>{item.builtin?<VsnButton size="xs" loading={detailFetcher.state!=="idle"&&pendingBuiltin?.id===item.id} onClick={()=>openEditor(item)}>Customize copy</VsnButton>:<><VsnButton size="xs" icon={<Pencil size={13}/>} onClick={()=>openEditor(item)}>Edit</VsnButton><VsnButton size="xs" icon={<Copy size={13}/>} onClick={()=>submit({intent:"duplicate",id:item.id})}>Duplicate</VsnButton><VsnButton size="xs" onClick={()=>submit({intent:"favorite",id:item.id,favorite:String(!item.isFavorite)})}>{item.isFavorite?"Unfavorite":"Favorite"}</VsnButton><VsnButton size="xs" variant="danger" onClick={()=>submit({intent:"trash",id:item.id})}>Trash</VsnButton></>}</>}</div></VsnCard>)}{!rows.length?<VsnEmpty title={tab==="trash"?"Motion Trash is empty":"No animations found"} description={tab==="trash"?"Trashed custom animations appear here.":"Change your search/category or create a reusable animation."}/>:null}</div>
    {shown.length<rows.length?<div className="vsn-motion-load-more"><VsnButton onClick={()=>setVisible(v=>v+72)}>Load 72 more</VsnButton></div>:null}
    <VsnModal open={Boolean(form)} title={editing&&!editing.builtin?"Edit animation":"Create reusable animation"} subtitle="Advanced VSN timeline editor with live preview, actions and keyframes." onClose={()=>{setEditing(null);setForm(null);}} size="xl" footer={<><VsnButton onClick={()=>{setEditing(null);setForm(null);}}>Cancel</VsnButton><VsnButton variant="primary" loading={busy} onClick={save}>Save animation</VsnButton></>}>
      {form?<MotionAdvancedEditor form={form} setForm={setForm}/>:null}
    </VsnModal>
  </VsnPage>;
}
export { MotionLibraryPanel };
