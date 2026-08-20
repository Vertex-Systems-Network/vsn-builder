import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { COMMERCIAL_PLANS, PLAN_FEATURE_ROWS, PLAN_ORDER, quotaLabel } from "../config/commercialPlans.js";
import { buildBillingLifecycle } from "../config/billingLifecycle.js";
import { getPlan, getPlanUsage, normalizePlanKey, serializePlan } from "../utils/plan.server.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { getShopifyAppPricingConfig, readShopifyAppPricingReturn } from "../services/shopify-app-pricing.server.js";
import { syncShopifySubscription, getShopifySubscriptionSyncPublicConfig } from "../services/shopify-subscription.server.js";
import { getEntitlementSnapshot, serializeEntitlementSnapshot } from "../services/entitlements.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

export async function loader({request}){
  const{admin,session}=await authenticate.admin(request);
  if(!(await canAccessBuilderAction(db,session,"billing","view"))) throw new Response("Your VSN role does not have permission to view Plans & License.",{status:403});
  const pricingReturn=readShopifyAppPricingReturn(request,session.shop);
  const subscriptionSync=await syncShopifySubscription({db,admin,shop:session.shop,force:Boolean(pricingReturn?.pendingVerification)}).catch((error)=>({ok:false,error:error instanceof Error?error.message:String(error)}));
  const entitlementSnapshot=await getEntitlementSnapshot(db,session.shop);
  const current=entitlementSnapshot.plan;
  const pricing=getShopifyAppPricingConfig(session.shop);
  return{
    current:serializePlan(current),
    plans:PLAN_ORDER.map((key)=>COMMERCIAL_PLANS[key]),
    featureRows:PLAN_FEATURE_ROWS.map((row)=>({key:row.key,label:row.label})),
    usage:await getPlanUsage(db,session.shop,current),
    entitlements:serializeEntitlementSnapshot(entitlementSnapshot),
    billingUrl:pricing.pricingUrl,
    pricing,
    pricingReturn,
    subscriptionSync:{config:getShopifySubscriptionSyncPublicConfig(),result:subscriptionSync},
    developerMode:process.env.NODE_ENV!=="production",
    canManage:await canAccessBuilderAction(db,session,"billing","manage"),
    positioning:"Shopify-native visual site, template and CRO builder with developer-grade CSS control.",
  };
}

export async function action({request}){
  assertTrustedMutationRequest(request);
  const{admin,session}=await authenticate.admin(request);
  const form=await request.formData();
  const intent=String(form.get("intent")||"");
  if(intent==="billing-refresh"){
    if(!(await canAccessBuilderAction(db,session,"billing","view"))) return Response.json({ok:false,error:"Your VSN role cannot view billing status."},{status:403});
    const result=await syncShopifySubscription({db,admin,shop:session.shop,force:true});
    if(!result.ok)return Response.json({ok:false,intent,error:result.error||result.issues?.join(" ")||"Shopify subscription verification failed."},{status:409});
    const plan=await getPlan(db,session.shop);
    return Response.json({ok:true,intent,verified:Boolean(result.verified),skipped:Boolean(result.skipped),reason:result.reason||null,plan:serializePlan(plan),message:result.skipped&&result.reason==="developer-mode"?"Developer Mode uses local plan simulation; Shopify verification was skipped.":"Shopify subscription status verified."});
  }
  if(!(await canAccessBuilderAction(db,session,"billing","manage"))) return Response.json({ok:false,error:"Your VSN role cannot manage billing or change the active plan."},{status:403});
  const key=normalizePlanKey(form.get("planKey"));
  if(!COMMERCIAL_PLANS[key])return Response.json({ok:false,error:"Unknown plan."},{status:400});
  const developerMode=process.env.NODE_ENV!=="production";
  if(!developerMode){
    const pricing=getShopifyAppPricingConfig(session.shop);
    if(!pricing.configured)return Response.json({ok:false,error:"Shopify App Pricing is not configured. Set SHOPIFY_APP_HANDLE (recommended) or SHOPIFY_APP_PRICING_URL before enabling production plan changes.",pricing},{status:503});
    return Response.json({ok:false,error:"Production plan changes must be approved on Shopify's hosted App Pricing page.",billingUrl:pricing.pricingUrl,pricing},{status:409});
  }
  const row=await db.builderSubscription.upsert({where:{shop:session.shop},create:{shop:session.shop,planKey:key,status:"active"},update:{planKey:key,status:"active"}});
  const plan=await getPlan(db,session.shop);
  const usage=await getPlanUsage(db,session.shop,plan);
  return Response.json({ok:true,row,plan:serializePlan(plan),usage,message:`${plan.name} simulated for this development store.`});
}

