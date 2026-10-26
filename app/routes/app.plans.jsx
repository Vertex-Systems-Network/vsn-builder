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

function planUsageFromSnapshot(snapshot, plan) {
  const quotas=snapshot?.quotas||{};
  return {
    pages:{used:quotas.pages?.used||0,limit:Number(plan.maxPages)},
    templates:{used:quotas.marketplaceInstalls?.used||0,limit:Number(plan.templateQuota)},
    ai:{used:quotas.aiGenerations?.used||0,limit:Number(plan.aiMonthly),resetAt:quotas.aiGenerations?.resetAt||null},
    experiments:{used:quotas.croExperiments?.used||0,limit:Number(plan.croExperiments)},
    team:{used:quotas.collaborationSeats?.used||1,limit:Number(plan.teamMembers),window:"assigned seats"},
  };
}

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
    usage:planUsageFromSnapshot(entitlementSnapshot,current),
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
  const lifecycleTone=["success","warning","critical"].includes(lifecycle.statusTone)?lifecycle.statusTone:"neutral";
  const unrecognizedPlanHandle=current.unrecognizedPlanHandle||null;
  return <s-page heading="Plans & licensing">
    <s-stack direction="block" gap="base">
      <s-section heading="Positioning"><s-stack direction="block" gap="small-200"><s-paragraph color="subdued">{data.positioning}</s-paragraph><s-text color="subdued">All plans use the same widget library. Plans differ by systems and usage limits, not by hiding individual widgets.</s-text></s-stack></s-section>
      {f.data?.error?<s-banner tone="critical">{f.data.error}</s-banner>:null}
      {f.data?.message?<s-banner tone="success">{f.data.message}</s-banner>:null}
      {data.pricingReturn?<s-banner tone={data.pricingReturn.shopMatches?"info":"critical"}>{data.pricingReturn.shopMatches?<>Shopify returned plan handle <b>{data.pricingReturn.planHandle}</b>{data.pricingReturn.planKey?<> ({COMMERCIAL_PLANS[data.pricingReturn.planKey]?.name})</>:null}. VSN verifies this signal against the live Partner API contract before applying entitlements.</>:<>Ignored a Shopify pricing return whose shop parameter did not match the authenticated store.</>}</s-banner>:null}
      <s-section heading="Shopify billing lifecycle"><s-stack direction="block" gap="small-200"><s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base"><s-text color="subdued">{lifecycle.currentName} · {lifecycle.statusLabel}{lifecycle.billingPeriodLabel&&lifecycle.billingPeriodLabel!=="Not reported"?` · ${lifecycle.billingPeriodLabel}`:""}</s-text><s-badge tone={lifecycleTone}>{lifecycle.statusLabel}</s-badge></s-stack>{lifecycle.pendingKind?<s-banner tone="warning">{lifecycle.pendingKind==="cancellation"?`Cancellation scheduled${lifecycle.cancelEffectiveOn?` · effective ${new Date(lifecycle.cancelEffectiveOn).toLocaleDateString()}`:""}`:`Pending ${lifecycle.pendingKind}: ${lifecycle.currentName} → ${lifecycle.pendingName}${lifecycle.pendingBillingPeriodLabel?` · ${lifecycle.pendingBillingPeriodLabel}`:""}`}</s-banner>:null}{unrecognizedPlanHandle?<s-banner tone="warning">Shopify verified a subscription with unmapped plan handle <code>{unrecognizedPlanHandle}</code>. Paid features remain disabled until this exact Shopify handle is mapped to a Builder plan.</s-banner>:null}{lifecycle.trialEndsAt?<s-text tone="info">Trial ends {new Date(lifecycle.trialEndsAt).toLocaleDateString()}{lifecycle.trialDaysRemaining?` · ${lifecycle.trialDaysRemaining} day${lifecycle.trialDaysRemaining===1?"":"s"} remaining`:""}</s-text>:null}{lifecycle.lastSyncError?<s-banner tone="warning">Last verification warning: {lifecycle.lastSyncError}</s-banner>:null}</s-stack></s-section>
      <div className="dashboard-pricing-grid">{data.plans.map((p)=>{const active=current.key===p.key;return <s-section key={p.key} heading={p.name}><s-stack direction="block" gap="small-200">{active?<s-stack direction="inline"><s-badge tone="success">Current</s-badge></s-stack>:null}<s-paragraph color="subdued">{p.description}</s-paragraph><s-text color="subdued">Shopify handle: <code>{data.pricing?.planHandles?.[p.key]||p.key}</code></s-text><s-text type="strong">${p.monthlyUsd}/month{p.annualUsd?` · ${p.annualUsd}/year`:""}</s-text><s-text color="subdued">{p.trialDays}-day free trial · Shopify confirms billing</s-text><s-unordered-list><s-list-item><b>{quotaLabel(p.maxPages)}</b> builder pages/templates</s-list-item><s-list-item><b>{quotaLabel(p.templateQuota)}</b> Marketplace installs</s-list-item><s-list-item><b>{quotaLabel(p.aiMonthly)}</b> AI generations/month</s-list-item><s-list-item><b>{quotaLabel(p.croExperiments)}</b> active CRO experiments</s-list-item><s-list-item><b>{quotaLabel(p.teamMembers)}</b> collaboration seats</s-list-item><s-list-item>{p.enterpriseControls?"Enterprise hardening included":"Standard hardening"}</s-list-item><s-list-item><b>All widgets included</b></s-list-item></s-unordered-list>{!active?<s-stack direction="inline">{!data.canManage?<s-badge tone="neutral">Billing management restricted</s-badge>:data.developerMode?<s-button onClick={()=>f.submit({planKey:p.key},{method:"post"})} disabled={f.state!=="idle"}>Simulate plan</s-button>:<s-button target="_top" href={data.billingUrl||"#"} variant="primary" disabled={!data.billingUrl}>Review in Shopify</s-button>}</s-stack>:null}</s-stack></s-section>})}</div>
      <s-section heading="Entitlement authority"><s-stack direction="block" gap="small-200"><s-stack direction="inline"><s-badge tone={data.entitlements?.verified?"success":"warning"}>{data.entitlements?.source||"unknown"}</s-badge></s-stack><s-paragraph color="subdued">Feature access and quota mutations are enforced server-side by Entitlement Engine 2.0. Production paid access requires a verified Shopify subscription mirror.</s-paragraph>{!data.developerMode?<s-stack direction="inline"><s-button onClick={()=>f.submit({intent:"billing-refresh"},{method:"post"})} disabled={f.state!=="idle"}>{f.state!=="idle"?"Verifying…":"Refresh Shopify status"}</s-button></s-stack>:null}</s-stack></s-section>
      <s-section heading="Current usage"><s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(5, 1fr), 1fr 1fr" gap="small-200">{Object.entries(data.usage||{}).map(([key,row])=><s-box key={key} background="subdued" borderRadius="base" padding="small-200 base"><s-stack direction="block" gap="small-100"><s-text color="subdued">{key.charAt(0).toUpperCase()+key.slice(1)}</s-text><s-heading>{row.used} / {row.limit<0?"∞":row.limit}</s-heading>{row.window?<s-text color="subdued">Active in {row.window}</s-text>:null}</s-stack></s-box>)}</s-grid></s-section>
      <s-text color="subdued">Developer Mode allows local plan simulation. In production, every upgrade or downgrade is approved on Shopify App Pricing; redirect parameters never grant entitlements by themselves.</s-text>
    </s-stack>
  </s-page>;
}
