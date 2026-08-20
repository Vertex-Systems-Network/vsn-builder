import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { Code2, Play, Save, Star, Trash2, RotateCcw, Copy, ShieldAlert } from "lucide-react";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, getBuilderRole, getRoleActionAccess, isBuilderOwner } from "../utils/builder-permissions.js";
import { canAccessBuilderAction, canAccessBuilderSystem, getBuilderRoleAccess } from "../utils/builder-permissions.server.js";
import { describeGraphqlOperation, executeDeveloperGraphql, loadDeveloperGraphqlStudio, mutateDeveloperQuery, saveDeveloperQuery } from "../services/developer-graphql.server.js";
import { loadGlobalCodeStudio, mutateGlobalCode, saveGlobalCode } from "../services/global-code.server.js";
import { VsnButton, VsnCard, VsnCodeEditor, VsnEmpty, VsnInput, VsnNotice, VsnPage, VsnSearchInput, VsnSelect, VsnTabs } from "../components/ui/VsnToolkit";
import { useVsnConfirm } from "../components/ui/VsnConfirmProvider";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

const STARTER_QUERY = `query VsnShopOverview {
  shop {
    name
    primaryDomain { url }
  }
}`;
const EMPTY_CODE = { id:"", name:"", kind:"css", scope:"storefront", target:"", location:"head", priority:100, enabled:true, code:"/* Global storefront styles */\n" };
const SCOPE_OPTIONS = [
  ["storefront","Whole storefront"],["header","Header"],["footer","Footer"],["product","Product pages"],["collection","Collection pages"],
  ["search","Search pages"],["article","Article pages"],["page","Specific page path"],["market","Market"],["locale","Locale"],
];
const LOCATION_OPTIONS = [["head","Head"],["body-start","Body start"],["body-end","Body end"]];

