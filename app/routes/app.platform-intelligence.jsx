import { useEffect, useMemo, useState } from 'react';
import { useFetcher, useLoaderData, useOutletContext } from 'react-router';
import { Activity, Boxes, Database, GitBranch, Search, Sparkles, Tag, WandSparkles } from 'lucide-react';
import PlatformQualityPanel from '../components/dashboard/platform/PlatformQualityPanel.jsx';
import { authenticate } from '../shopify.server';
import db from '../db.server.js';
import { canAccessBuilderAction, canAccessBuilderSystem } from '../utils/builder-permissions.server.js';
import { builderActor, getBuilderRole } from '../utils/builder-permissions.js';
import { DESIGN_TOKEN_GROUPS, DEFAULT_SEMANTIC_ALIASES, tokenGroupForKey } from '../builder/designTokens2.js';
import { loadPlatformIntelligence, savePlatformTokenSystem } from '../services/platform-intelligence.server.js';
import { captureVisualBaselines, evaluateExtensionManifest, loadPlatformP2, simulateReleaseMigrations } from '../services/platform-p2.server.js';
import { runBuilderCommand } from '../services/command-bus.server.js';
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

function human(value='') { return String(value).replace(/[-_.]+/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase()); }
function isColorKey(key='') { return /color|background/i.test(key); }

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderSystem(db, session, 'platformIntelligence')) || !(await canAccessBuilderAction(db,session,'platform','view'))) throw new Response('Platform Intelligence permission denied.', { status:403 });
  const [payload,p2] = await Promise.all([loadPlatformIntelligence(db, session.shop),loadPlatformP2(db,session.shop)]);
  return { ...payload, p2, permissions:{ manageTokens:await canAccessBuilderAction(db,session,'platform','manage_tokens'), runQa:await canAccessBuilderAction(db,session,'platform','run_qa'), manageExtensions:await canAccessBuilderAction(db,session,'platform','manage_extensions'), simulateMigrations:await canAccessBuilderAction(db,session,'platform','simulate_migrations') } };
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderSystem(db, session, 'platformIntelligence'))) return Response.json({ok:false,error:'Platform Intelligence permission denied.'},{status:403});
  const form = await request.formData();
  const intent = String(form.get('intent') || '');
  if (intent === 'save-token-system') {
    if (!(await canAccessBuilderAction(db,session,'platform','manage_tokens'))) return Response.json({ok:false,error:'Your VSN role cannot manage design tokens.'},{status:403});
    let document = {};
    try { document = JSON.parse(String(form.get('document') || '{}')); } catch { return Response.json({ok:false,error:'Invalid design token payload.'},{status:400}); }
    const command = await runBuilderCommand(db,{shop:session.shop,actor:builderActor(session),role:getBuilderRole(session),name:'design-tokens.save',input:{aliases:Object.keys(document.aliases||{}).length},execute:async(tx)=>({tokenSystem:await savePlatformTokenSystem(tx,session.shop,document)})});
    return Response.json({ok:true,message:'Design Tokens 2.0 saved.',tokenSystem:command.result.tokenSystem,commandId:command.commandId});
  }
  if (intent === 'capture-visual-baseline') {
    if (!(await canAccessBuilderAction(db,session,'platform','run_qa'))) return Response.json({ok:false,error:'Your VSN role cannot run platform QA.'},{status:403});
    const command=await runBuilderCommand(db,{shop:session.shop,actor:builderActor(session),role:getBuilderRole(session),name:'visual-baseline.capture',execute:async(tx)=>captureVisualBaselines(tx,session.shop)});
    return Response.json({ok:true,message:`Captured ${command.result.count} structural visual baselines.`,commandId:command.commandId});
  }
  if (intent === 'simulate-migrations') {
    if (!(await canAccessBuilderAction(db,session,'platform','simulate_migrations'))) return Response.json({ok:false,error:'Your VSN role cannot run migration simulations.'},{status:403});
    const migration=await simulateReleaseMigrations(db,session.shop);
    await db.builderAuditLog.create({data:{shop:session.shop,actor:builderActor(session),role:getBuilderRole(session),action:'migration.simulator.executed',details:JSON.stringify(migration.counts)}}).catch(()=>null);
    return Response.json({ok:migration.counts.fail===0,message:migration.counts.fail?'Migration simulator found failures.':'Migration dry-run passed.',migration},{status:migration.counts.fail?422:200});
  }
  if (intent === 'evaluate-plugin-manifest') {
    if (!(await canAccessBuilderAction(db,session,'platform','manage_extensions'))) return Response.json({ok:false,error:'Your VSN role cannot evaluate extension permissions.'},{status:403});
    let manifest={}; try{manifest=JSON.parse(String(form.get('manifest')||'{}'));}catch{return Response.json({ok:false,error:'Manifest must be valid JSON.'},{status:400});}
    const result=evaluateExtensionManifest(manifest);
    return Response.json({ok:result.ok,message:result.ok?'Extension manifest is compatible with the current sandbox policy.':undefined,error:result.ok?undefined:result.errors.join(' '),result},{status:result.ok?200:422});
  }
  return Response.json({ok:false,error:'Unsupported Platform Intelligence action.'},{status:400});
}

