import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { EMAIL_BINDING_GROUPS } from "../../email/emailBindings.js";
import { describeEmailLogic } from "../../email/emailLogic.js";
import { EMAIL_BLOCK_CATALOG } from "../../email/emailSchema.js";
import { VsnInput } from "../ui/VsnToolkit.jsx";
import { EmailAssetManager } from "./EmailAssetManager.jsx";
import { EmailSavedPane } from "./EmailSavedPane.jsx";
import { EmailCommerceBrowser } from "./EmailCommerceBrowser.jsx";
import { EmailVersionHistory } from "./EmailVersionHistory.jsx";
import { EmailAiAssistant } from "./EmailAiAssistant.jsx";

const human=(value)=>String(value||"").replaceAll("-"," ").replace(/\b\w/g,(c)=>c.toUpperCase());

function BlocksPane({onAdd}){
  const [query,setQuery]=useState("");
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();return q?EMAIL_BLOCK_CATALOG.filter(item=>`${item.label} ${item.description} ${item.group}`.toLowerCase().includes(q)):EMAIL_BLOCK_CATALOG},[query]);
  const groups=[...new Set(EMAIL_BLOCK_CATALOG.map(item=>item.group))];
  return <div className="vsn-email-studio-side-scroll"><div className="vsn-email-studio-search"><Search size={14}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search blocks"/></div>{groups.map(group=>{const items=rows.filter(item=>item.group===group);if(!items.length)return null;return <section key={group} className="vsn-email-palette-group"><b>{group}</b><div className="vsn-email-block-grid">{items.map(item=><button key={item.type} type="button" draggable onDragStart={(e)=>e.dataTransfer.setData("vsn/email-block-type",item.type)} onClick={()=>onAdd(item.type)}><span className="vsn-email-block-plus"><Plus size={12}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div></section>})}</div>;
}

function LayersPane({blocks,selectedId,onSelect,onMove,onDuplicate,onRemove}){
  return <div className="vsn-email-studio-side-scroll"><div className="vsn-email-layers-list">{blocks.map((block,index)=>{const logic=describeEmailLogic(block);return <article key={block.id} className={selectedId===block.id?"is-selected":""} onClick={()=>onSelect(block.id)} draggable onDragStart={(e)=>e.dataTransfer.setData("vsn/email-block-id",block.id)}><GripVertical size={13}/><span><strong>{human(block.type)}</strong><small>{logic.length?logic.join(" · "):`Block ${index+1}`}</small></span><div><button type="button" title="Move up" onClick={(e)=>{e.stopPropagation();onMove(block.id,-1)}} disabled={index===0}><ChevronUp size={12}/></button><button type="button" title="Move down" onClick={(e)=>{e.stopPropagation();onMove(block.id,1)}} disabled={index===blocks.length-1}><ChevronDown size={12}/></button><button type="button" title="Duplicate" onClick={(e)=>{e.stopPropagation();onDuplicate(block.id)}}><Copy size={12}/></button><button type="button" className="danger" title="Delete" onClick={(e)=>{e.stopPropagation();onRemove(block.id)}}><Trash2 size={12}/></button></div></article>})}{!blocks.length?<div className="vsn-email-studio-empty">No blocks yet. Add one from Blocks.</div>:null}</div></div>;
}

function DataPane({bindings,onCopyToken}){
  const [query,setQuery]=useState("");const q=query.trim().toLowerCase();
  const groups=EMAIL_BINDING_GROUPS.map(group=>({...group,tokens:group.tokens.filter(([path,label])=>!q||`${path} ${label}`.toLowerCase().includes(q))})).filter(group=>group.tokens.length);
  const lookup=(path)=>path.split(".").reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,bindings);
  return <div className="vsn-email-studio-side-scroll"><div className="vsn-email-studio-search"><Search size={14}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search dynamic data"/></div>{groups.map(group=><section className="vsn-email-data-group" key={group.key}><b>{group.label}</b>{group.tokens.map(([path,label])=><button key={path} type="button" onClick={()=>onCopyToken(`{{ ${path} }}`)}><span><strong>{label}</strong><code>{`{{ ${path} }}`}</code></span><small>{group.key==="loop"?"Available inside repeated blocks":String(lookup(path)??"Sample unavailable")}</small></button>)}</section>)}</div>;
}

