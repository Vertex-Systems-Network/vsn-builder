import { useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import {
  BUILDER_RESOURCE_DEFINITIONS,
  BUILDER_ROLE_DEFINITIONS,
  BUILDER_SYSTEM_DEFINITIONS,
  isBuilderOwner,
  normalizeBuilderRoleAccess,
} from "../utils/builder-permissions.js";
import { getBuilderRoleAccess } from "../utils/builder-permissions.server.js";
import { getFeatureDecision, resolveEntitlementPlan } from "../services/entitlements.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

function json(data,status=200){return Response.json(data,{status});}
function requireOwner(session){if(!isBuilderOwner(session))throw new Response("Role Manager is available only to the store owner.",{status:403});}

export async function loader({request}){
  const{session}=await authenticate.admin(request);
  requireOwner(session);
  const plan=await resolveEntitlementPlan(db,session.shop);
  return json({
    shop:session.shop,
    access:await getBuilderRoleAccess(db,session.shop),
    roles:BUILDER_ROLE_DEFINITIONS,
    systems:BUILDER_SYSTEM_DEFINITIONS,
    resources:BUILDER_RESOURCE_DEFINITIONS,
    plan:{key:plan.key,name:plan.name,collaboration:plan.collaboration,teamMembers:plan.teamMembers},
  });
}

export async function action({request}){
  assertTrustedMutationRequest(request);
  const{session}=await authenticate.admin(request);
  requireOwner(session);
  const form=await request.formData();
  const intent=String(form.get("intent")||"toggle-role");
  const role=String(form.get("role")||"");
  const enabled=String(form.get("enabled")||"false")==="true";
  if(!BUILDER_ROLE_DEFINITIONS.some((item)=>item.key===role)||role==="admin")return json({ok:false,error:"This role cannot be changed."},400);

  const plan=await resolveEntitlementPlan(db,session.shop);
  if(role==="collaborator"&&enabled){const entitlement=await getFeatureDecision(db,session.shop,"collaboration",{plan});if(!entitlement.allowed)return json({ok:false,error:entitlement.message,code:entitlement.code,entitlement},403);}

  const current=await getBuilderRoleAccess(db,session.shop);
  let next=normalizeBuilderRoleAccess(current);

  if(intent==="toggle-system"){
    const system=String(form.get("system")||"");
    const definition=BUILDER_SYSTEM_DEFINITIONS.find((row)=>row.key===system);
    if(!definition)return json({ok:false,error:"Unknown VSN system."},400);
    if(definition.ownerOnly)return json({ok:false,error:`${definition.label} is restricted to the store owner for security.`},403);
    next.systems[role][system]=enabled;
    if(enabled)next[role]=true;
    next=normalizeBuilderRoleAccess(next);
  }else if(intent==="toggle-action"){
    const resourceKey=String(form.get("resource")||"");
    const actionKey=String(form.get("action")||"");
    const resource=BUILDER_RESOURCE_DEFINITIONS.find((row)=>row.key===resourceKey);
    const action=resource?.actions?.find((row)=>row.key===actionKey);
    if(!resource||!action)return json({ok:false,error:"Unknown VSN resource action."},400);
    if(resource.system){
      const system=BUILDER_SYSTEM_DEFINITIONS.find((row)=>row.key===resource.system);
      if(system?.ownerOnly)return json({ok:false,error:`${system.label} is restricted to the store owner for security.`},403);
      if(enabled)next.systems[role][resource.system]=true;
    }
    if(enabled)next[role]=true;
    if(!next.actions?.[role]?.[resourceKey])next=normalizeBuilderRoleAccess(next);
    next.actions[role][resourceKey][actionKey]=enabled;
    // Normalize once more so a disabled system/master role always wins.
    next=normalizeBuilderRoleAccess(next);
  }else{
    next=normalizeBuilderRoleAccess({...next,[role]:enabled,systems:next.systems,actions:next.actions});
  }

  await db.builderShopSetting.upsert({
    where:{shop:session.shop},
    create:{shop:session.shop,roleAccessJson:JSON.stringify(next)},
    update:{roleAccessJson:JSON.stringify(next)},
  });
  await db.builderAuditLog.create({data:{
    shop:session.shop,
    actor:"Store owner",
    role:"admin",
    action:`permissions.${intent}`,
    details:JSON.stringify({role,enabled,system:String(form.get("system")||"")||null,resource:String(form.get("resource")||"")||null,permission:String(form.get("action")||"")||null}),
  }}).catch(()=>{});
  return json({ok:true,access:next,role,enabled,intent});
}

function Toggle({checked,disabled,onChange,label}){
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={()=>!disabled&&onChange(!checked)} className={`vsn-role-toggle ${checked?"is-on":""}`}><span/></button>;
}

function SystemRows({systems,role,access,busy,onToggle}){
  const groups=[...new Set(systems.map((row)=>row.group))];
  return <div className="vsn-role-system-groups">{groups.map((group)=><section key={group}><h4>{group}</h4>{systems.filter((row)=>row.group===group).map((system)=><div className="vsn-role-system-row" key={system.key}><div><strong>{system.label}</strong>{system.ownerOnly?<small>Store owner only</small>:system.defaultEnabled===false?<small>Explicit grant required</small>:null}</div><Toggle checked={role.key==="admin"?true:system.ownerOnly?false:access?.[system.key]===true} disabled={busy||system.ownerOnly||role.key==="admin"} onChange={(enabled)=>onToggle(system.key,enabled)} label={`${role.label} ${system.label}`}/></div>)}</section>)}</div>;
}

function ActionRows({resources,role,systemAccess,actionAccess,busy,onToggle}){
  return <div className="vsn-role-actions"><div className="vsn-role-actions-head"><strong>Action permissions</strong><p>Server-enforced permissions for high-impact resources.</p></div><div className="vsn-role-action-groups">{resources.map((resource)=>{
    const systemAllowed=role.key==="admin"||systemAccess?.[resource.system]===true;
    return <section key={resource.key} className={!systemAllowed?"is-disabled":""}><h4>{resource.label}</h4><div>{resource.actions.map((action)=><div className="vsn-role-action-row" key={action.key}><span>{action.label}<code>{resource.key}:{action.key}</code></span><Toggle checked={role.key==="admin"?true:actionAccess?.[resource.key]?.[action.key]===true} disabled={busy||role.key==="admin"||!systemAllowed} onChange={(enabled)=>onToggle(resource.key,action.key,enabled)} label={`${role.label} ${resource.label} ${action.label}`}/></div>)}</div></section>;
  })}</div></div>;
}

function RoleRow({role,enabled,systems,resources,systemAccess,actionAccess,busy,onToggleRole,onToggleSystem,onToggleAction}){
  const[open,setOpen]=useState(role.key!=="admin");
  return <div className="vsn-role-card"><button type="button" className="vsn-role-card-head" onClick={()=>setOpen((value)=>!value)} aria-expanded={open}><div><strong>{role.label}</strong><span>{role.description}</span></div><div><em className={enabled?"is-on":""}>{enabled?"Enabled":"Disabled"}</em><b>{open?"−":"+"}</b></div></button>{open?<div className="vsn-role-card-body"><div className="vsn-role-master-row"><div><strong>VSN Builder access</strong><p>{role.locked?"The store owner always has full access.":"Master access for this role. Turning it off blocks every VSN system and action for this role."}</p></div><Toggle checked={enabled} disabled={role.locked||busy} onChange={onToggleRole} label={`${role.label} VSN access`}/></div>{enabled||role.locked?<><SystemRows systems={systems} role={role} access={systemAccess} busy={busy} onToggle={onToggleSystem}/><ActionRows resources={resources} role={role} systemAccess={systemAccess} actionAccess={actionAccess} busy={busy} onToggle={onToggleAction}/></>:<div className="vsn-role-disabled-note">Enable this role to configure individual VSN systems and actions.</div>}</div>:null}</div>;
}

export default function RoleManager(){
  const data=useLoaderData();
  const fetcher=useFetcher();
  const[optimistic,setOptimistic]=useState(data.access);
  const busy=fetcher.state!=="idle";
  const access=useMemo(()=>fetcher.data?.ok&&fetcher.data.access?fetcher.data.access:optimistic,[fetcher.data,optimistic]);

  const submit=(payload)=>fetcher.submit(payload,{method:"post"});
  const toggleRole=(role,enabled)=>{
    setOptimistic((current)=>normalizeBuilderRoleAccess({...current,[role]:enabled,systems:current.systems,actions:current.actions}));
    submit({intent:"toggle-role",role,enabled:String(enabled)});
  };
  const toggleSystem=(role,system,enabled)=>{
    setOptimistic((current)=>{const next=normalizeBuilderRoleAccess(current);next.systems[role][system]=enabled;if(enabled)next[role]=true;return normalizeBuilderRoleAccess(next);});
    submit({intent:"toggle-system",role,system,enabled:String(enabled)});
  };
  const toggleAction=(role,resource,action,enabled)=>{
    setOptimistic((current)=>{const next=normalizeBuilderRoleAccess(current);const definition=data.resources.find((row)=>row.key===resource);if(enabled&&definition?.system)next.systems[role][definition.system]=true;if(enabled)next[role]=true;next.actions[role][resource][action]=enabled;return normalizeBuilderRoleAccess(next);});
    submit({intent:"toggle-action",role,resource,action,enabled:String(enabled)});
  };

  return <div className="vsn-role-manager-page"><header><div><h1>Roles & Permissions</h1><p>System access plus resource/action authorization. Store-owner access remains guaranteed and permission changes are enforced on the server.</p></div></header>{fetcher.data?.error?<div className="vsn-role-error">{fetcher.data.error}</div>:null}{!data.plan?.collaboration?<div className="vsn-role-plan-note">{data.plan?.name} uses a single-user collaboration workflow. Silver or higher is required before collaborator access can be enabled.</div>:null}<div className="vsn-role-list">{data.roles.map((role)=><RoleRow key={role.key} role={role} enabled={role.key==="admin"||access[role.key]===true} systems={data.systems} resources={data.resources} systemAccess={access.systems?.[role.key]||{}} actionAccess={access.actions?.[role.key]||{}} busy={busy} onToggleRole={(enabled)=>toggleRole(role.key,enabled)} onToggleSystem={(system,enabled)=>toggleSystem(role.key,system,enabled)} onToggleAction={(resource,action,enabled)=>toggleAction(role.key,resource,action,enabled)}/>)}</div><p className="vsn-role-footnote">UI visibility is only convenience. Milestone L checks the same permissions again in server loaders/actions. Shopify Admin scopes remain independently controlled by Shopify.</p></div>;
}
