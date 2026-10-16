import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {handleVerifiedStagingShopifyAuth} from "../app/services/worker-shopify-staging-auth.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
import worker from "../workers/app.js";

const shop="one.myshopify.com";
const origin="https://staging.builder.example.org";
const at=()=>new Date(Date.now()+60000);
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"not-a-real-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/db?sslmode=require",
 VSN_STAGING_OAUTH_ENABLED:"true",
};
const req=(suffix="/auth/callback?shop="+shop)=>new Request(origin+suffix);
const ses=()=>({
 id:"online_one.myshopify.com_17",shop,accessToken:"private-oauth-token",
 isOnline:true,expires:at(),
});
function fixture({
 session=ses(),stored,install,denySdk=false,throwResponse=null,
 noRedirect=false,returnInvalidRedirect=false,dbError=false,
}={}){
 const calls=[];
 const expected=stored===undefined?{...session}:stored;
 const installation=install===undefined?{
  shop,installedAt:new Date("2026-10-16T02:00:00Z"),uninstalledAt:null,
 }:install;
 const context={
  shopify:{authenticate:{admin:async(request)=>{
   calls.push(["official-admin",request.url]);
   if(throwResponse)throw throwResponse;
   if(denySdk)throw Error("private shopify app secret");
   return {session,redirect:noRedirect?null:async(path)=>{
    calls.push(["sdk-redirect",path]);
    if(returnInvalidRedirect)return Response.json({privateToken:"bad"}, {status:200});
    const headers=new Headers({"location":origin+path,
     "set-cookie":"oauth-transport=shopify; HttpOnly; Secure; SameSite=None"});
    return new Response(null,{status:302,headers});
   }};
  }}},
  database:{
   builderShopInstallation:{async findUnique({where}){
    calls.push(["installation",where]);if(dbError)throw Error("Neon supersecret credentials");
    return installation;
   }},
   session:{async findUnique({where}){
    calls.push(["session",where]);return expected;
   }},
  },
  async close(){calls.push(["close"]);}
 };
 return {calls,createSdkContext:async()=>{calls.push(["context"]);return context}};
}
const invoke=(fixtureOptions={},cfg=env,request=req())=>{
 const f=fixture(fixtureOptions);
 return {f,promise:handleVerifiedStagingShopifyAuth(request,cfg,{
   createSdkContext:f.createSdkContext,
 })};
};

test("real Staging SDK callback redirects only after authenticated durable session and installation",async()=>{
 const {f,promise}=invoke();
 const result=await promise;
 assert.equal(result.status,302);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.equal(result.headers.get("x-content-type-options"),"nosniff");
 assert.equal(result.headers.get("location"),origin+"/app?shop="+shop);
 assert.match(result.headers.get("set-cookie"),/oauth-transport=shopify/);
 assert.deepEqual(f.calls.map(x=>x[0]),[
  "context","official-admin","installation","session","sdk-redirect","close",
 ]);
 assert.deepEqual(f.calls[2][1],{shop});
 assert.deepEqual(f.calls[3][1],{id:ses().id});
 assert.equal(f.calls[4][1],"/app?shop="+shop);
 assert(!JSON.stringify(f.calls).includes("private-oauth-token"));
});

test("real Shopify SDK-thrown reauthorization Response is passed unchanged including cookies",async()=>{
 const signed=Response.redirect(origin+"/auth/login?shop="+shop,302);
 const {f,promise}=invoke({throwResponse:signed});
 const response=await promise;
 assert.strictEqual(response,signed);
 assert.deepEqual(f.calls.map(x=>x[0]),["context","official-admin","close"]);
 assert.equal(response.headers.get("location"),origin+"/auth/login?shop="+shop);
});

test("opt-in refuses Production, feature disabled and cross-tier identity before SDK/database I/O",async()=>{
 for(const cfg of [
  {...env,VSN_STAGING_OAUTH_ENABLED:undefined},
  {...env,VSN_STAGING_OAUTH_ENABLED:"false"},
  {...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},
  {...env,VSN_WORKER_NAME:"vsn-builder-production"},
  {...env,DATABASE_URL:""},
  {...env,SHOPIFY_API_SECRET:""},
 ]){
  const {f,promise}=invoke({},cfg);
  const r=await promise;
  assert.equal(r.status,503);
  assert.equal(await r.text(),"");
  assert.equal(f.calls.length,0);
 }
 const actual=await worker.fetch(req(),{...env,DATABASE_URL:""});
 assert.equal(actual.status,503);
 assert.equal(await actual.text(),"");
});

