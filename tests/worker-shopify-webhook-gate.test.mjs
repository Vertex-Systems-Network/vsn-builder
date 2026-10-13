import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {acceptWorkerShopifyUninstallWebhook} from "../app/services/worker-shopify-webhook-gate.js";
import {createWorkerShopifySdkContext} from "../app/services/shopify-worker-sdk-context.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-webhook-ci-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:synthetic@ep-ci.aws.neon.tech/ci?sslmode=require"
};
const payload=JSON.stringify({id:123,shop_domain:"test-store.myshopify.com"});
const webhook=(data=payload,overrides={},method="POST")=>{
 const hmac=createHmac("sha256",env.SHOPIFY_API_SECRET).update(data).digest("base64");
 return new Request(env.SHOPIFY_APP_URL+"/webhooks/app/uninstalled",{
  method,headers:{
   "X-Shopify-Shop-Domain":"test-store.myshopify.com",
   "X-Shopify-Topic":"app/uninstalled",
   "X-Shopify-API-Version":"2026-07",
   "X-Shopify-Webhook-Id":"signed-ci-123",
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
 const c=context(),data=await result(webhook(),env,c,async({event})=>{
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
 ])assert.equal((await result(webhook(payload,patch),env,c)).status,400);
 assert.equal(c.opened,0);
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
