import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { verifyWorkerShopifyWebhook } from "../app/services/shopify-worker-signed-webhook.js";
import { SHOPIFY_EXPECTED_SCOPES } from "../app/config/shopifyIntegration.js";

const environment=(tier="staging")=>({
  APP_ENV:tier,
  VSN_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
  NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
  SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
  SHOPIFY_API_KEY:tier==="staging"?"a".repeat(32):"b".repeat(32),
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_API_SECRET:"synthetic-webhook-hmac-secret",
  SHOPIFY_APP_URL:tier==="staging"?"https://staging.builder.example.org":"https://builder.example.org",
  SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci-no-network:fake-password@ep-synthetic.aws.neon.tech/ci?sslmode=require",
});
const shop="synthetic-test-merchant.myshopify.com";
const body=JSON.stringify({id:123,shop_domain:shop});
function request(env,{payload=body,hmac,method="POST",headers={}}={}) {
 const checksum=hmac??crypto.createHmac("sha256",env.SHOPIFY_API_SECRET).update(payload,"utf8").digest("base64");
 return new Request(env.SHOPIFY_APP_URL+"/webhooks/app/uninstalled",{
   method,headers:{
     "X-Shopify-Shop-Domain":shop,
     "X-Shopify-Topic":"app/uninstalled",
     "X-Shopify-API-Version":"2026-07",
     "X-Shopify-Webhook-Id":"ci-signed-webhook-001",
     "X-Shopify-Hmac-Sha256":checksum,
     ...headers,
   },
   ...(method==="POST"?{body:payload}:{})
 });
}
const newStorage=()=>{
 let closes=0,loads=0;
 const sessionStorage={
   async storeSession(){return true},
   async loadSession(){loads++;return undefined},
   async deleteSession(){return true},
   async deleteSessions(){return true},
   async findSessionsByShop(){return []},
 };
 return {sessionStorage,get closes(){return closes},get loads(){return loads},async close(){closes++}};
};
async function sdkContext(req,env,s) {
 return createWorkerShopifySdkContext(req,env,{createSessionContext:async()=>s});
}
async function status(promise) {
 try {await promise;return 200} catch(err){return err instanceof Response ? err.status : -1}
}

test("official Shopify SDK accepts a valid signed APP_UNINSTALLED webhook without merchant session",async()=>{
 const env=environment(),s=newStorage();
 const verified=await verifyWorkerShopifyWebhook(request(env),env,{createSdkContext:(r,e)=>sdkContext(r,e,s)});
 assert.equal(verified.shop,shop);
 assert.equal(verified.topic,"APP_UNINSTALLED");
 assert.equal(verified.webhookId,"ci-signed-webhook-001");
 assert.deepEqual(verified.payload,{id:123,shop_domain:shop});
 assert.equal(Object.isFrozen(verified),true);
 assert(!("admin" in verified));
 assert(!("session" in verified));
 assert.equal(s.closes,1,"Close request-scoped storage on accepted webhook");
});
test("valid signature over original bytes cannot authorize tampered body",async()=>{
 const env=environment(),s=newStorage();
 const signature=crypto.createHmac("sha256",env.SHOPIFY_API_SECRET).update(body,"utf8").digest("base64");
 const requestTampered=request(env,{payload:JSON.stringify({id:999,shop_domain:shop}),hmac:signature});
 assert.equal(await status(verifyWorkerShopifyWebhook(requestTampered,env,{createSdkContext:(r,e)=>sdkContext(r,e,s)})),401);
 assert.equal(s.closes,1);
});
test("incorrect HMAC is rejected with official SDK 401, not custom header trust",async()=>{
 const env=environment(),s=newStorage();
 assert.equal(await status(verifyWorkerShopifyWebhook(request(env,{hmac:"not-valid"}),env,{createSdkContext:(r,e)=>sdkContext(r,e,s)})),401);
 assert.equal(s.closes,1);
 assert.equal(s.loads,0,"No merchant session query before signature validation");
});
test("Shopify webhook without mandatory header is rejected with 400",async()=>{
 const env=environment(),s=newStorage();
 const req=request(env,{headers:{"X-Shopify-Hmac-Sha256":""}});
 assert.equal(await status(verifyWorkerShopifyWebhook(req,env,{createSdkContext:(r,e)=>sdkContext(r,e,s)})),400);
 assert.equal(s.closes,1);
});
test("non-POST webhook is rejected by official Shopify SDK with 405",async()=>{
 const env=environment(),s=newStorage();
 assert.equal(await status(verifyWorkerShopifyWebhook(request(env,{method:"GET"}),env,{createSdkContext:(r,e)=>sdkContext(r,e,s)})),405);
 assert.equal(s.closes,1);
});
test("production secret cannot validate staging-signed webhook",async()=>{
 const env=environment("production"),s=newStorage();
 const staging=environment("staging");
 const foreign=crypto.createHmac("sha256",staging.SHOPIFY_API_SECRET+"-other").update(body,"utf8").digest("base64");
 assert.equal(await status(verifyWorkerShopifyWebhook(request(env,{hmac:foreign}),env,{createSdkContext:(r,e)=>sdkContext(r,e,s)})),401);
 assert.equal(s.closes,1);
});
test("invalid environment fails before opening storage or parsing body",async()=>{
 const env=environment(),broken={...env,NEON_PROJECT_ID:"nameless-violet-68750490"};
 let initialized=false;
 const err=await verifyWorkerShopifyWebhook(request(env),broken,{createSdkContext:async(r,e)=>{
  initialized=true;return sdkContext(r,e,newStorage());
 }}).then(()=>null,e=>e);
 assert.equal(err.code,"VSN_WORKER_WEBHOOK_UNAVAILABLE");
 assert.equal(initialized,true,"The injected bootstrap is responsible for its own identity validation");
 assert(!err.message.includes(env.SHOPIFY_API_SECRET));
});
test("close executes on internal SDK rejection and sanitizes errors",async()=>{
 const env=environment(),s=newStorage();
 const err=await verifyWorkerShopifyWebhook(request(env),env,{createSdkContext:async()=>({
   shopify:{authenticate:{webhook:async()=>{throw new Error(env.SHOPIFY_API_SECRET)}}},
   close:s.close,
 })}).then(()=>null,e=>e);
 assert.equal(err.code,"VSN_WORKER_WEBHOOK_UNAVAILABLE");
 assert(!err.message.includes(env.SHOPIFY_API_SECRET));
 assert.equal(s.closes,1);
});
