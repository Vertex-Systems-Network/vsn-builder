import { paidMutationDenied } from "../services/paid-mutation-guard.server.js";
import { useEffect, useMemo, useState } from 'react';
import { useFetcher, useLoaderData, useOutletContext } from 'react-router';
import { Activity, Boxes, Database, GitBranch, Search, Tag, WandSparkles } from 'lucide-react';
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
import SearchableSelect from "../components/ui/SearchableSelect.jsx";

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
  const paidDenial=await paidMutationDenied(db,session.shop);if(paidDenial)return paidDenial;
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

function Stat({label,value,icon:Icon}) {
  return <s-section padding="base"><s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base"><s-stack direction="block" gap="small-100"><s-text color="subdued">{label}</s-text><s-heading>{value}</s-heading></s-stack><Icon size={18} aria-hidden="true"/></s-stack></s-section>;
}

function TokenInput({label,value,onChange,darkMode,color=false,disabled=false}) {
  return <label className="block"><span className={`mb-1 block text-[11px] font-medium ${darkMode?'text-[#cbd5e1]':'text-[#4b5563]'}`}>{label}</span><div className="flex items-center gap-2">{color?<input type="color" value={/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#000000'} disabled={disabled} onChange={(e)=>onChange(e.target.value)} className="h-9 w-11 rounded border border-[#d1d5db] bg-transparent p-1"/>:null}<input value={value ?? ''} disabled={disabled} onChange={(e)=>onChange(e.target.value)} className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-[#625BA8] ${darkMode?'border-[#374151] bg-[#0f172a] text-[#f8fafc]':'border-[#d1d5db] bg-white text-[#202223]'} disabled:opacity-50`}/></div></label>;
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
  const tabButton=(key,label)=><s-button variant={tab===key?'primary':'secondary'} onClick={()=>setTab(key)}>{label}</s-button>;
  return <s-page heading="Platform Intelligence">
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base"><s-paragraph color="subdued">Dependency/usage graph, Design Tokens 2.0 and platform inspection tools.</s-paragraph><s-stack direction="inline" gap="small-200">{tabButton('dependencies','Usage Graph')}{tabButton('tokens','Design Tokens 2.0')}{tabButton('quality','Quality & Release')}</s-stack></s-stack>
      {fetcher.data?.message?<s-banner tone="success">{fetcher.data.message}</s-banner>:null}{fetcher.data?.error?<s-banner tone="critical">{fetcher.data.error}</s-banner>:null}
      {tab==='dependencies'?<>
        <s-grid gridTemplateColumns="@container (inline-size > 1100px) repeat(5, 1fr), @container (inline-size > 600px) 1fr 1fr, 1fr" gap="base"><Stat label="Tracked resources" value={graph.stats.resources||0} icon={Boxes}/><Stat label="In use" value={graph.stats.used||0} icon={Activity}/><Stat label="Unused / unreferenced" value={graph.stats.unused||0} icon={Database}/><Stat label="Pages scanned" value={graph.stats.pages||0} icon={GitBranch}/><Stat label="Library items" value={graph.stats.library||0} icon={WandSparkles}/></s-grid>
        <s-section><div className="flex flex-wrap gap-2"><div className={`flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border px-3 ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search resources or usages…" className="w-full bg-transparent py-2 text-sm outline-none"/></div><SearchableSelect value={type} onChange={(e)=>setType(e.target.value)} className={`rounded-lg border px-3 py-2 text-xs ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}><option value="all">All resource types</option>{Object.keys(graph.types||{}).sort().map((key)=><option key={key} value={key}>{human(key)} · {graph.types[key]}</option>)}</SearchableSelect></div></s-section>
        <s-grid gridTemplateColumns="@container (inline-size > 900px) 1fr 1fr, 1fr" gap="base">{filtered.slice(0,240).map((row)=><s-section key={row.id}><s-stack direction="block" gap="small-200"><s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="base"><s-stack direction="block" gap="small-100"><s-stack direction="inline" gap="small-200" alignItems="center"><Tag size={14} aria-hidden="true"/><s-text type="strong">{row.label}</s-text></s-stack><s-text color="subdued">{human(row.type)}{row.subtitle?` · ${row.subtitle}`:''}</s-text></s-stack><s-badge tone={row.usageCount?'success':'warning'}>{row.usageCount} usage{row.usageCount===1?'':'s'}</s-badge></s-stack>{row.usedBy?.length?<s-stack direction="inline" gap="small-100">{row.usedBy.slice(0,12).map((item)=><s-badge key={item.id}>{item.label} · {human(item.type)}</s-badge>)}{row.usedBy.length>12?<s-text color="subdued">+{row.usedBy.length-12} more</s-text>:null}</s-stack>:<s-text color="subdued">No current page/library reference detected. Review before deleting this resource.</s-text>}</s-stack></s-section>)}{!filtered.length?<s-section><s-text color="subdued">No matching dependencies.</s-text></s-section>:null}</s-grid>
      </>:tab==='quality'?<PlatformQualityPanel data={data.p2} darkMode={darkMode} fetcher={fetcher} permissions={data.permissions||{}}/>:<>
        <s-section heading="Token modes & semantic aliases"><s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="base"><s-paragraph color="subdued">Base tokens remain compatible with existing Global Design. Dark overrides and semantic aliases are stored in the same backward-compatible token document.</s-paragraph><s-button variant="primary" disabled={!data.permissions?.manageTokens||fetcher.state!=='idle'} onClick={save}>{fetcher.state==='idle'?'Save token system':'Saving…'}</s-button></s-stack></s-section>
        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><div className="space-y-4">{DESIGN_TOKEN_GROUPS.map((group)=>{const keys=groupedTokens[group.key]||[];if(!keys.length)return null;return <s-section key={group.key} heading={group.label}><s-stack direction="block" gap="small-200"><s-text color="subdued">{keys.length} tokens</s-text><div className="grid gap-3 md:grid-cols-2">{keys.map((key)=><div key={key} className={`rounded-lg border p-3 ${darkMode?'border-[#273142] bg-[#101722]':'border-[#eef0f2] bg-[#fafafa]'}`}><TokenInput label={`${human(key)} · Base`} value={tokenSystem.base?.[key]} onChange={(value)=>patchBase(key,value)} darkMode={darkMode} color={isColorKey(key)} disabled={!data.permissions?.manageTokens}/><div className="mt-2"><TokenInput label="Dark override" value={tokenSystem.modes?.dark?.[key] ?? ''} onChange={(value)=>patchDark(key,value)} darkMode={darkMode} color={isColorKey(key)} disabled={!data.permissions?.manageTokens}/></div></div>)}</div></s-stack></s-section>})}</div><div className="space-y-4"><s-section heading="Semantic aliases"><s-stack direction="block" gap="small-200"><s-paragraph color="subdued">Stable semantic names can point at existing implementation tokens.</s-paragraph><div className="mt-3 max-h-[620px] space-y-2 overflow-auto">{Object.keys({...DEFAULT_SEMANTIC_ALIASES,...tokenSystem.aliases}).sort().map((alias)=><label key={alias} className="block"><span className={`mb-1 block text-[10px] font-mono ${darkMode?'text-[#9ca3af]':'text-[#6d7175]'}`}>{alias}</span><SearchableSelect disabled={!data.permissions?.manageTokens} value={tokenSystem.aliases?.[alias]||DEFAULT_SEMANTIC_ALIASES[alias]||''} onChange={(e)=>patchAlias(alias,e.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${darkMode?'border-[#374151] bg-[#0f172a]':'border-[#d9d9d9] bg-white'}`}>{tokenKeys.map((key)=><option key={key} value={key}>{human(key)}</option>)}</SearchableSelect></label>)}</div></s-stack></s-section></div></div>
      </>}
    </s-stack>
  </s-page>;
}
