import test from "node:test";
import assert from "node:assert/strict";
import { createWorkerShopifySessionContext } from "../app/services/shopify-worker-session-context.js";
import { SHOPIFY_EXPECTED_SCOPES } from "../app/config/shopifyIntegration.js";
import manifests from "../config/deployment/environments.json" with { type: "json" };

const allowed = (tier = "staging") => ({
 APP_ENV: tier,
 VSN_WORKER_NAME: tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
 NEON_PROJECT_ID: tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
 SHOPIFY_BILLING_TEST_MODE: tier==="staging"?"true":"false",
 // Production must use the canonical public Builder client ID (public, not a secret).
 SHOPIFY_API_KEY: tier==="staging"?"a".repeat(32):"997eae5a9961f21d131e5f31bbbe31d3",
 SHOPIFY_API_SECRET: "synthetic-secret-never-print",
 SHOPIFY_PRODUCTION_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3",
 SHOPIFY_APP_URL: tier==="staging"?"https://staging.builder.example.org":"https://builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 // The Worker pins the reviewed manifest endpoint host; credentials stay synthetic.
 DATABASE_URL:`postgresql://nonreal:mock@${manifests[tier].neon_endpoint_host}/neondb?sslmode=require`,
});
const makeRequest = env => new Request(env.SHOPIFY_APP_URL+"/app");
function dbStub(){
 let disconnected=0;
 return {session:{async count(){return 1}},builderShopInstallation:{async count(){return 1}},async $disconnect(){disconnected++},get closed(){return disconnected}};
}
class Storage {
 constructor(db,opts){this.db=db;this.opts=opts}
 async isReady(){return true}
 storeSession(){}
 loadSession(){}
 deleteSession(){}
 deleteSessions(){}
 findSessionsByShop(){}
}
test("creates real session-lifecycle contract only with an isolated valid tier",async()=>{
 const env=allowed(),db=dbStub();
 const ctx=await createWorkerShopifySessionContext(makeRequest(env),env,{
  createDatabase:async()=>db,SessionStorage:Storage
 });
 // The SDK storage is wrapped by the installation-generation fence.
 assert.equal(ctx.database,db);
 for(const m of ["storeSession","loadSession","deleteSession","findSessionsByShop"])assert.equal(typeof ctx.sessionStorage[m],"function");
 await ctx.close();await ctx.close();
 assert.equal(db.closed,1);
});
test("unverified or crossed database identity never triggers connection",async()=>{
 let invoked=false;const env=allowed("staging");
 for(const override of [{APP_ENV:"development"},{NEON_PROJECT_ID:"nameless-violet-68750490"},{SHOPIFY_API_KEY:"997eae5a9961f21d131e5f31bbbe31d3"},{SCOPES:"read_products"}]){
  const invalid={...env,...override};
  await assert.rejects(createWorkerShopifySessionContext(makeRequest(env),invalid,{createDatabase(){invoked=true}}),e=>e.code==="VSN_WORKER_SESSION_BLOCKED");
 }
 assert.equal(invoked,false);
});
test("broken database identity fails closed and sanitizes credentials",async()=>{
 const env=allowed(),db=dbStub();
 db.session.count=async()=>{throw new Error(env.DATABASE_URL+env.SHOPIFY_API_SECRET)};
 await assert.rejects(createWorkerShopifySessionContext(makeRequest(env),env,{createDatabase:()=>db,SessionStorage:Storage}),e=>{
  assert.equal(e.code,"VSN_WORKER_SESSION_UNAVAILABLE");
  assert(!e.message.includes("ep-fake"));
  assert(!e.message.includes("synthetic-secret"));
  return true;
 });
 assert.equal(db.closed,1);
});
test("missing session model refuses construction and disconnects",async()=>{
 const env=allowed();let closed=0;
 await assert.rejects(createWorkerShopifySessionContext(makeRequest(env),env,{createDatabase:()=>({session:{},async $disconnect(){closed++}}),SessionStorage:Storage}),e=>e.code==="VSN_WORKER_SESSION_UNAVAILABLE");
 assert.equal(closed,1);
});
test("SDK session storage readiness failure is a hard blocker and releases connection",async()=>{
 const env=allowed(),db=dbStub();
 class FailingStorage extends Storage {async isReady(){return false}}
 await assert.rejects(createWorkerShopifySessionContext(makeRequest(env),env,{createDatabase:()=>db,SessionStorage:FailingStorage}),e=>e.code==="VSN_WORKER_SESSION_UNAVAILABLE");
 assert.equal(db.closed,1);
});
test("Production uses an independent Worker and Neon project identity",async()=>{
 const env=allowed("production"),db=dbStub();
 const ctx=await createWorkerShopifySessionContext(makeRequest(env),env,{createDatabase:()=>db,SessionStorage:Storage});
 assert.equal(ctx.database,db);await ctx.close();
});
