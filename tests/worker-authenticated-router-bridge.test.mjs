import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {createRequestHandler} from "react-router";
import {createAuthenticatedWorkerRouterBridge} from "../app/services/worker-authenticated-router-bridge.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const host="https://staging.builder.example.org";
const shop="ci-verified-shop.myshopify.com";
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-not-real",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_APP_URL:host,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci:ci@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const path="/app/__vsn-auth-smoke";
const signed={id:"offline_"+shop,shop,state:"",isOnline:false,accessToken:"fake-token-never-export"};
const active={shop,installedAt:new Date("2026-10-13T10:00:00Z"),uninstalledAt:null};
const makeRequest=(target=path,opts={})=>new Request(host+target,opts);
const loadBuild=()=>import("../tests/fixtures/t020-vite-build/build/server/index.js");

function setup({sdkSession=signed,dbSession=signed,installation=active,throwAuth,failDb=false}={}){
 const calls=[];
 const context={
  shopify:{authenticate:{async admin(request){
    calls.push("shopify-authenticated-request");
    if(throwAuth)throw throwAuth;
    return {session:sdkSession,admin:{graphql:()=>{throw Error("not called")}}};
  }}},
  database:{
    builderShopInstallation:{async findUnique(){
      calls.push("installation-check");
      if(failDb)throw Error("DATABASE_URL=secret");
      return installation;
    }},
    session:{async findUnique(){
      calls.push("persisted-session-check");
      return dbSession;
    }},
  },
  async close(){calls.push("disconnect");},
 };
 const createSdkContext=async()=>{calls.push("open");return context;};
 const gateway=createAuthenticatedWorkerRouterBridge({
  makeRequestHandler:createRequestHandler,
  loadServerBuild:loadBuild,
  createSdkContext,
 });
 return {gateway,calls,createSdkContext};
}

test("real Vite-generated authenticated loader gets Shopify-verified tenant only",async()=>{
 assert(existsSync("tests/fixtures/t020-vite-build/build/server/index.js"));
 const {gateway,calls}=setup();
 const result=await gateway.fetch(makeRequest(),env,{waitUntil(){}});
 assert.equal(result.status,200);
 const html=await result.text();
 assert.match(html,/Authenticated VSN Builder routing proof/);
 assert.match(html,/ci-verified-shop\.myshopify\.com/);
 assert.doesNotMatch(html,/fake-token-never-export|synthetic-not-real|postgresql:/);
 assert.equal(result.headers.get("set-cookie"),null);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.match(result.headers.get("content-security-policy"),/frame-ancestors 'none'/);
 assert.deepEqual(calls,["open","shopify-authenticated-request",
   "installation-check","persisted-session-check","disconnect"]);
});

test("SDK session must match persisted store and installation before loader executes",async()=>{
 for(const opts of [
   {sdkSession:null},
   {sdkSession:{...signed,shop:"other.myshopify.com"}},
   {dbSession:null},
   {dbSession:{...signed,accessToken:"rotated-old-token"}},
   {dbSession:{...signed,shop:"cross-tenant.myshopify.com"}},
   {installation:null},
   {installation:{...active,uninstalledAt:new Date()}},
   {installation:{...active,installedAt:"not-a-date"}},
   {sdkSession:{...signed,expires:new Date("2020-01-01")}},
   {failDb:true},
 ]){
   const {gateway,calls}=setup(opts);
   const result=await gateway.fetch(makeRequest(),env);
   assert([401,403,503].includes(result.status),JSON.stringify(opts));
   assert.equal(await result.text(),"");
   assert(!calls.includes("route-loader-executed"));
   assert.equal(calls.at(-1),"disconnect");
 }
});

test("forged ?shop, malicious paths and mutation methods cannot reach Shopify context",async()=>{
 const {gateway,calls}=setup();
 for(const pathname of [
   "/auth/callback","/webhooks/app/uninstalled","/billing","/app",
   "/app/pages","/app/__vsn-auth-smoke?host=fake",
   "/app/__vsn-auth-smoke?shop=ci-verified-shop.myshopify.com&host=evil",
 ]){
   const res=await gateway.fetch(makeRequest(pathname),env);
   assert.equal(res.status,404,pathname);
 }
 for(const method of ["POST","PATCH","DELETE","PUT"]){
   assert.equal((await gateway.fetch(makeRequest(path,{method}),env)).status,404);
 }
 assert.deepEqual(calls,[]);
 const wrong=await gateway.fetch(makeRequest(path+"?shop=another.myshopify.com"),env);
 assert.equal(wrong.status,401);
 assert.equal(calls.at(-1),"disconnect");
});

test("wrong Worker tier and missing credentials cannot open database or Shopify SDK",async()=>{
 const {gateway,calls}=setup();
 for(const invalid of [
   {...env,APP_ENV:"production"},
   {...env,VSN_WORKER_NAME:"vsn-builder-production"},
   {...env,NEON_PROJECT_ID:"nameless-violet-68750490"},
   {...env,SHOPIFY_API_SECRET:""},
   {...env,DATABASE_URL:""},
   {...env,SHOPIFY_BILLING_TEST_MODE:"false"},
 ]){
   const r=await gateway.fetch(makeRequest(),invalid);
   assert.equal(r.status,503);
 }
 assert.deepEqual(calls,[]);
});

test("official Shopify thrown reauth response is forwarded and context closed",async()=>{
 const redirect=new Response(null,{status:302,headers:{
   location:"https://admin.shopify.com/store/ci/auth",
   "set-cookie":"shopify-reauth=test; Secure; HttpOnly",
 }});
 const {gateway,calls}=setup({throwAuth:redirect});
 const r=await gateway.fetch(makeRequest(),env);
 assert.equal(r,redirect);
 assert.equal(r.headers.get("set-cookie"),redirect.headers.get("set-cookie"));
 assert.deepEqual(calls,["open","shopify-authenticated-request","disconnect"]);
});

test("invalid/missing Vite handler rejects safely and does not leak SDK tokens",async()=>{
 const {calls,createSdkContext}=setup();
 const gateway=createAuthenticatedWorkerRouterBridge({
  makeRequestHandler:()=>()=>new Response("fake-token-never-export",{status:200,
    headers:{"content-type":"application/json"}}),
  loadServerBuild:loadBuild,createSdkContext,
 });
 const response=await gateway.fetch(makeRequest(),env);
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.deepEqual(calls,["open","shopify-authenticated-request",
   "installation-check","persisted-session-check","disconnect"]);
 // Null route-handler factories fail closed before an auth attempt.
 const missing=createAuthenticatedWorkerRouterBridge({
   makeRequestHandler:null,loadServerBuild:loadBuild,
 });
 assert.equal((await missing.fetch(makeRequest(),env)).status,503);
});