function Stat({label,value,icon:Icon,darkMode}) {
  return <div className={`rounded-xl border p-4 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><div className="flex items-center justify-between gap-3"><div><div className={`text-xs ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{label}</div><div className={`mt-1 text-2xl font-semibold ${darkMode?'text-white':'text-[#202223]'}`}>{value}</div></div><span className={`grid h-9 w-9 place-items-center rounded-lg ${darkMode?'bg-[#1f2937] text-[#95BF47]':'bg-[#f1f7e7] text-[#6AAB1F]'}`}><Icon size={18}/></span></div></div>;
}

function TokenInput({label,value,onChange,darkMode,color=false,disabled=false}) {
  return <label className="block"><span className={`mb-1 block text-[11px] font-medium ${darkMode?'text-[#cbd5e1]':'text-[#4b5563]'}`}>{label}</span><div className="flex items-center gap-2">{color?<input type="color" value={/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#000000'} disabled={disabled} onChange={(e)=>onChange(e.target.value)} className="h-9 w-11 rounded border border-[#d1d5db] bg-transparent p-1"/>:null}<input value={value ?? ''} disabled={disabled} onChange={(e)=>onChange(e.target.value)} className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-[#95BF47] ${darkMode?'border-[#374151] bg-[#0f172a] text-[#f8fafc]':'border-[#d1d5db] bg-white text-[#202223]'} disabled:opacity-50`}/></div></label>;
}

export default function PlatformIntelligence() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const { darkMode=false } = useOutletContext() || {};
  const [tab,setTab] = useState('dependencies');
  const [query,setQuery] = useState('');
  const [type,setType] = useState('all');
  const [tokenSystem,setTokenSystem] = useState(data.tokenSystem);
  useEffect(()=>{ if(fetcher.data?.tokenSystem) setTokenSystem(fetcher.data.tokenSystem); },[fetcher.data]);
  const graph = data.graph || {resources:[],types:{},stats:{}};
  const filtered = useMemo(()=>graph.resources.filter((row)=>{
    if(type!=='all'&&row.type!==type)return false;
    const q=query.trim().toLowerCase(); if(!q)return true;
    return `${row.label} ${row.type} ${(row.usedBy||[]).map((item)=>item.label).join(' ')}`.toLowerCase().includes(q);
  }),[graph.resources,type,query]);
  const tokenKeys = useMemo(()=>[...new Set([...Object.keys(tokenSystem.base||{}),...DESIGN_TOKEN_GROUPS.flatMap((group)=>group.keys)])].filter((key)=>tokenSystem.base?.[key]!==undefined),[tokenSystem.base]);
  const groupedTokens = useMemo(()=>{
    const map={}; for(const key of tokenKeys){const group=tokenGroupForKey(key);(map[group] ||= []).push(key);} return map;
  },[tokenKeys]);
  const patchBase=(key,value)=>setTokenSystem((current)=>({...current,base:{...current.base,[key]:value}}));
  const patchDark=(key,value)=>setTokenSystem((current)=>({...current,modes:{...(current.modes||{}),dark:{...(current.modes?.dark||{}),[key]:value}}}));
  const patchAlias=(alias,value)=>setTokenSystem((current)=>({...current,aliases:{...(current.aliases||{}),[alias]:value}}));
  const save=()=>fetcher.submit({intent:'save-token-system',document:JSON.stringify(tokenSystem)},{method:'post'});
  const bg=darkMode?'#0f1117':'#f6f6f7';
  return <div style={{minHeight:'100%',background:bg}} className={`px-5 py-5 ${darkMode?'text-[#f8fafc]':'text-[#202223]'}`}>
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles size={20} className="text-[#6AAB1F]"/><h1 className="text-2xl font-semibold">Platform Intelligence</h1></div><p className={`mt-1 text-sm ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>Dependency/usage graph, Design Tokens 2.0 and platform inspection tools.</p></div><div className="flex gap-2"><button onClick={()=>setTab('dependencies')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab==='dependencies'?'bg-[#95BF47] text-white':darkMode?'bg-[#1f2937]':'bg-white border border-[#d9d9d9]'}`}>Usage Graph</button><button onClick={()=>setTab('tokens')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab==='tokens'?'bg-[#95BF47] text-white':darkMode?'bg-[#1f2937]':'bg-white border border-[#d9d9d9]'}`}>Design Tokens 2.0</button><button onClick={()=>setTab('quality')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab==='quality'?'bg-[#95BF47] text-white':darkMode?'bg-[#1f2937]':'bg-white border border-[#d9d9d9]'}`}>Quality & Release</button></div></div>
      {fetcher.data?.message?<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{fetcher.data.message}</div>:null}{fetcher.data?.error?<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fetcher.data.error}</div>:null}
      {tab==='dependencies'?<>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Tracked resources" value={graph.stats.resources||0} icon={Boxes} darkMode={darkMode}/><Stat label="In use" value={graph.stats.used||0} icon={Activity} darkMode={darkMode}/><Stat label="Unused / unreferenced" value={graph.stats.unused||0} icon={Database} darkMode={darkMode}/><Stat label="Pages scanned" value={graph.stats.pages||0} icon={GitBranch} darkMode={darkMode}/><Stat label="Library items" value={graph.stats.library||0} icon={WandSparkles} darkMode={darkMode}/></div>
        <div className={`rounded-xl border p-3 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><div className="flex flex-wrap gap-2"><div className={`flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border px-3 ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search resources or usages…" className="w-full bg-transparent py-2 text-sm outline-none"/></div><select value={type} onChange={(e)=>setType(e.target.value)} className={`rounded-lg border px-3 py-2 text-xs ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}><option value="all">All resource types</option>{Object.keys(graph.types||{}).sort().map((key)=><option key={key} value={key}>{human(key)} · {graph.types[key]}</option>)}</select></div></div>
        <div className="grid gap-3 lg:grid-cols-2">{filtered.slice(0,240).map((row)=><div key={row.id} className={`rounded-xl border p-4 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><Tag size={14} className="text-[#6AAB1F]"/><strong className="truncate text-sm">{row.label}</strong></div><div className={`mt-1 text-[11px] ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{human(row.type)}{row.subtitle?` · ${row.subtitle}`:''}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.usageCount?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{row.usageCount} usage{row.usageCount===1?'':'s'}</span></div>{row.usedBy?.length?<div className="mt-3 flex flex-wrap gap-1.5">{row.usedBy.slice(0,12).map((item)=><span key={item.id} className={`rounded-md px-2 py-1 text-[10px] ${darkMode?'bg-[#1f2937] text-[#cbd5e1]':'bg-[#f6f6f7] text-[#4b5563]'}`}>{item.label} · {human(item.type)}</span>)}{row.usedBy.length>12?<span className="px-2 py-1 text-[10px]">+{row.usedBy.length-12} more</span>:null}</div>:<p className={`mt-3 text-xs ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>No current page/library reference detected. Review before deleting this resource.</p>}</div>)}{!filtered.length?<div className={`rounded-xl border p-8 text-center text-sm ${darkMode?'border-[#273142] bg-[#151b26] text-[#9ca3af]':'border-[#e3e3e3] bg-white text-[#6d7175]'}`}>No matching dependencies.</div>:null}</div>
      </>:tab==='quality'?<PlatformQualityPanel data={data.p2} darkMode={darkMode} fetcher={fetcher} permissions={data.permissions||{}}/>:<>
        <div className={`rounded-xl border p-4 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Token modes & semantic aliases</h2><p className={`mt-1 text-xs ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>Base tokens remain compatible with existing Global Design. Dark overrides and semantic aliases are stored in the same backward-compatible token document.</p></div><button disabled={!data.permissions?.manageTokens||fetcher.state!=='idle'} onClick={save} className="rounded-lg bg-[#008060] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{fetcher.state==='idle'?'Save token system':'Saving…'}</button></div></div>
        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><div className="space-y-4">{DESIGN_TOKEN_GROUPS.map((group)=>{const keys=groupedTokens[group.key]||[];if(!keys.length)return null;return <section key={group.key} className={`rounded-xl border p-4 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{group.label}</h3><span className={`text-[10px] ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{keys.length} tokens</span></div><div className="grid gap-3 md:grid-cols-2">{keys.map((key)=><div key={key} className={`rounded-lg border p-3 ${darkMode?'border-[#273142] bg-[#101722]':'border-[#eef0f2] bg-[#fafafa]'}`}><TokenInput label={`${human(key)} · Base`} value={tokenSystem.base?.[key]} onChange={(value)=>patchBase(key,value)} darkMode={darkMode} color={isColorKey(key)} disabled={!data.permissions?.manageTokens}/><div className="mt-2"><TokenInput label="Dark override" value={tokenSystem.modes?.dark?.[key] ?? ''} onChange={(value)=>patchDark(key,value)} darkMode={darkMode} color={isColorKey(key)} disabled={!data.permissions?.manageTokens}/></div></div>)}</div></section>})}</div><div className="space-y-4"><section className={`rounded-xl border p-4 ${darkMode?'border-[#273142] bg-[#151b26]':'border-[#e3e3e3] bg-white'}`}><h3 className="text-sm font-semibold">Semantic aliases</h3><p className={`mt-1 text-xs ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>Stable semantic names can point at existing implementation tokens.</p><div className="mt-3 max-h-[620px] space-y-2 overflow-auto">{Object.keys({...DEFAULT_SEMANTIC_ALIASES,...tokenSystem.aliases}).sort().map((alias)=><label key={alias} className="block"><span className={`mb-1 block text-[10px] font-mono ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{alias}</span><select disabled={!data.permissions?.manageTokens} value={tokenSystem.aliases?.[alias]||DEFAULT_SEMANTIC_ALIASES[alias]||''} onChange={(e)=>patchAlias(alias,e.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}>{tokenKeys.map((key)=><option key={key} value={key}>{human(key)}</option>)}</select></label>)}</div></section></div></div>
      </>}
    </div>
  </div>;
}
