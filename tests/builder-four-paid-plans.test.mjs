import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMERCIAL_PLANS, PLAN_ORDER, PAID_TRIAL_DAYS, UNSUBSCRIBED_PLAN,
  normalizePlanKey, planAtLeast, publicPlanName,
} from "../app/config/commercialPlans.js";
import {
  resolveEntitlementPlan, getFeatureDecisionFromPlan,
  getQuotaDecisionFromUsage, getMinimumPlanDecisionFromPlan,
} from "../app/services/entitlements.server.js";
import { getShopifyPlanHandleMap, resolveInternalPlanKeyFromHandle } from "../app/services/shopify-app-pricing.server.js";
import { buildBillingLifecycle } from "../app/config/billingLifecycle.js";

const pricing = [
  ["starter",30,null],
  ["sliver",100,null],
  ["gold",150,null],
  ["platinum",350,3000],
];

test("exactly four paid Shopify public IDs and no Free plan",()=>{
 assert.deepEqual(PLAN_ORDER,pricing.map(([id])=>id));
 assert.deepEqual(Object.keys(COMMERCIAL_PLANS),PLAN_ORDER);
 assert.equal(COMMERCIAL_PLANS.free,undefined);
 for(const [id,monthly,annual] of pricing){
  const plan=COMMERCIAL_PLANS[id];
  assert.equal(plan.name,id[0].toUpperCase()+id.slice(1));
  assert.equal(plan.key,id);
  assert.equal(plan.publicKey,id);
  assert.equal(plan.shopifyHandle,id);
  assert.equal(plan.monthlyUsd,monthly);
  assert.equal(plan.annualUsd,annual);
  assert.equal(plan.trialDays,10);
 }
 assert.equal(PAID_TRIAL_DAYS,10);
 assert.equal(COMMERCIAL_PLANS.platinum.monthlyUsd*12,4200);
 assert.equal(COMMERCIAL_PLANS.platinum.annualUsd,3000);
});
test("legacy VSN internal IDs remain aliases, but a Free handle does NOT grant Starter",()=>{
 for(const [old,current] of Object.entries({core:"starter",pro:"sliver",cro:"gold",agency:"platinum",silver:"sliver",platenium:"platinum"})){
  assert.equal(normalizePlanKey(old),current);
 }
 assert.equal(normalizePlanKey("free"),"inactive");
 assert.equal(normalizePlanKey("unknown_plan"),"inactive");
 assert.equal(publicPlanName("free"),"No active subscription");
 assert.equal(COMMERCIAL_PLANS.core,COMMERCIAL_PLANS.starter);
 assert.equal(COMMERCIAL_PLANS.pro,COMMERCIAL_PLANS.sliver);
 assert.equal(COMMERCIAL_PLANS.cro,COMMERCIAL_PLANS.gold);
 assert.equal(COMMERCIAL_PLANS.agency,COMMERCIAL_PLANS.platinum);
});
test("default Shopify Partner handles follow exact merchant plan IDs",()=>{
 const handles=getShopifyPlanHandleMap();
 for(const [id] of pricing){
  assert.equal(handles[id],id);
  assert.equal(resolveInternalPlanKeyFromHandle(id,handles),id);
 }
 assert.equal(resolveInternalPlanKeyFromHandle("free",handles),null);
});
test("all grants fail closed for merchants without a verified paid subscription",()=>{
 assert.equal(UNSUBSCRIBED_PLAN.key,"inactive");
 assert.equal(UNSUBSCRIBED_PLAN.allWidgets,false);
 assert.equal(UNSUBSCRIBED_PLAN.forms,false);
 assert.equal(UNSUBSCRIBED_PLAN.maxPages,0);
 assert.equal(getFeatureDecisionFromPlan(UNSUBSCRIBED_PLAN,"forms").allowed,false);
 assert.equal(getFeatureDecisionFromPlan(UNSUBSCRIBED_PLAN,"localization").allowed,false);
 assert.equal(getQuotaDecisionFromUsage(UNSUBSCRIBED_PLAN,"pages",0).allowed,false);
 assert.equal(getQuotaDecisionFromUsage(UNSUBSCRIBED_PLAN,"aiGenerations",0).allowed,false);
 assert.equal(getMinimumPlanDecisionFromPlan(UNSUBSCRIBED_PLAN,"starter").allowed,false);
 assert.equal(planAtLeast("inactive","starter"),false);
 assert.equal(planAtLeast("free","starter"),false);
});
function memoryDb(row){
 return {builderSubscription:{findUnique:async()=>row}};
}
async function inProduction(fn) {
 const before=process.env.NODE_ENV;
 process.env.NODE_ENV="production";
 try{return await fn();}finally{
  if(before===undefined)delete process.env.NODE_ENV;
  else process.env.NODE_ENV=before;
 }
}
test("production has no Starter access before Shopify charge approval",()=>inProduction(async()=>{
 const plan=await resolveEntitlementPlan(memoryDb(null),"unbilled.myshopify.com");
 assert.equal(plan.key,"inactive");
 assert.equal(plan.maxPages,0);
 assert.equal(plan.entitlementVerified,false);
 assert.equal(getFeatureDecisionFromPlan(plan,"forms").allowed,false);
}));
test("a verified Shopify 10-day trial unlocks exactly its paid tier",()=>inProduction(async()=>{
 const now=new Date();
 const row={provider:"shopify-app-pricing",status:"trialing",planKey:"sliver",planHandle:"sliver",
  verifiedAt:now,trialEndsAt:new Date(now.getTime()+10*86400000)};
 const plan=await resolveEntitlementPlan(memoryDb(row),"trial.myshopify.com",{now});
 assert.equal(plan.key,"sliver");
 assert.equal(plan.aiMonthly,500);
 assert.equal(plan.entitlementVerified,true);
 const lifecycle=buildBillingLifecycle(plan,{now});
 assert.equal(lifecycle.status,"trialing");
 assert.equal(lifecycle.trialDaysRemaining,10);
}));
test("a legacy free contract, unknown paid handle and frozen subscription cannot grant paid features",()=>inProduction(async()=>{
 const now=new Date();
 for(const row of [
  {provider:"shopify-app-pricing",status:"active",planKey:"core",planHandle:"free",verifiedAt:now},
  {provider:"shopify-app-pricing",status:"active",planKey:"platinum",planHandle:"mystery",verifiedAt:now},
  {provider:"shopify-app-pricing",status:"frozen",planKey:"gold",planHandle:"gold",verifiedAt:now},
 ]){
  const plan=await resolveEntitlementPlan(memoryDb(row),"guard.myshopify.com",{now});
  assert.equal(plan.key,"inactive");
  assert.equal(getFeatureDecisionFromPlan(plan,"forms").allowed,false);
 }
}));

