import test from "node:test";
import assert from "node:assert/strict";
import {isLocalBillingSimulation} from "../app/config/local-billing-simulation.js";
import {resolveEntitlementPlan} from "../app/services/entitlements.server.js";
import {syncShopifySubscription} from "../app/services/shopify-subscription.server.js";

const shop="tier-isolation.myshopify.com";
function envCase(node,app,worker,tier){
 return {
  NODE_ENV:node,APP_ENV:app,VSN_WORKER_NAME:worker,
  VSN_DEPLOYMENT_TIER:tier,
 };
}
function withEnv(patch,run){
 const fields=[
  "NODE_ENV","APP_ENV","VSN_WORKER_NAME","VSN_DEPLOYMENT_TIER",
  "VSN_RUNTIME_TIER","VSN_DEFAULT_PLAN","VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT",
  "SHOPIFY_PARTNER_ORGANIZATION_ID","SHOPIFY_PARTNER_ORG_ID",
  "SHOPIFY_PARTNER_API_TOKEN","SHOPIFY_PARTNER_ACCESS_TOKEN",
 ];
 const old=Object.fromEntries(fields.map(x=>[x,process.env[x]]));
 for(const key of fields){
  if(Object.hasOwn(patch,key)){
   if(patch[key]===undefined)delete process.env[key];
   else process.env[key]=patch[key];
  }
 }
 return Promise.resolve().then(run).finally(()=>{
  for(const key of fields){
   if(old[key]===undefined)delete process.env[key];
   else process.env[key]=old[key];
  }
 });
}
function db(row){
 return {builderSubscription:{findUnique:async()=>row}};
}
test("Staging, Production and Live never grant developer default paid tier under any NODE_ENV",()=>{
 for(const node of ["development","test","production",undefined]){
  for(const tier of ["staging","production","live"]){
   assert.equal(isLocalBillingSimulation(envCase(node,tier,undefined,undefined)),
    false,node+"/"+tier);
  }
  for(const worker of ["vsn-builder-staging","vsn-builder-production","custom-live"]){
   assert.equal(isLocalBillingSimulation(envCase(node,undefined,worker,undefined)),
    false,node+"/"+worker);
  }
 }
 assert.equal(isLocalBillingSimulation(envCase("development","unknown",undefined,undefined)),false);
 assert.equal(isLocalBillingSimulation(envCase("test",undefined,undefined,"staging")),false);
 assert.equal(isLocalBillingSimulation(envCase("test","development","vsn-builder-staging",undefined)),false);
});
test("only explicit Local/Dev or legacy unmarked Node test can use local paid simulation",()=>{
 for(const node of ["development","test",undefined]){
  assert.equal(isLocalBillingSimulation(envCase(node,"development",undefined,undefined)),true);
  assert.equal(isLocalBillingSimulation(envCase(node,"local",undefined,undefined)),true);
  assert.equal(isLocalBillingSimulation(envCase(node,undefined,undefined,undefined)),true);
 }
 assert.equal(isLocalBillingSimulation(envCase("production","development",undefined,undefined)),false);
});
test("Staging QA NODE_ENV=development cannot grant Platinum without a Partner mirror",async()=>{
 await withEnv({
  NODE_ENV:"development",APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_DEFAULT_PLAN:"platinum",
 },async()=>{
  const plan=await resolveEntitlementPlan(db(null),shop);
  assert.equal(plan.key,"inactive");
  assert.equal(plan.maxPages,0);
  assert.equal(plan.entitlementVerified,false);
  assert.equal(plan.developerMode,false);
  assert.notEqual(plan.entitlementSource,"developer-platinum-default");
 });
});
test("Staging QA with genuine fresh Shopify paid mirror uses only that verified plan",async()=>{
 await withEnv({
  NODE_ENV:"test",APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_DEFAULT_PLAN:"platinum",
 },async()=>{
  const now=new Date();
  const row={shop,provider:"shopify-app-pricing",status:"trialing",
   planKey:"starter",planHandle:"starter",verifiedAt:now,
   trialEndsAt:new Date(now.getTime()+86400000)};
  const plan=await resolveEntitlementPlan(db(row),shop,{now});
  assert.equal(plan.key,"starter");
  assert.equal(plan.maxPages,5);
  assert.equal(plan.entitlementVerified,true);
  assert.equal(plan.developerMode,false);
 });
});
test("Local-only developer simulation remains available and cannot sync real Shopify Partner automatically",async()=>{
 await withEnv({
  NODE_ENV:"development",APP_ENV:"development",VSN_WORKER_NAME:undefined,
  VSN_DEFAULT_PLAN:"sliver",VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT:undefined,
 },async()=>{
  const plan=await resolveEntitlementPlan(db(null),shop);
  assert.equal(plan.key,"sliver");
  assert.equal(plan.entitlementVerified,false);
  assert.equal(plan.developerMode,true);
  const result=await syncShopifySubscription({shop,db:db(null),admin:{
   graphql:async()=>{throw Error("Local mode must never contact Shopify")}
  }});
  assert.equal(result.reason,"developer-mode");
 });
});
test("Staging merchant billing sync never takes Local developer-mode skip",async()=>{
 await withEnv({
  NODE_ENV:"development",APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT:undefined,
  SHOPIFY_PARTNER_ORGANIZATION_ID:undefined,SHOPIFY_PARTNER_ORG_ID:undefined,
  SHOPIFY_PARTNER_API_TOKEN:undefined,SHOPIFY_PARTNER_ACCESS_TOKEN:undefined,
 },async()=>{
  const result=await syncShopifySubscription({
   shop,db:db(null),admin:{graphql:async()=>{throw Error("No provider credentials")}},
  });
  assert.equal(result.ok,false);
  assert.equal(result.reason,"unconfigured");
  assert(result.issues.some(x=>x.includes("SHOPIFY_PARTNER_API_TOKEN")));
 });
});