function SettingsPane({meta,setMeta}){
  return <div className="vsn-email-studio-side-scroll"><div className="vsn-email-side-form"><VsnInput label="Template name" value={meta.name} onChange={(e)=>setMeta(v=>({...v,name:e.target.value}))}/><VsnInput label="Category" value={meta.category} onChange={(e)=>setMeta(v=>({...v,category:e.target.value}))}/><VsnInput label="Subject" value={meta.subject} onChange={(e)=>setMeta(v=>({...v,subject:e.target.value}))}/><label className="vsn-tool-field"><span>Preheader</span><textarea rows={4} value={meta.preheader||""} onChange={(e)=>setMeta(v=>({...v,preheader:e.target.value}))}/></label><label className="vsn-tool-field"><span>Status</span><select value={meta.status||"draft"} onChange={(e)=>setMeta(v=>({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="ready">Ready</option></select></label></div></div>;
}

export function EmailStudioSidebar({active,setActive,document,onDocumentChange,meta,setMeta,bindings,selected,selectedId,onSelect,onAdd,onMove,onDuplicate,onRemove,onCopyToken,onUseAsset,selectedCanUseAsset,savedBlocks=[],commerceCatalog={},aiStatus={},versions=[],onCreateSymbol,onInsertSymbol,onDetachSymbol,onDeleteSymbol,onSaveBlock,onInsertSavedBlock,onDeleteSavedBlock,onUseProduct,onUseCollection,onRestoreVersion,onReplaceAiEmail,onInsertAiBlocks,onApplyAiMeta,busy=false}){
  const tabs=[["blocks","Blocks"],["layers","Layers"],["saved","Saved"],["assets","Assets"],["data","Data"],["commerce","Commerce"],["ai","AI"],["history","History"],["settings","Setup"]];
  let pane=null;if(active==="blocks")pane=<BlocksPane onAdd={onAdd}/>;else if(active==="layers")pane=<LayersPane blocks={document.blocks} selectedId={selectedId} onSelect={onSelect} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove}/>;else if(active==="saved")pane=<EmailSavedPane document={document} selected={selected} savedBlocks={savedBlocks} onCreateSymbol={onCreateSymbol} onInsertSymbol={onInsertSymbol} onDetachSymbol={onDetachSymbol} onDeleteSymbol={onDeleteSymbol} onSaveBlock={onSaveBlock} onInsertSavedBlock={onInsertSavedBlock} onDeleteSavedBlock={onDeleteSavedBlock} busy={busy}/>;else if(active==="assets")pane=<EmailAssetManager assets={document.assets||[]} onAssetsChange={(assets)=>onDocumentChange({...document,assets})} onUseAsset={onUseAsset} selectedCanUseAsset={selectedCanUseAsset}/>;else if(active==="data")pane=<DataPane bindings={bindings} onCopyToken={onCopyToken}/>;else if(active==="commerce")pane=<EmailCommerceBrowser catalog={commerceCatalog} onUseProduct={onUseProduct} onUseCollection={onUseCollection}/>;else if(active==="ai")pane=<EmailAiAssistant document={document} meta={meta} aiStatus={aiStatus} onReplaceEmail={onReplaceAiEmail} onInsertBlocks={onInsertAiBlocks} onApplyMeta={onApplyAiMeta}/>;else if(active==="history")pane=<EmailVersionHistory versions={versions} onRestore={onRestoreVersion}/>;else pane=<SettingsPane meta={meta} setMeta={setMeta}/>;
  return <aside className="vsn-email-palette vsn-email-studio-sidebar"><div className="vsn-email-studio-side-tabs">{tabs.map(([key,label])=><button type="button" key={key} className={active===key?"active":""} onClick={()=>setActive(key)}>{label}</button>)}</div>{pane}</aside>;
}
