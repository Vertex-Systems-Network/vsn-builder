import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 handleVerifiedStagingShopifyLogin,
} from "../app/services/worker-shopify-staging-login.js";
import worker from "../workers/app.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const origin="https://staging.builder.example.org",shop="one.myshopify.com";
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"fake-ci-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
 VSN_STAGING_OAUTH_ENABLED:"true",
};
const request=(suffix="/auth/login")=>new Request(origin+suffix);
function fixture({returnValue={shop:"MISSING_SHOP"},throwValue=null,broken=false}={}){
 const calls=[];
 const context={shopify:{login:async(req)=>{
  calls.push(["official-shopify-login",req.url]);
  if(throwValue)throw throwValue;
  if(broken)throw Error("session database secret");
  return returnValue;
 }},async close(){calls.push(["close"]);}};
 return {calls,createSdkContext:async(req)=>{
  calls.push(["context",req.url]);return context;
 }};
}
const run=(f,cfg=env,req=request())=>
 handleVerifiedStagingShopifyLogin(req,cfg,{
  createSdkContext:f.createSdkContext,
 });

test("untrusted OAuth initiation is SDK-owned; thrown redirect with signed cookies passes unchanged",async()=>{
 const redirect=new Response(null,{status:302,headers:{
  location:"https://admin.shopify.com/oauth/authorize?shop=one.myshopify.com",
  "set-cookie":"shopify-oauth-state=SDK; Secure; HttpOnly; SameSite=None",
 }});
 const f=fixture({throwValue:redirect});
 const response=await run(f,env,request("/auth/login?shop="+shop));
 assert.strictEqual(response,redirect);
 assert.match(response.headers.get("set-cookie"),/shopify-oauth-state=SDK/);
 assert.deepEqual(f.calls.map(x=>x[0]),[
  "context","official-shopify-login","close",
 ]);
 assert.equal(f.calls[1][1],origin+"/auth/login?shop="+shop);
});

test("missing shop renders inert accessible Staging form without logging in as another tenant",async()=>{
 const f=fixture(),result=await run(f);
 assert.equal(result.status,200);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.match(result.headers.get("content-security-policy"),/form-action 'self'/);
 assert.match(result.headers.get("content-security-policy"),/frame-ancestors 'none'/);
 assert.doesNotMatch(result.headers.get("content-security-policy"),/unsafe-eval|script-src 'unsafe-inline'/);
 const html=await result.text();
 assert.match(html,/<form action="\/auth\/login" method="get">/);
 assert.match(html,/name="shop"/);
 assert.match(html,/example.myshopify.com/);
 assert.doesNotMatch(html,/SHOPIFY_API_SECRET|fake-ci-secret|fake@|<script/);
 assert.deepEqual(f.calls.map(x=>x[0]),["context","official-shopify-login","close"]);
});

test("SDK-rejected shop retains safely escaped display and no open redirect",async()=>{
 const f=fixture({returnValue:{shop:"INVALID_SHOP"}});
 const res=await run(f,env,request("/auth/login?shop="+shop));
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/Shopify did not accept that store domain/);
 assert.match(html,/value="one.myshopify.com"/);
 assert(!html.includes("window.location"));
});

test("invalid input and duplicate OAuth parameters are blocked before Shopify session or DB factory",async()=>{
 const f=fixture();
 const inputs=[
  "/auth/login?shop=one.myshopify.com&shop=two.myshopify.com",
  "/auth/login?host=A&host=B",
  "/auth/login?evil=https://attacker.example.test",
  "/auth/login?shop=%3Cscript%3E",
  "/auth/login?shop=other.example.com",
 ];
 for(const path of inputs){
  const res=await run(f,env,request(path));
  assert([200,400].includes(res.status),path);
  const body=await res.text();
  assert(!body.includes("<script>"));
  assert(!body.includes("attacker.example.test"));
 }
 assert.equal(f.calls.length,0);
});

test("all ambiguous login parameters and oversized OAuth hints are blocked before SDK or Neon",async()=>{
 const f=fixture();
 for(const path of [
  "/auth/login?shop="+shop+"&%73hop=other.myshopify.com",
  "/auth/login?shop="+shop+"&embedded=1&embedded=0",
  "/auth/login?shop="+shop+"&host=a&host=b",
  "/auth/login?shop="+shop+"&host="+"h".repeat(4097),
  "/auth/login?shop="+shop+"&host="+"h".repeat(8193),
  "/auth/login?shop="+shop+"&session=inject",
 ]){
  const response=await run(f,env,request(path));
  assert.equal(response.status,400,"invalid: "+path.slice(0,70));
  assert.equal(await response.text(),"");
 }
 assert.equal(f.calls.length,0);
});

test("production, unconfigured Worker and missing secrets never call SDK login",async()=>{
 const f=fixture();
 for(const config of [
  {...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},
  {...env,VSN_STAGING_OAUTH_ENABLED:undefined},
  {...env,VSN_STAGING_OAUTH_ENABLED:"false"},
  {...env,VSN_WORKER_NAME:"vsn-builder-production"},
  {...env,DATABASE_URL:""},
  {...env,SHOPIFY_API_SECRET:""},
 ]){
  const res=await run(f,config);
  assert.equal(res.status,503);
  assert.equal(await res.text(),"");
 }
 assert.equal(f.calls.length,0);
 const actual=await worker.fetch(request(),{...env,DATABASE_URL:""});
 assert.equal(actual.status,503);
 assert.equal(await actual.text(),"");
});

test("POST login and unrecognized paths remain locked, no unreviewed mutation/fallback",async()=>{
 const f=fixture();
 const options=[
  new Request(origin+"/auth/login",{method:"POST",body:"shop="+shop}),
  request("/auth/login/other"),
  request("/app?shop="+shop),
 ];
 for(const req of options){
  const response=await run(f,env,req);
  assert([404,503].includes(response.status));
 }
 assert.equal(f.calls.length,0);
 const workerSrc=readFileSync("workers/app.js","utf8");
 assert.match(workerSrc,/handleVerifiedStagingShopifyLogin\(request,env\)/);
 assert.match(workerSrc,/handleVerifiedStagingShopifyAuth\(request,env\)/);
});

test("SDK driver errors never disclose credentials or accidentally certify login",async()=>{
 for(const f of [fixture({broken:true}),fixture({returnValue:{shop:null}})]){
  const response=await run(f,env,request("/auth/login?shop="+shop));
  assert.equal(response.status,503);
  assert.equal(await response.text(),"");
  assert.equal(f.calls.at(-1)[0],"close");
 }
});