test("misconfigured Staging NODE_ENV cannot activate developer paid defaults", async () => {
 const values = ["APP_ENV", "NODE_ENV", "VSN_DEFAULT_PLAN"];
 const before = Object.fromEntries(values.map((key) => [key, process.env[key]]));
 try {
  process.env.VSN_DEFAULT_PLAN = "platinum";
  for (const env of ["staging", "production"]) {
   process.env.APP_ENV = env;
   process.env.NODE_ENV = "development";
   const plan = await resolveEntitlementPlan(memoryDb(null), "unpaid.myshopify.com");
   assert.equal(plan.key, "inactive", env + " must not expose a simulated plan");
   assert.equal(plan.entitlementVerified, false);
   assert.equal(getFeatureDecisionFromPlan(plan, "forms").allowed, false);
  }
  delete process.env.APP_ENV;
  process.env.NODE_ENV = "test";
  const missingTier = await resolveEntitlementPlan(memoryDb(null), "unpaid.myshopify.com");
  assert.equal(missingTier.key, "inactive", "unknown APP_ENV must default to no plan");
  process.env.APP_ENV = "development";
  const devTier = await resolveEntitlementPlan(memoryDb(null), "test.myshopify.com");
  assert.equal(devTier.key, "platinum", "explicit Dev harness retains synthetic plan");
 } finally {
  for (const key of values) {
   if (before[key] === undefined) delete process.env[key];
   else process.env[key] = before[key];
  }
 }
});
