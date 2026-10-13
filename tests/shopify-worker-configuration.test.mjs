import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectWorkerShopifyConfiguration,
  createShopifyWorkerSdk,
} from "../app/services/shopify-worker-configuration.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const envFor=(tier)=>({
 APP_ENV:tier,
 VSN_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
 NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
 SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
 SHOPIFY_API_KEY:tier==="staging"?"a".repeat(32):"b".repeat(32),
 SHOPIFY_API_SECRET:"synthetic-secret-must-not-be-logged",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:tier==="staging"?"https://staging.builder.example.org":"https://builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(",")
});
const request=(env)=>new Request(env.SHOPIFY_APP_URL+"/app");

test("only exact staging and production identities pass request origin checks",()=>{
 for(const tier of ["staging","production"]){
  const env=envFor(tier);
  assert.deepEqual(inspectWorkerShopifyConfiguration(request(env),env),{ready:true,tier,issues:[]});
 }
});
test("missing config never becomes production-ready",()=>{
 assert.equal(inspectWorkerShopifyConfiguration(new Request("https://bad.example.org/"),{}).ready,false);
 assert.equal(inspectWorkerShopifyConfiguration(new Request("https://bad.example.org/"),{APP_ENV:"development"}).ready,false);
});
test("request spoofing and reverse-proxy origin drift are rejected",()=>{
 const env=envFor("staging");
 const actual=new Request("https://wrong.builder.example.org/app");
 const result=inspectWorkerShopifyConfiguration(actual,env);
 assert.equal(result.ready,false);
 assert(result.issues.includes("Incoming request origin differs from Shopify app URL"));
});
test("unverified app URLs and dev tunnels cannot be installed",()=>{
 const env=envFor("staging");
 for(const url of ["http://staging.builder.example.org","https://localhost:8787","https://sample.trycloudflare.com",
                   "https://staging.builder.example.org/not-root","https://user:password@staging.builder.example.org"]){
  const check=inspectWorkerShopifyConfiguration(new Request("https://staging.builder.example.org/app"),{...env,SHOPIFY_APP_URL:url});
  assert.equal(check.ready,false,url);
 }
});
test("scopes cannot be widened or silently reduced",()=>{
 const env=envFor("staging");
 assert.equal(inspectWorkerShopifyConfiguration(request(env),{...env,SCOPES:"read_products"}).ready,false);
 assert.equal(inspectWorkerShopifyConfiguration(request(env),{...env,SCOPES:env.SCOPES+",write_orders"}).ready,false);
});
test("production client ID cannot be reused in Staging",()=>{
 const env=envFor("staging"); env.SHOPIFY_API_KEY=env.SHOPIFY_PRODUCTION_CLIENT_ID;
 assert.equal(inspectWorkerShopifyConfiguration(request(env),env).ready,false);
});
test("cross-tier Worker/Neon IDs, production billing and Client ID mismatches fail",()=>{
 const env=envFor("production");
 const check=inspectWorkerShopifyConfiguration(request(env),{...env,
   NEON_PROJECT_ID:"shiny-violet-61219572",
   VSN_WORKER_NAME:"vsn-builder-staging",
   SHOPIFY_BILLING_TEST_MODE:"true",
   SHOPIFY_PRODUCTION_CLIENT_ID:"a".repeat(32)
 });
 assert.equal(check.ready,false);
 assert.equal(check.issues.length,4);
});
test("Shopify SDK constructor needs persistent session storage and verified platform wiring",()=>{
 const env=envFor("staging");
 assert.throws(()=>createShopifyWorkerSdk(request(env),env,{}),/persistent session storage/);
 let received;
 const fakeStorage={storeSession(){},loadSession(){}};
 const sdk=createShopifyWorkerSdk(request(env),env,{
   createSdk(config){received=config;return {configured:true}},
   sessionStorage:fakeStorage,
   distribution:"app_store_test"
 });
 assert.equal(sdk.configured,true);
 assert.equal(received.apiVersion,"2026-07");
 assert.equal(received.authPathPrefix,"/auth");
 assert.equal(received.useOnlineTokens,true);
 assert.equal(received.sessionStorage,fakeStorage);
 assert.equal(received.scopes.length,SHOPIFY_EXPECTED_SCOPES.length);
});
test("configuration errors never expose Shopify secrets or client values",()=>{
 const env=envFor("production");env.SHOPIFY_BILLING_TEST_MODE="true";
 assert.throws(()=>createShopifyWorkerSdk(request(env),env,{}),(err)=>{
  assert.equal(err.code,"VSN_WORKER_SHOPIFY_NOT_READY");
  assert(!err.message.includes(env.SHOPIFY_API_SECRET));
  assert(!err.message.includes(env.SHOPIFY_API_KEY));
  return true;
 });
});
test("SDK failure is sanitized before returning to caller",()=>{
 const env=envFor("staging");
 assert.throws(()=>createShopifyWorkerSdk(request(env),env,{
   createSdk(){throw new Error(env.SHOPIFY_API_SECRET)},
   sessionStorage:{storeSession(){},loadSession(){}},
   distribution:"test-app-store"
 }),err=>err.message==="Shopify Worker SDK initialization failed");
});
