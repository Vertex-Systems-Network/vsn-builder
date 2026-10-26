import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {
 acceptWorkerShopifyUninstallWebhook,normalizeWorkerWebhookFailure,
 normalizeVerifiedWorkerWebhookResult,parseValidShopifyWebhookUTC,
} from "../app/services/worker-shopify-webhook-gate.js";
import {createWorkerShopifySdkContext} from "../app/services/shopify-worker-sdk-context.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-webhook-ci-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:synthetic@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
};
const payload=JSON.stringify({id:123,shop_domain:"test-store.myshopify.com"});
const webhook=(data=payload,overrides={},method="POST")=>{
 const hmac=createHmac("sha256",env.SHOPIFY_API_SECRET).update(data).digest("base64");
 return new Request(env.SHOPIFY_APP_URL+"/webhooks/app/uninstalled",{
  method,headers:{
   "X-Shopify-Shop-Domain":"test-store.myshopify.com",
   "X-Shopify-Topic":"app/uninstalled",
   "X-Shopify-API-Version":"2026-10",
   "X-Shopify-Webhook-Id":"signed-ci-123",
   "X-Shopify-Triggered-At":"2026-10-13T09:00:00.000000Z",
   "X-Shopify-Hmac-Sha256":hmac,
   ...overrides,
  },...(method==="POST"?{body:data}:{})
 });
};
const storage=()=>({
 storeSession:async()=>true,loadSession:async()=>undefined,
 deleteSession:async()=>true,deleteSessions:async()=>true,
 findSessionsByShop:async()=>[]
});
const context=()=>{
 let opened=0,closed=0;
 return {
  create:async(request,settings)=>{
   opened++;
   const x=await createWorkerShopifySdkContext(request,settings,{
    createSessionContext:async()=>({sessionStorage:storage(),async close(){closed++}})
   });
   return x;
  },
  get opened(){return opened},get closed(){return closed}
 };
};
const result=async (request,envOverride=env,ctx=context(),onVerified=async()=>new Response(null,{status:204}))=>{
 try {
  const response=await acceptWorkerShopifyUninstallWebhook(request,envOverride,{
   createSdkContext:ctx.create,onVerified
  });
  return {status:response.status,ctx};
 }catch(e){
  if(e instanceof Response)return {status:e.status,ctx};
  throw e;
 }
};
test("signed webhook verified twice by WebCrypto and real Shopify SDK",async()=>{
 const c=context(),data=await result(webhook(),env,c,async({event,triggeredAt})=>{
  assert.equal(triggeredAt.toISOString(),"2026-10-13T09:00:00.000Z");
  assert.equal(event.shop,"test-store.myshopify.com");
  assert.equal(event.topic,"APP_UNINSTALLED");
  assert.equal(event.webhookId,"signed-ci-123");
  assert.equal(event.payload.shop_domain,"test-store.myshopify.com");
  return new Response(null,{status:204});
 });
 assert.equal(data.status,204);
 assert.equal(c.opened,1);
 assert.equal(c.closed,1);
});
test("tampered body rejects before database or Shopify SDK initialization",async()=>{
 const c=context();
 const req=webhook(payload+"X",{ "X-Shopify-Hmac-Sha256":createHmac("sha256",env.SHOPIFY_API_SECRET).update(payload).digest("base64")});
 const data=await result(req,env,c);
 assert.equal(data.status,401);
 assert.equal(c.opened,0);
});
test("wrong HMAC rejects with no database connection",async()=>{
 const c=context(),data=await result(webhook(payload,{"X-Shopify-Hmac-Sha256":"a".repeat(43)+"="}),env,c);
 assert.equal(data.status,401);
 assert.equal(c.opened,0);
});
test("unsigned or malformed webhook rejects with no database connection",async()=>{
 const c=context();
 for(const patch of [
  {"X-Shopify-Hmac-Sha256":""},
  {"X-Shopify-Shop-Domain":"evil.example.org"},
  {"X-Shopify-Topic":"orders/create"},
  {"X-Shopify-Webhook-Id":""},
  {"X-Shopify-API-Version":""},
  {"X-Shopify-Triggered-At":""},
  {"X-Shopify-Triggered-At":"invalid"},
 ])assert.equal((await result(webhook(payload,patch),env,c)).status,400);
 assert.equal(c.opened,0);
});
test("non-canonical Shopify domains reject valid signed body BEFORE SDK/DB",async()=>{
 const c=context();
 for(const shop of [
  "-starting.myshopify.com",
  "ending-.myshopify.com",
  "a".repeat(64)+".myshopify.com",
  "A.myshopify.com",
  "a.myshopify.com.evil.invalid",
 ]){
  const request=webhook(payload,{"X-Shopify-Shop-Domain":shop});
  const resultData=await result(request,env,c);
  assert.equal(resultData.status,400,shop);
 }
 assert.equal(c.opened,0);
 assert.equal(c.closed,0);
});

