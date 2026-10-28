import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerShopifySessionContext} from "../app/services/shopify-worker-session-context.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const settings={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",
 SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),
 SHOPIFY_API_SECRET:"synthetic-no-real-merchant-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://fake:test@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const request=new Request(settings.SHOPIFY_APP_URL+"/app?shop=test-shop.myshopify.com");
class FakeOfficialStorage{
 constructor(db){this.db=db;}
 async storeSession(){return true;}
 async loadSession(){return undefined;}
 async deleteSession(){return true;}
 async deleteSessions(){return true;}
 async findSessionsByShop(){return [];}
 async isReady(){return true;}
}
function fakeDatabase({missingLifecycle=false,failLifecycle=false}={}){
 const calls=[];
 const db={
  session:{async count(){calls.push("session.count");return 0;}},
  async $disconnect(){calls.push("disconnect")},
 };
 if(!missingLifecycle)db.builderShopInstallation={
  async count(){
   calls.push("installation.count");
   if(failLifecycle)throw Error("postgres://private-password@database.invalid");
   return 0;
  }
 };
 return {db,calls};
}
test("Worker SDK context verifies both real model tables before creating SessionStorage",async()=>{
 const {db,calls}=fakeDatabase();
 const ctx=await createWorkerShopifySessionContext(request,settings,{
  createDatabase:async()=>db,SessionStorage:FakeOfficialStorage,
 });
 assert.deepEqual(calls,["session.count","installation.count"]);
 assert.equal(typeof ctx.sessionStorage.storeSession,"function");
 assert.equal(typeof ctx.sessionStorage.loadSession,"function");
 await ctx.close();
 await ctx.close();
 assert.deepEqual(calls,["session.count","installation.count","disconnect"]);
});
test("missing hosted installation model closes DB without returning SDK storage",async()=>{
 const {db,calls}=fakeDatabase({missingLifecycle:true});
 let storageStarted=0;
 class Storage extends FakeOfficialStorage{constructor(...args){super(...args);storageStarted++}}
 await assert.rejects(createWorkerShopifySessionContext(request,settings,{
  createDatabase:async()=>db,SessionStorage:Storage,
 }),err=>{
  assert.equal(err.code,"VSN_WORKER_SESSION_UNAVAILABLE");
  assert(!err.message.includes(settings.SHOPIFY_API_SECRET));
  return true;
 });
 assert.deepEqual(calls,["disconnect"]);
 assert.equal(storageStarted,0);
});
test("unmigrated hosted lifecycle table errors are sanitized and DB is disconnected",async()=>{
 const {db,calls}=fakeDatabase({failLifecycle:true});
 await assert.rejects(createWorkerShopifySessionContext(request,settings,{
  createDatabase:async()=>db,SessionStorage:FakeOfficialStorage,
 }),err=>{
  assert.equal(err.code,"VSN_WORKER_SESSION_UNAVAILABLE");
  assert(!err.message.includes("private-password"));
  return true;
 });
 assert.deepEqual(calls,["session.count","installation.count","disconnect"]);
});
test("cross-tier Neon identity is rejected before constructing any database",async()=>{
 let created=0;
 await assert.rejects(createWorkerShopifySessionContext(request,{
  ...settings,NEON_PROJECT_ID:"nameless-violet-68750490",
 },{
  createDatabase(){created++;}
 }),{code:"VSN_WORKER_SESSION_BLOCKED"});
 assert.equal(created,0);
});
