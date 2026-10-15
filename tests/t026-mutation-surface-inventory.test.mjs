// T026: future merchant action endpoints must not silently bypass paid checks.
import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {paidMutationDenied} from "../app/services/paid-mutation-guard.server.js";

const read=path=>readFileSync(path,"utf8");
const actionSource=/export\s+(?:(?:async\s+)?function\s+action\b|const\s+action\s*=)/;
// Exact, intentionally narrow exceptions: must remain accessible before billing.
// Each exception has an independent authentication/scope gate.
const EXEMPT_APP_ACTIONS=Object.freeze({
 "app.jsx":"handleDashboardAction",
 "app._index.jsx":"handleDashboardAction",
 "app.plans.jsx":"authenticate.admin",
 "app.client-errors.jsx":"authenticate.admin",
});
function scanAppActions(sources){
 const failures=[];
 const matches=[];
 for(const [name,source] of Object.entries(sources)){
  if(!name.startsWith("app.") && name!=="app.jsx")continue;
  if(!actionSource.test(source))continue;
  matches.push(name);
  const exception=EXEMPT_APP_ACTIONS[name];
  if(exception){
   if(!source.includes(exception))failures.push("Exception lost trusted path: "+name);
  }else if(!/paidMutationDenied\s*\(\s*db\s*,\s*session\.shop\s*\)/.test(source)){
   failures.push("Merchant mutation without paid guard: "+name);
  }
 }
 return {failures,matches};
}

test("every authenticated /app action is paid guarded or precisely allowlisted",()=>{
 const files=readdirSync("app/routes").filter(x=>x.endsWith(".jsx")&&(x==="app.jsx"||x.startsWith("app.")));
 const sources=Object.fromEntries(files.map(name=>[name,read("app/routes/"+name)]));
 const proof=scanAppActions(sources);
 assert.deepEqual(proof.failures,[]);
 assert(proof.matches.length>=30,"Action inventory unexpectedly shrank");
 for(const name of Object.keys(EXEMPT_APP_ACTIONS)){
  assert(proof.matches.includes(name),"Exception action disappeared: "+name);
 }
});
test("new or renamed /app mutation without a server paid guard fails audit",()=>{
 const attack={
  "app.future-free-writes.jsx":"export async function action({request}){await db.builderPage.create({data:{}});}",
  "app.pages.jsx":"export async function action(){return db.builderPage.update({data:{}});}",
 };
 assert.equal(scanAppActions(attack).failures.length,2);
});
test("signed storefront proxy denies unpaid before EVERY customer-facing write path",()=>{
 const file=read("app/routes/builder-proxy-secure.$.jsx");
 assert.match(file,/authenticate\.public\.appProxy\(request\)/);
 assert.match(file,/paidMutationDenied\(db,\s*session\.shop\)/);
 const guard=file.indexOf("paidMutationDenied(db, session.shop)");
 for(const operation of ["boundedStorefrontFormData(request)","handleWishlistProxyAction(","handleStorefrontFormSubmission(","recordExperimentEvent(","handleLegacyStorefrontFormSubmission("]){
  assert(file.indexOf(operation)>guard,"Guard must precede "+operation);
 }
 assert.match(file,/This storefront feature is currently unavailable/);
 assert.doesNotMatch(file,/entitlementBlock\.json\(/);
});
test("review comments require a verified paid plan, but signed token remains distinct",()=>{
 const file=read("app/routes/review.$token.jsx");
 assert.match(file,/validReviewLink\(token\)/);
 assert.match(file,/paidMutationDenied\(db,\s*link\.shop\)/);
 assert(file.indexOf("paidMutationDenied(db, link.shop)")<file.indexOf("db.builderComment.create("));
 assert(file.indexOf("paidMutationDenied(db, link.shop)")<file.indexOf("db.builderAuditLog.create("));
 assert.match(file,/Comments are currently unavailable/);
});
test("billing and trusted platform system actions are never incorrectly charged",()=>{
 const plans=read("app/routes/app.plans.jsx");
 assert.match(plans,/authenticate\.admin\(request\)/);
 assert.doesNotMatch(plans,/paidMutationDenied\(/);
 const shell=read("app/services/dashboard-actions.server.js");
 assert.match(shell,/isUnpaidDashboardExempt\(intent\)/);
 assert.match(shell,/paidMutationDenied\(db,\s*session\.shop\)/);
 for(const path of [
  "app/routes/webhooks.app.uninstalled.jsx",
  "app/routes/webhooks.shop.redact.jsx",
  "app/routes/webhooks.customers.redact.jsx",
 ]){
  assert.match(read(path),/authenticate\.webhook\(request\)/);
 }
 const cleanup=read("app/routes/internal.cleanup.jsx");
 assert.match(cleanup,/authorized\(request\)/);
});
test("real subscription mirror rejects unauthorized storefront/review writes", {concurrency:false},async()=>{
 const before=process.env.NODE_ENV;
 process.env.NODE_ENV="production";
 try {
  const shop="storefront.myshopify.com";
  const inactive={builderSubscription:{findUnique:async()=>null}};
  const denied=await paidMutationDenied(inactive,shop);
  assert.equal(denied.status,403);
  assert.equal((await denied.json()).code,"VSN_PLAN_TIER_REQUIRED");
  const now=new Date();
  const subscribed={builderSubscription:{findUnique:async()=>({
   provider:"shopify-app-pricing",status:"active",planKey:"starter",
   planHandle:"starter",verifiedAt:now,
  })}};
  assert.equal(await paidMutationDenied(subscribed,shop),null);
  const canceled={builderSubscription:{findUnique:async()=>({
   provider:"shopify-app-pricing",status:"canceled",planKey:"starter",
   planHandle:"starter",verifiedAt:now,
  })}};
  assert.equal((await paidMutationDenied(canceled,shop)).status,403);
 }finally{
  if(before===undefined)delete process.env.NODE_ENV;
  else process.env.NODE_ENV=before;
 }
});