test("oversized signed payload is refused before SDK initialization",async()=>{
 const c=context();
 const big=JSON.stringify({data:"x".repeat(70000)});
 assert.equal((await result(webhook(big),env,c)).status,413);
 assert.equal(c.opened,0);
});
test("wrong Worker project is blocked before SDK and database access",async()=>{
 const c=context();
 const data=await result(webhook(),{...env,NEON_PROJECT_ID:"nameless-violet-68750490"},c);
 assert.equal(data.status,503);
 assert.equal(c.opened,0);
});
test("GET/route mismatch rejected before SDK",async()=>{
 const c=context();
 assert.equal((await result(webhook(payload,{},"GET"),env,c)).status,405);
 assert.equal((await result(new Request(env.SHOPIFY_APP_URL+"/wrong",{method:"POST",body:payload}),env,c)).status,404);
 assert.equal(c.opened,0);
});
test("missing idempotent cleanup callback cannot invoke SDK or database",async()=>{
 const c=context();
 const resp=await result(webhook(),env,c,null);
 assert.equal(resp.status,503);
 assert.equal(c.opened,0);
});
test("verified callback failure still closes SDK session context",async()=>{
 const c=context();
 await assert.rejects(acceptWorkerShopifyUninstallWebhook(webhook(),env,{
  createSdkContext:c.create,onVerified(){throw new Error("synthetic failure")}
 }),/synthetic failure/);
 assert.equal(c.opened,1);
 assert.equal(c.closed,1);
});

const streamWebhook=(stream,overrides={})=>{
 const sample=webhook();
 return new Request(sample.url,{
  method:"POST",
  headers:{...Object.fromEntries(sample.headers),...overrides},
  body:stream,
  duplex:"half",
 });
};
test("stalled signed webhook body times out before any database or Shopify SDK creation",async()=>{
 let cancelled=false;
 const source=new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array([65]))},
  cancel(){cancelled=true;return new Promise(()=>{})},
 });
 const c=context();
 const started=Date.now();
 const data=await result(streamWebhook(source),env,c);
 assert.equal(data.status,408);
 assert.equal(c.opened,0);
 assert.equal(cancelled,true);
 assert(Date.now()-started<6000,"deadline must not await malicious cancellation");
});
test("slow trickle cannot reset the TOTAL signed webhook read deadline",async()=>{
 let pulls=0;
 const source=new ReadableStream({
  async pull(controller){
   await new Promise(resolve=>setTimeout(resolve,120));
   pulls++;
   controller.enqueue(new Uint8Array([65]));
  },
 });
 const c=context(),started=Date.now();
 const data=await result(streamWebhook(source),env,c);
 assert.equal(data.status,408);
 assert.equal(c.opened,0);
 assert(pulls>2,"test must deliver multiple chunks");
 assert(Date.now()-started<6000,"trickle must not extend lifetime indefinitely");
});
test("oversized webhook stream with non-settling cancel is rejected without waiting",async()=>{
 let cancelled=false;
 const source=new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array(65537))},
  cancel(){cancelled=true;return new Promise(()=>{})},
 });
 const c=context(),started=Date.now();
 const data=await result(streamWebhook(source),env,c);
 assert.equal(data.status,413);
 assert.equal(c.opened,0);
 assert.equal(cancelled,true);
 assert(Date.now()-started<2000);
});
test("declared impossible webhook length fails before reading body or starting SDK",async()=>{
 const c=context();
 const data=await result(streamWebhook(new ReadableStream({
  pull(){throw Error("must not read")},
 }),{"content-length":"65537"}),env,c);
 assert.equal(data.status,413);
 assert.equal(c.opened,0);
});

test("verified cleanup may return only empty safe statuses, never redirects or credentials",async()=>{
 const c=context();
 for(const injected of [
  new Response(null,{status:302,headers:{
   location:"https://attacker.example.net/private",
   "set-cookie":"shopify-session=forged",
  }}),
  new Response("private shop token",{status:401}),
  new Response("private Neon details",{status:503}),
  new Response(null,{status:204,headers:{"set-cookie":"forged=yes"}}),
 ]){
  const output=await acceptWorkerShopifyUninstallWebhook(webhook(),env,{
   createSdkContext:c.create,onVerified:async()=>injected,
  });
  assert.equal(output.status,503);
  assert.equal(await output.text(),"");
  assert.equal(output.headers.get("set-cookie"),null);
  assert.equal(output.headers.get("location"),null);
  assert.equal(output.headers.get("retry-after"),"60");
 }
 assert.equal(c.opened,4);
 assert.equal(c.closed,4);
});

