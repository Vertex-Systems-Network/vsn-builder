import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {paidMutationDenied,isUnpaidDashboardExempt,EXEMPT_DASHBOARD_INTENTS} from "../app/services/paid-mutation-guard.server.js";

const originalMode=process.env.NODE_ENV;
function setProduction(){process.env.NODE_ENV="production";}
function restoreMode(){if(originalMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalMode;}
function dbWith(row){
 return {builderSubscription:{findUnique:async()=>row}};
}
test("paid-only guard denies all merchant mutations without verified Shopify contract",{concurrency:false},async()=>{
 setProduction();
 try{
  const response=await paidMutationDenied(dbWith(null),"unbilled.myshopify.com");
  assert.equal(response?.status,403);
  assert.equal(response?.headers.get("cache-control"),"no-store");
  const data=await response.json();
  assert.equal(data.ok,false);
  assert.equal(data.success,false);
  assert.equal(data.entitlement.planKey,"inactive");
  assert.equal(data.code,"VSN_PLAN_TIER_REQUIRED");
  assert.match(data.error,/Starter/i);
 }finally{restoreMode();}
});
test("new, canceled, frozen and retired Free Shopify plans cannot write",{concurrency:false},async()=>{
 setProduction();
 try{
  const now=new Date();
  for(const row of [
   {provider:"shopify-app-pricing",status:"active",planKey:"starter",planHandle:"free",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"canceled",planKey:"gold",planHandle:"gold",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"frozen",planKey:"platinum",planHandle:"platinum",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"active",planKey:"platinum",planHandle:"unknown",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"active",planKey:"starter",planHandle:"starter",verifiedAt:new Date(now.getTime()-35*86400000)},
  ]){
   const response=await paidMutationDenied(dbWith(row),"blocked.myshopify.com");
   assert.equal(response?.status,403,JSON.stringify({status:row.status,handle:row.planHandle}));
  }
 }finally{restoreMode();}
});
test("verified Shopify paid contract and 10-day trial can write",{concurrency:false},async()=>{
 setProduction();
 try{
  const now=new Date();
  for(const [key,status] of [["starter","active"],["sliver","trialing"],["gold","active"],["platinum","active"]]){
   const row={provider:"shopify-app-pricing",status,planKey:key,planHandle:key,
     verifiedAt:now,trialEndsAt:status==="trialing"?new Date(now.getTime()+10*86400000):null};
   const response=await paidMutationDenied(dbWith(row),"paid.myshopify.com");
   assert.equal(response,null,key);
  }
 }finally{restoreMode();}
});
test("only explicit billing, support, notifications and app uninstall bypass the paid mutation guard",()=>{
 for(const intent of ["app-uninstall","billing-refresh","support-create","support-reply","support-status","notification-read"]){
  assert.equal(isUnpaidDashboardExempt(intent),true,intent);
 }
 for(const intent of ["save-widgets","save-app-settings","rebuild-theme-assets","sync-library-defaults",
   "save-dashboard-layout","unknown","seed-demo"]){
  assert.equal(isUnpaidDashboardExempt(intent),false,intent);
 }
 assert(!EXEMPT_DASHBOARD_INTENTS.includes("all"));
});
test("merchant mutation entry points each invoke server paid guard inside action",()=>{
 const routes=[
  "app.pages.jsx","app.builder.$id.jsx","app.library.jsx","app.marketplace.jsx",
  "app.email-builder.jsx","app.widget-studio.jsx","app.campaigns.jsx",
  "app.form-submissions.jsx","app.ai.jsx","app.ai-command.jsx",
  "app.backups.jsx","app.brand-kits.jsx","app.developer-studio.jsx",
  "app.editor-media.jsx","app.experiments.jsx","app.floating-elements.jsx",
  "app.fonts.jsx","app.form-settings.jsx","app.motion-library.jsx",
  "app.plugins.jsx","app.role-manager.jsx","app.stock-images.jsx",
  "app.stock-videos.jsx","app.stock-audio.jsx","app.svg-assets.jsx",
  "app.platform-intelligence.jsx","app.builder-panel.$panel.jsx",
  "app.ai-agent.jsx","app.control-center.jsx","app.onboarding.jsx",
 ];
 for(const file of routes){
  const contents=readFileSync("app/routes/"+file,"utf8");
  const i=contents.indexOf("export async function action");
  assert(i>0,"Missing action "+file);
  assert.match(contents.slice(i),/paidMutationDenied\(db,\s*session\.shop\)/,
    "Unprotected merchant mutation entrypoint "+file);
 }
 const dashboard=readFileSync("app/services/dashboard-actions.server.js","utf8");
 const idx=dashboard.indexOf("export async function handleDashboardAction");
 assert(idx>=0);
 assert.match(dashboard.slice(idx),/isUnpaidDashboardExempt\(intent\)/);
 assert.match(dashboard.slice(idx),/paidMutationDenied\(db,\s*session\.shop\)/);
});
test("Shopify plan selection and support stay outside paid merchant action guard",()=>{
 const pricing=readFileSync("app/routes/app.plans.jsx","utf8");
 assert(!pricing.includes("paidMutationDenied("),"A merchant must be able to subscribe from inactive status");
 const guard=readFileSync("app/services/paid-mutation-guard.server.js","utf8");
 assert(!guard.includes("plan=null") && !guard.includes("...(plan?"),"Caller cannot inject a fake paid plan");
});

test("public review-link comments enforce verified paid plan BEFORE parsing or writing",()=>{
 const review=readFileSync("app/routes/review.$token.jsx","utf8");
 const action=review.slice(review.indexOf("export async function action"));
 assert(action.length>0,"Review action must exist");
 const verified=action.indexOf("const link = await validReviewLink(token)");
 const guard=action.indexOf("await paidMutationDenied(db,link.shop");
 const parse=action.indexOf("await request.formData()");
 const commentWrite=action.indexOf("await db.builderComment.create(");
 const auditWrite=action.indexOf("await db.builderAuditLog.create(");
 assert(verified>=0&&guard>verified&&parse>guard&&commentWrite>parse&&auditWrite>commentWrite,
   "Verified review token and merchant paid entitlement must gate BOTH database writes");
 assert.match(action.slice(guard,parse),/if\s*\(unpaid\)\s*return unpaid/);
 assert.doesNotMatch(action.slice(verified,commentWrite),/form\.get\(["']plan/i,
   "Review link must never accept a client-supplied paid entitlement");
});
test("public review-link cannot reopen writes for unpaid, canceled or frozen merchant",{
 concurrency:false
},async()=>{
 setProduction();
 try {
  const now=new Date();
  for(const row of [
   null,
   {provider:"shopify-app-pricing",status:"canceled",planKey:"gold",
    planHandle:"gold",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"frozen",planKey:"platinum",
    planHandle:"platinum",verifiedAt:now},
   {provider:"shopify-app-pricing",status:"active",planKey:"starter",
    planHandle:"free",verifiedAt:now},
  ]){
   const denied=await paidMutationDenied(dbWith(row),"review-owner.myshopify.com",{
    label:"VSN Builder review comments",
   });
   assert.equal(denied?.status,403);
   assert.equal((await denied.json()).success,false);
  }
  const valid={provider:"shopify-app-pricing",status:"trialing",planKey:"starter",
   planHandle:"starter",verifiedAt:now,trialEndsAt:new Date(now.getTime()+86400000)};
  assert.equal(await paidMutationDenied(dbWith(valid),"review-owner.myshopify.com",{
   label:"VSN Builder review comments",
  }),null);
 }finally{restoreMode();}
});