export default function Plans(){
  const data=useLoaderData();const f=useFetcher();const current=data.current||{};const lifecycle=buildBillingLifecycle(current);
  return <s-page heading="Plans & licensing"><s-section>
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-5"><div className="text-sm font-semibold">Positioning</div><p className="mt-1 text-sm text-[#666]">{data.positioning}</p><p className="mt-2 text-xs text-[#777]">All plans use the same widget library. Plans differ by systems and usage limits, not by hiding individual widgets.</p></div>
      {f.data?.error?<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{f.data.error}</div>:null}
      {f.data?.message?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{f.data.message}</div>:null}
      {data.pricingReturn?<div className={`rounded-xl border p-4 text-sm ${data.pricingReturn.shopMatches?"border-blue-200 bg-blue-50 text-blue-800":"border-red-200 bg-red-50 text-red-700"}`}>{data.pricingReturn.shopMatches?<>Shopify returned plan handle <b>{data.pricingReturn.planHandle}</b>{data.pricingReturn.planKey?<> ({COMMERCIAL_PLANS[data.pricingReturn.planKey]?.name})</>:null}. VSN verifies this signal against the live Partner API contract before applying entitlements.</>:<>Ignored a Shopify pricing return whose shop parameter did not match the authenticated store.</>}</div>:null}
      <div className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold">Shopify billing lifecycle</div><div className="mt-1 text-xs text-[#666]">{lifecycle.currentName} · {lifecycle.statusLabel}{lifecycle.billingPeriodLabel&&lifecycle.billingPeriodLabel!=="Not reported"?` · ${lifecycle.billingPeriodLabel}`:""}</div></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${lifecycle.statusTone==="success"?"bg-emerald-50 text-emerald-700":lifecycle.statusTone==="warning"?"bg-amber-50 text-amber-800":lifecycle.statusTone==="critical"?"bg-red-50 text-red-700":"bg-slate-50 text-slate-700"}`}>{lifecycle.statusLabel}</span></div>{lifecycle.pendingKind?<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{lifecycle.pendingKind==="cancellation"?`Cancellation scheduled${lifecycle.cancelEffectiveOn?` · effective ${new Date(lifecycle.cancelEffectiveOn).toLocaleDateString()}`:""}`:`Pending ${lifecycle.pendingKind}: ${lifecycle.currentName} → ${lifecycle.pendingName}${lifecycle.pendingBillingPeriodLabel?` · ${lifecycle.pendingBillingPeriodLabel}`:""}`}</div>:null}{lifecycle.trialEndsAt?<div className="mt-3 text-xs text-blue-700">Trial ends {new Date(lifecycle.trialEndsAt).toLocaleDateString()}{lifecycle.trialDaysRemaining?` · ${lifecycle.trialDaysRemaining} day${lifecycle.trialDaysRemaining===1?"":"s"} remaining`:""}</div>:null}{lifecycle.lastSyncError?<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Last verification warning: {lifecycle.lastSyncError}</div>:null}</div>
      <div className="grid gap-4 xl:grid-cols-4">{data.plans.map((p)=>{const active=current.key===p.key;return <article key={p.key} className={`rounded-xl border bg-white p-5 ${active?"border-emerald-400 ring-1 ring-emerald-200":""}`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{p.name}</h2><p className="mt-1 text-xs leading-5 text-[#666]">{p.description}</p><p className="mt-2 text-[11px] text-[#888]">Shopify handle: <code>{data.pricing?.planHandles?.[p.key]||p.key}</code></p></div>{active?<span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Current</span>:null}</div><ul className="mt-4 space-y-2 text-xs text-[#555]"><li><b>{quotaLabel(p.maxPages)}</b> builder pages/templates</li><li><b>{quotaLabel(p.templateQuota)}</b> Marketplace installs</li><li><b>{quotaLabel(p.aiMonthly)}</b> AI generations/month</li><li><b>{quotaLabel(p.croExperiments)}</b> active CRO experiments</li><li><b>{quotaLabel(p.teamMembers)}</b> collaboration seats</li><li>{p.enterpriseControls?"Enterprise hardening included":"Standard hardening"}</li><li><b>All widgets included</b></li></ul>{!active?<div className="mt-4">{!data.canManage?<div className="rounded-lg border bg-[#f7f7f7] px-3 py-2 text-xs text-[#777]">Billing management restricted</div>:data.developerMode?<s-button onClick={()=>f.submit({planKey:p.key},{method:"post"})} disabled={f.state!=="idle"}>Simulate plan</s-button>:<s-button target="_top" href={data.billingUrl||"#"} variant="primary" disabled={!data.billingUrl}>Review in Shopify</s-button>}</div>:null}</article>})}</div>
      <div className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Entitlement authority</h2><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${data.entitlements?.verified?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{data.entitlements?.source||"unknown"}</span></div><p className="mt-2 text-xs text-[#666]">Feature access and quota mutations are enforced server-side by Entitlement Engine 2.0. Production paid access requires a verified Shopify subscription mirror.</p>{!data.developerMode?<div className="mt-3"><s-button onClick={()=>f.submit({intent:"billing-refresh"},{method:"post"})} disabled={f.state!=="idle"}>{f.state!=="idle"?"Verifying…":"Refresh Shopify status"}</s-button></div>:null}</div>
      <div className="rounded-xl border bg-white p-5"><h2 className="text-sm font-semibold">Current usage</h2><div className="mt-4 grid gap-3 md:grid-cols-5">{Object.entries(data.usage||{}).map(([key,row])=><div key={key} className="rounded-lg bg-[#f7f7f7] p-3"><div className="text-xs capitalize text-[#666]">{key}</div><div className="mt-1 text-lg font-semibold">{row.used} / {row.limit<0?"∞":row.limit}</div>{row.window?<div className="text-[11px] text-[#888]">Active in {row.window}</div>:null}</div>)}</div></div>
      <p className="text-xs text-[#777]">Developer Mode allows local plan simulation. In production, every upgrade or downgrade is approved on Shopify App Pricing; redirect parameters never grant entitlements by themselves.</p>
    </div>
  </s-section></s-page>;
}