test("safe 204 and retryable cleanup failure preserve only trusted static transport",async()=>{
 const c=context();
 for(const status of [204,503]){
  const output=await acceptWorkerShopifyUninstallWebhook(webhook(),env,{
   createSdkContext:c.create,
   onVerified:async()=>new Response(null,{status,headers:{
    "x-secret-debug":"private-value","retry-after":"999999",
   }}),
  });
  assert.equal(output.status,status);
  assert.equal(await output.text(),"");
  assert.equal(output.headers.get("x-secret-debug"),null);
  assert.equal(output.headers.get("retry-after"),status===503?"60":null);
 }
 assert.equal(c.closed,2);
});

test("only gate-originated preverification denials may preserve their client status",async()=>{
 const c=context();
 let early;
 try{
  await acceptWorkerShopifyUninstallWebhook(webhook(payload,{},"GET"),env,{
   createSdkContext:c.create,onVerified:async()=>new Response(null,{status:204}),
  });
 }catch(error){early=error;}
 assert(early instanceof Response);
 assert.equal(normalizeWorkerWebhookFailure(early).status,405);
 assert.equal(c.opened,0);
 const forged=new Response(null,{status:401,headers:{
  location:"https://attacker.example.net", "set-cookie":"x=1",
 }});
 const normalized=normalizeWorkerWebhookFailure(forged);
 assert.equal(normalized.status,503);
 assert.equal(normalized.headers.get("set-cookie"),null);
 assert.equal(normalized.headers.get("location"),null);
 assert.equal(normalized.headers.get("retry-after"),"60");
 assert.equal(normalizeVerifiedWorkerWebhookResult({}).status,503);
});


test("UTC Shopify timestamp parser rejects Gregorian-invalid dates without normalization",()=>{
 const invalid=[
  "2026-02-30T09:00:00Z",
  "2026-02-29T09:00:00Z",
  "2026-04-31T00:00:00Z",
  "2026-13-01T00:00:00Z",
  "2026-00-01T00:00:00Z",
  "2026-10-00T00:00:00Z",
  "2026-10-13T24:00:00Z",
  "2026-10-13T01:60:00Z",
  "2026-10-13T01:00:60Z",
  "2026-10-13T09:00:00+00:00",
  "2026-10-13T09:00:00.1234567890Z",
  "2026-10-13T09:00:00.123456789-00:00",
  "2026-10-13T09:00:00.123456789Zextra",
 ];
 for(const value of invalid)
   assert.equal(parseValidShopifyWebhookUTC(value),null,value);
 for(const [value,iso] of [
  ["2028-02-29T23:59:59Z","2028-02-29T23:59:59.000Z"],
  ["2026-10-13T09:00:00.123456789Z","2026-10-13T09:00:00.123Z"],
  ["2026-12-31T23:59:59.999Z","2026-12-31T23:59:59.999Z"],
 ]){
   const result=parseValidShopifyWebhookUTC(value);
   assert(result instanceof Date,value);
   assert.equal(result.toISOString(),iso,value);
 }
});
test("impossible signed webhook timestamp denies before Shopify SDK/DB, including authentic body",async()=>{
 const c=context();
 for(const date of [
  "2026-02-30T09:00:00Z",
  "2026-04-31T09:00:00.000Z",
  "2026-10-13T24:00:00Z",
  "2026-02-29T09:00:00Z",
 ]){
   const response=await result(webhook(payload,{"X-Shopify-Triggered-At":date}),env,c);
   assert.equal(response.status,400,date);
 }
 assert.equal(c.opened,0);
 assert.equal(c.closed,0);
});
test("valid nine-digit fractional timestamp survives two independent webhook signatures",async()=>{
 const c=context();
 const data=await result(webhook(payload,{
  "X-Shopify-Triggered-At":"2028-02-29T23:59:59.987654321Z",
 }),env,c,async({triggeredAt,event})=>{
   assert.equal(event.shop,"test-store.myshopify.com");
   assert.equal(triggeredAt.toISOString(),"2028-02-29T23:59:59.987Z");
   return new Response(null,{status:204});
 });
 assert.equal(data.status,204);
 assert.equal(c.opened,1);
 assert.equal(c.closed,1);
});