test("only GET /auth/* SDK callback is admitted; login path remains deliberately unimplemented",async()=>{
 const f=fixture();
 for(const request of [
  new Request(origin+"/auth/callback",{method:"POST"}),
  req("/auth/login?shop="+shop),
  req("/app?shop="+shop),
  req("/auth/callback?shop="+shop+"&evil=1"),
  req("/auth/callback?shop="+shop+"&shop="+shop),
  req("/auth/../app?shop="+shop),
 ]){
  const response=await handleVerifiedStagingShopifyAuth(request,env,{
   createSdkContext:f.createSdkContext,
  });
  assert([400,404,503].includes(response.status),request.url);
 }
 assert.equal(f.calls.length,0);
 const src=readFileSync("workers/app.js","utf8");
 assert.match(src,/handleVerifiedStagingShopifyAuth\(request,env\)/);
 assert.match(src,/url\.pathname\.startsWith\("\/auth\/"\)/);
 assert.match(src,/return locked\(\);/);
});

test("ambiguous signed callback parameters and excessive input deny before Shopify SDK or Neon",async()=>{
 for(const key of ["host","hmac","timestamp","state","code","id_token","session","embedded"]){
  const fixture=invoke({},env,req("/auth/callback?shop="+shop+"&"+key+"=one&"+key+"=two"));
  const res=await fixture.promise;
  assert.equal(res.status,400,"duplicate "+key);
  assert.equal(fixture.f.calls.length,0,"SDK/DB must not run for "+key);
 }
 for(const path of [
  "/auth/callback?shop=other.example.com",
  "/auth/callback?shop="+shop+"&code="+"a".repeat(4097),
  "/auth/callback?shop="+shop+"&state="+"b".repeat(8193),
  "/auth/callback?shop="+shop+"&HMAC=test",
  "/auth/callback?shop="+shop+"&state=a&%73tate=b",
 ]){
  const fixture=invoke({},env,req(path));
  const res=await fixture.promise;
  assert.equal(res.status,400,"invalid: "+path.slice(0,70));
  assert.equal(fixture.f.calls.length,0);
  assert.equal(await res.text(),"");
 }
});

test("untrusted shop hint and stale/missing/neon-revoked sessions can never redirect",async()=>{
 for(const options of [
  [{session:{...ses(),shop:"two.myshopify.com"}},req()],
  [{stored:null},req()],
  [{stored:{...ses(),accessToken:"an-old-revoked-token"}},req()],
  [{stored:{...ses(),expires:new Date(0)}},req()],
  [{stored:{...ses(),expires:null}},req()],
  [{session:{...ses(),expires:null}},req()],
  [{install:{shop,installedAt:new Date("2026-10-16"),uninstalledAt:new Date()}},req()],
  [{install:{shop:"two.myshopify.com",installedAt:new Date("2026-10-16"),uninstalledAt:null}},req()],
  [{install:null},req()],
  [{dbError:true},req()],
 ]){
  const {f,promise}=invoke(options[0],env,options[1]);
  const response=await promise;
  assert([401,403,503].includes(response.status));
  assert.equal(await response.text(),"");
  assert(!f.calls.some(x=>x[0]==="sdk-redirect"),JSON.stringify(options[0]));
  assert.equal(f.calls.at(-1)[0],"close");
 }
});

test("unsupported SDK output, failures and missing redirect fail closed without secret leakage",async()=>{
 for(const options of [
  {denySdk:true},
  {noRedirect:true},
  {returnInvalidRedirect:true},
 ]){
  const {f,promise}=invoke(options);
  const r=await promise;
  assert.equal(r.status,503);
  assert.equal(await r.text(),"");
  assert.equal(r.headers.get("cache-control"),"no-store");
  assert.equal(f.calls.at(-1)[0],"close");
 }
});