function clientOperation(source="") { const cleaned=String(source||"").replace(/#[^\n]*/g,"").trim(); const match=cleaned.match(/^(query|mutation|subscription)\b\s*([_A-Za-z][_0-9A-Za-z]*)?/i); const type=cleaned.startsWith("{")?"query":String(match?.[1]||"query").toLowerCase(); return {type,name:match?.[2]||null,destructive:type==="mutation"&&/\b(delete|remove|revoke|cancel|destroy|archive|uninstall|reset|erase|purge)\w*\b/i.test(cleaned)}; }
function prettyJson(value){try{return JSON.stringify(value,null,2);}catch{return String(value??"");}}
function formatDate(value){try{return new Date(value).toLocaleString();}catch{return String(value||"");}}
function typeLabel(type){if(!type)return"";if(type.kind==="NON_NULL")return`${typeLabel(type.ofType)}!`;if(type.kind==="LIST")return`[${typeLabel(type.ofType)}]`;return type.name||type.kind||"";}
function codeFromEntry(row){return {id:row.id,name:row.name,kind:row.kind,scope:row.scope,target:row.target||"",location:row.location,priority:row.priority,enabled:row.enabled,code:row.code};}

export async function loader({request}) {
  const {admin,session}=await authenticate.admin(request);
  if(!(await canAccessBuilderSystem(db,session,"developerStudio"))) throw new Response("Your VSN role does not have access to Developer Studio.",{status:403});
  const role=getBuilderRole(session);
  const roleAccess=await getBuilderRoleAccess(db,session.shop);
  const actionAccess=getRoleActionAccess(roleAccess,role);
  const permissions={
    graphql:{
      readQueries:actionAccess.graphql?.read_queries===true,
      runQueries:actionAccess.graphql?.run_queries===true,
      saveQueries:actionAccess.graphql?.save_queries===true,
      runMutations:actionAccess.graphql?.run_mutations===true,
    },
    globalCode:{
      view:actionAccess.globalCode?.view===true,
      edit:actionAccess.globalCode?.edit===true,
      publish:actionAccess.globalCode?.publish===true,
      delete:actionAccess.globalCode?.delete===true,
    },
  };
  if(!permissions.graphql.readQueries&&!permissions.globalCode.view) throw new Response("Developer Studio is enabled, but no Developer Studio resources are granted to this role.",{status:403});
  const [graphql,globalCode]=await Promise.all([
    permissions.graphql.readQueries?loadDeveloperGraphqlStudio(db,admin,session.shop):Promise.resolve(null),
    permissions.globalCode.view?loadGlobalCodeStudio(db,session.shop):Promise.resolve(null),
  ]);
  return {graphql,globalCode,permissions,owner:isBuilderOwner(session),shop:session.shop};
}

export async function action({request}) {
  assertTrustedMutationRequest(request);
  const {admin,session}=await authenticate.admin(request);
  if(!(await canAccessBuilderSystem(db,session,"developerStudio"))) return Response.json({ok:false,error:"Developer Studio access denied."},{status:403});
  const form=await request.formData(); const intent=String(form.get("intent")||"");
  const deny=(message)=>Response.json({ok:false,intent,error:message},{status:403});
  try {
    if(intent==="run-graphql") {
      const operation=describeGraphqlOperation(String(form.get("query")||""));
      const actionKey=operation.type==="mutation"?"run_mutations":"run_queries";
      if(!(await canAccessBuilderAction(db,session,"graphql",actionKey))) return deny(operation.type==="mutation"?"Your role cannot run GraphQL mutations.":"Your role cannot run GraphQL queries.");
      const result=await executeDeveloperGraphql({db,admin,shop:session.shop,actor:builderActor(session),query:form.get("query"),variablesJson:form.get("variables"),mutationConfirmation:form.get("mutationConfirmation"),destructiveConfirmation:form.get("destructiveConfirmation")});
      return Response.json({intent,...result});
    }
    if(intent==="save-query") {
      if(!(await canAccessBuilderAction(db,session,"graphql","save_queries"))) return deny("Your role cannot save or manage GraphQL queries.");
      return Response.json({ok:true,intent,item:await saveDeveloperQuery(db,session.shop,{id:form.get("id"),name:form.get("name"),query:form.get("query"),variablesJson:form.get("variables")}),message:"GraphQL query saved."});
    }
    if(["favorite-query","trash-query","hard-delete-query"].includes(intent)) {
      if(!(await canAccessBuilderAction(db,session,"graphql","save_queries"))) return deny("Your role cannot manage saved GraphQL queries.");
      const mapped={"favorite-query":"favorite","trash-query":"trash","hard-delete-query":"hard-delete"}[intent];
      return Response.json({ok:true,intent,item:await mutateDeveloperQuery(db,session.shop,String(form.get("id")||""),mapped)});
    }
    if(intent==="save-code") {
      if(!(await canAccessBuilderAction(db,session,"globalCode","edit"))) return deny("Your role cannot create or edit Global Code.");
      return Response.json({ok:true,intent,item:await saveGlobalCode(db,session.shop,{id:form.get("id"),name:form.get("name"),kind:form.get("kind"),scope:form.get("scope"),target:form.get("target"),location:form.get("location"),priority:form.get("priority"),enabled:String(form.get("enabled"))!=="false",code:form.get("code")}),message:"Global Code saved and storefront runtime invalidated."});
    }
    if(["toggle-code","trash-code","restore-code","duplicate-code","hard-delete-code","rollback-code"].includes(intent)) {
      const required=["toggle-code","rollback-code"].includes(intent)?"publish":["trash-code","hard-delete-code"].includes(intent)?"delete":"edit";
      if(!(await canAccessBuilderAction(db,session,"globalCode",required))) return deny(`Your role cannot ${required==="publish"?"publish or roll back":required==="delete"?"delete":"edit"} Global Code.`);
      const mapped=intent.replace("-code","");
      return Response.json({ok:true,intent,item:await mutateGlobalCode(db,session.shop,{id:String(form.get("id")||""),intent:mapped,revisionId:form.get("revisionId")})});
    }
    return Response.json({ok:false,error:"Unsupported Developer Studio action."},{status:400});
  } catch(error) {
    console.error(`VSN Developer Studio action failed (${intent}):`,error);
    return Response.json({ok:false,intent,error:error instanceof Error?error.message:"Developer Studio could not complete that action."},{status:400});
  }
}

function GraphqlStudio({data,permissions}) {
  const fetcher=useFetcher(); const confirm=useVsnConfirm();
  const [query,setQuery]=useState(STARTER_QUERY); const [variables,setVariables]=useState("{}"); const [savedId,setSavedId]=useState(""); const [name,setName]=useState("Shop overview");
  const [schemaTab,setSchemaTab]=useState("queries"); const [schemaSearch,setSchemaSearch]=useState("");
  const operation=useMemo(()=>clientOperation(query),[query]);
  const result=fetcher.data?.intent==="run-graphql"?fetcher.data:null;
  const schemaFields=(schemaTab==="mutations"?data.schema.mutationFields:data.schema.queryFields)||[];
  const filtered=schemaFields.filter((field)=>`${field.name} ${field.description||""}`.toLowerCase().includes(schemaSearch.trim().toLowerCase())).slice(0,120);
  const run=async()=>{
    if(operation.type==="mutation"&&!permissions.runMutations)return;
    if(operation.type!=="mutation"&&!permissions.runQueries)return;
    let mutationConfirmation="",destructiveConfirmation="";
    if(operation.type==="mutation") { const ok=await confirm({title:"Run GraphQL mutation?",message:"Mutations can change Shopify data. VSN keeps mutations disabled unless you explicitly confirm each run.",confirmLabel:"Run mutation",requireText:"MUTATE",tone:"danger"}); if(!ok)return; mutationConfirmation="MUTATE"; }
    if(operation.destructive) { const ok=await confirm({title:"Destructive GraphQL mutation",message:"This mutation appears to delete, revoke, cancel, reset or remove data. This cannot always be undone.",confirmLabel:"Run destructive mutation",requireText:"DELETE",tone:"danger"}); if(!ok)return; destructiveConfirmation="DELETE"; }
    fetcher.submit({intent:"run-graphql",query,variables,mutationConfirmation,destructiveConfirmation},{method:"post"});
  };
  const save=()=>fetcher.submit({intent:"save-query",id:savedId,name,query,variables},{method:"post"});
  const loadSaved=(row)=>{setSavedId(row.id);setName(row.name);setQuery(row.query);setVariables(prettyJson(row.variables||{}));};
  return <div className="vsn-dev-grid">
    <div className="vsn-dev-main">
      <VsnCard title="Query workspace" subtitle="Runs with this app's actual Shopify Admin API token and granted scopes." actions={<div className="vsn-dev-inline"><span className={`vsn-dev-operation is-${operation.type}`}>{operation.type}{operation.name?` · ${operation.name}`:""}</span><VsnButton onClick={run} disabled={operation.type==="mutation"?!permissions.runMutations:!permissions.runQueries} loading={fetcher.state!=="idle"&&fetcher.formData?.get("intent")==="run-graphql"} icon={<Play size={14}/>}>Run</VsnButton></div>}>
        {fetcher.data?.error?<VsnNotice tone="danger">{fetcher.data.error}</VsnNotice>:null}
        <div className="vsn-dev-save-row"><VsnInput label="Saved query name" value={name} onChange={(e)=>setName(e.target.value)}/><VsnButton variant="secondary" onClick={save} disabled={!permissions.saveQueries} icon={<Save size={14}/>}>Save query</VsnButton>{savedId?<VsnButton variant="secondary" disabled={!permissions.saveQueries} onClick={()=>{setSavedId("");setName("Untitled query");}}>Save as new</VsnButton>:null}</div>
        <VsnCodeEditor label="GraphQL document" language="graphql" rows={20} value={query} onChange={setQuery} help="Ctrl/Cmd + Space opens Shopify-oriented snippets."/>
        <VsnCodeEditor label="Variables" language="json" rows={7} value={variables} onChange={setVariables} help="JSON object passed as GraphQL variables."/>
        {result?<div className="vsn-dev-result">
          <div className="vsn-dev-result-meta"><b className={result.ok?"is-ok":"is-error"}>{result.ok?"Success":"GraphQL errors"}</b><span>{result.durationMs} ms</span><span>Requested cost: {result.cost?.requested??"—"}</span><span>Actual cost: {result.cost?.actual??"—"}</span>{result.cost?.throttle?<span>Available: {result.cost.throttle.currentlyAvailable??"—"}</span>:null}</div>
          <VsnCodeEditor label="Response" language="json" rows={18} value={prettyJson(result.payload)} readOnly help="Read-only execution payload."/>
        </div>:null}
      </VsnCard>

      <VsnCard title="Saved queries" subtitle="Reusable query documents. Variables are stored only when you explicitly save a query.">
        <div className="vsn-dev-list">{data.saved.map((row)=><article key={row.id}><button className="vsn-dev-list-main" type="button" onClick={()=>loadSaved(row)}><strong>{row.name}</strong><span>{row.operationType} · updated {formatDate(row.updatedAt)}</span></button><fetcher.Form method="post"><input type="hidden" name="intent" value="favorite-query"/><input type="hidden" name="id" value={row.id}/><button className="vsn-dev-icon" type="submit" disabled={!permissions.saveQueries} title="Favorite"><Star size={15} fill={row.isFavorite?"currentColor":"none"}/></button></fetcher.Form><fetcher.Form method="post"><input type="hidden" name="intent" value="trash-query"/><input type="hidden" name="id" value={row.id}/><button className="vsn-dev-icon danger" type="submit" disabled={!permissions.saveQueries} title="Move to trash"><Trash2 size={15}/></button></fetcher.Form></article>)}{!data.saved.length?<VsnEmpty title="No saved queries" description="Write a query above and save it for reuse."/>:null}</div>
      </VsnCard>

      <VsnCard title="Execution history" subtitle="Stores query text and execution metadata, never Shopify response payloads or unsaved variables.">
        <div className="vsn-dev-history">{data.history.map((row)=><button type="button" key={row.id} onClick={()=>{setQuery(row.query);setSavedId("");setName(row.operationName||"History query");}}><span className={row.success?"ok":"bad"}/><div><strong>{row.operationName||`${row.operationType} operation`}</strong><small>{formatDate(row.createdAt)} · {row.durationMs} ms · cost {row.actualCost??"—"}</small></div></button>)}{!data.history.length?<span className="vsn-dev-muted">No GraphQL executions recorded yet.</span>:null}</div>
      </VsnCard>
    </div>

    <aside className="vsn-dev-side">
      <VsnCard title="Schema explorer" subtitle={`${data.schema.queryFields?.length||0} queries · ${data.schema.mutationFields?.length||0} mutations`}>
        {data.schema.error?<VsnNotice tone="warning">{data.schema.error}</VsnNotice>:null}
        <VsnTabs items={[{value:"queries",label:"Queries",count:data.schema.queryFields?.length||0},{value:"mutations",label:"Mutations",count:data.schema.mutationFields?.length||0}]} value={schemaTab} onChange={setSchemaTab}/>
        <VsnSearchInput label="Search schema" hideLabel placeholder="Search fields…" value={schemaSearch} onChange={(e)=>setSchemaSearch(e.target.value)}/>
        <div className="vsn-dev-schema-list">{filtered.map((field)=><details key={field.name}><summary><code>{field.name}</code>{field.isDeprecated?<em>Deprecated</em>:null}</summary><p>{field.description||"No Shopify schema description."}</p>{field.args?.length?<div className="vsn-dev-args">{field.args.map((arg)=><span key={arg.name}><b>{arg.name}</b>: {typeLabel(arg.type)}</span>)}</div>:null}<button type="button" onClick={()=>{const snippet=`${field.name}${field.args?.length?"(\n  "+field.args.filter((arg)=>typeLabel(arg.type).endsWith("!")).map((arg)=>`${arg.name}: `).join(",\n  ")+"\n)":""} {\n  \n}`;setQuery((current)=>`${current.trim()}\n\n# ${schemaTab}\n${snippet}`);}}>Insert skeleton</button></details>)}</div>
      </VsnCard>
      <VsnCard title="Granted scopes" subtitle="These are the permissions attached to the current app installation."><div className="vsn-dev-scope-list">{data.schema.scopes?.map((scope)=><code key={scope}>{scope}</code>)}{!data.schema.scopes?.length?<span className="vsn-dev-muted">No scope list returned.</span>:null}</div></VsnCard>
      <VsnNotice tone="warning"><ShieldAlert size={14}/> GraphQL Studio cannot bypass Shopify scopes. Mutation confirmation is additional VSN protection, not extra API permission.</VsnNotice>
    </aside>
  </div>;
}

function GlobalCodeStudio({data,permissions}) {
  const fetcher=useFetcher(); const confirm=useVsnConfirm(); const [form,setForm]=useState(EMPTY_CODE); const [revisionTarget,setRevisionTarget]=useState("");
  const selected=data.entries.find((row)=>row.id===form.id)||null;
  const revisions=data.revisions.filter((row)=>row.globalCodeId===revisionTarget).slice(0,20);
  useEffect(()=>{if(form.kind==="css"&&form.location!=="head")setForm((current)=>({...current,location:"head"}));},[form.kind,form.location]);
  const save=()=>fetcher.submit({intent:"save-code",...form,priority:String(form.priority),enabled:String(form.enabled)},{method:"post"});
  const action=async(intent,row,extra={})=>{
    if(intent==="hard-delete-code"){const ok=await confirm({title:"Permanently delete Global Code?",message:`Permanently delete “${row.name}” and its revision history? This cannot be undone.`,confirmLabel:"Delete permanently",requireText:"DELETE",tone:"danger"});if(!ok)return;}
    if(intent==="rollback-code"){const ok=await confirm({title:"Restore this revision?",message:`The current “${row.name}” code will be snapshotted before rollback.`,confirmLabel:"Restore revision",tone:"warning"});if(!ok)return;}
    fetcher.submit({intent,id:row.id,...extra},{method:"post"});
  };
  const warnings=selected?.warnings||[];
  return <div className="vsn-dev-grid">
    <div className="vsn-dev-main">
      <VsnCard title={form.id?"Edit Global Code":"New Global Code"} subtitle="Storefront CSS/JS delivered through the existing authenticated VSN app-proxy runtime." actions={<div className="vsn-dev-inline"><VsnButton variant="secondary" onClick={()=>setForm({...EMPTY_CODE})} disabled={!permissions.edit}>New</VsnButton><VsnButton onClick={save} disabled={!permissions.edit} loading={fetcher.state!=="idle"&&fetcher.formData?.get("intent")==="save-code"} icon={<Save size={14}/>}>Save</VsnButton></div>}>
        {fetcher.data?.error?<VsnNotice tone="danger">{fetcher.data.error}</VsnNotice>:null}{fetcher.data?.message?<VsnNotice>{fetcher.data.message}</VsnNotice>:null}
        <div className="vsn-dev-code-meta">
          <VsnInput label="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/>
          <VsnSelect label="Type" value={form.kind} onChange={(e)=>setForm({...form,kind:e.target.value,code:e.target.value==="js"&&form.code.startsWith("/* Global storefront styles")?"// Global storefront behavior\n":form.code})}><option value="css">CSS</option><option value="js">JavaScript</option></VsnSelect>
          <VsnSelect label="Scope" value={form.scope} onChange={(e)=>setForm({...form,scope:e.target.value,target:""})}>{SCOPE_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</VsnSelect>
          <VsnSelect label="Execution location" value={form.kind==="css"?"head":form.location} disabled={form.kind==="css"} onChange={(e)=>setForm({...form,location:e.target.value})}>{LOCATION_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</VsnSelect>
          <VsnInput label="Priority" type="number" min="0" max="9999" value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}/>
          <label className="vsn-dev-switch"><input type="checkbox" checked={form.enabled} onChange={(e)=>setForm({...form,enabled:e.target.checked})}/><span>Enabled</span></label>
        </div>
        {["page","market","locale"].includes(form.scope)?<VsnInput label={form.scope==="page"?"Exact storefront path":form.scope==="market"?"Market handle/country code":"Locale code"} placeholder={form.scope==="page"?"/pages/about":form.scope==="market"?"us":"en"} value={form.target} onChange={(e)=>setForm({...form,target:e.target.value})}/>:null}
        {form.scope==="header"||form.scope==="footer"?<VsnNotice tone="warning">Header/Footer scope is structural and applies wherever the VSN embed is active; use execution location and selectors to constrain behavior.</VsnNotice>:null}
        <VsnCodeEditor label={form.kind==="css"?"CSS source":"JavaScript source"} language={form.kind} rows={24} value={form.code} onChange={(code)=>setForm({...form,code})} help="Code is revisioned on every update. Use Safe Mode for storefront recovery."/>
        {warnings.length?<div className="vsn-dev-warnings">{warnings.map((warning)=><VsnNotice tone="warning" key={warning}>{warning}</VsnNotice>)}</div>:null}
      </VsnCard>

      <VsnCard title="Global Code snippets" subtitle="Priority runs low-to-high. Disabled and trashed snippets are never shipped to storefront.">
        <div className="vsn-dev-list">{data.entries.map((row)=><article key={row.id}><button className="vsn-dev-list-main" type="button" onClick={()=>{setForm(codeFromEntry(row));setRevisionTarget(row.id);}}><strong>{row.name}</strong><span>{row.kind.toUpperCase()} · {row.scope}{row.target?` → ${row.target}`:""} · {row.location} · priority {row.priority}</span>{row.warnings?.length?<small>{row.warnings.length} warning{row.warnings.length===1?"":"s"}</small>:null}</button><button className={`vsn-dev-pill ${row.enabled?"on":""}`} type="button" disabled={!permissions.publish} onClick={()=>action("toggle-code",row)}>{row.enabled?"On":"Off"}</button><button className="vsn-dev-icon" type="button" disabled={!permissions.edit} onClick={()=>action("duplicate-code",row)} title="Duplicate"><Copy size={15}/></button><button className="vsn-dev-icon danger" type="button" disabled={!permissions.delete} onClick={()=>action("trash-code",row)} title="Move to trash"><Trash2 size={15}/></button></article>)}{!data.entries.length?<VsnEmpty title="No Global Code" description="Create CSS or JavaScript that VSN can deliver across storefront contexts."/>:null}</div>
      </VsnCard>
    </div>

    <aside className="vsn-dev-side">
      <VsnCard title="Revision history" subtitle="Select a code snippet to inspect and roll back its saved snapshots.">
        {revisionTarget?<div className="vsn-dev-revisions">{revisions.map((row)=><div key={row.id}><span><b>{formatDate(row.createdAt)}</b><small>{row.kind.toUpperCase()} · {row.scope} · priority {row.priority}</small></span><button type="button" disabled={!permissions.publish} onClick={()=>action("rollback-code",data.entries.find((item)=>item.id===revisionTarget)||{id:revisionTarget,name:"Global Code"},{revisionId:row.id})}><RotateCcw size={14}/> Roll back</button></div>)}{!revisions.length?<span className="vsn-dev-muted">No previous revisions yet.</span>:null}</div>:<VsnEmpty title="Choose a snippet" description="Its revisions will appear here."/>}
      </VsnCard>
      <VsnCard title="Trash" subtitle="Reversible until you permanently delete a snippet."><div className="vsn-dev-trash">{data.trash.map((row)=><div key={row.id}><span><strong>{row.name}</strong><small>{row.kind.toUpperCase()} · {row.scope}</small></span><button type="button" disabled={!permissions.edit} onClick={()=>action("restore-code",row)}>Restore</button><button type="button" className="danger" disabled={!permissions.delete} onClick={()=>action("hard-delete-code",row)}>Delete</button></div>)}{!data.trash.length?<span className="vsn-dev-muted">Trash is empty.</span>:null}</div></VsnCard>
      <VsnNotice tone="warning"><ShieldAlert size={14}/> Safe Mode disables Global Code delivery at the app-proxy runtime. External scripts may still be restricted by Shopify/theme CSP.</VsnNotice>
    </aside>
  </div>;
}

export default function DeveloperStudio() {
  const data=useLoaderData();
  const tabs=[];
  if(data.permissions.graphql.readQueries)tabs.push({value:"graphql",label:"GraphQL Studio"});
  if(data.permissions.globalCode.view)tabs.push({value:"global-code",label:"Global CSS / JS"});
  const [tab,setTab]=useState(tabs[0]?.value||"graphql");
  useEffect(()=>{if(!tabs.some((item)=>item.value===tab)&&tabs[0])setTab(tabs[0].value);},[tab,data.permissions.graphql.readQueries,data.permissions.globalCode.view]);
  return <VsnPage title="Developer Studio" subtitle="Shopify-aware GraphQL tooling and revisioned storefront code for development workflows." actions={tabs.length>1?<VsnTabs items={tabs} value={tab} onChange={setTab}/>:null}>
    <div className="vsn-dev-banner"><Code2 size={17}/><div><strong>Developer Mode</strong><span>Queries use the current app installation and cannot exceed Shopify-granted scopes. VSN action permissions are also enforced on the server.</span></div></div>
    {tab==="graphql"&&data.graphql?<GraphqlStudio data={data.graphql} permissions={data.permissions.graphql}/>:data.globalCode?<GlobalCodeStudio data={data.globalCode} permissions={data.permissions.globalCode}/>:null}
  </VsnPage>;
}
