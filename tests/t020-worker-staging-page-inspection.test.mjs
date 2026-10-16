import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "../workers/app.js";
import {
 handleVerifiedStagingPageInspection,
 renderVerifiedStagingPageInspection,
 renderVerifiedStagingMerchantDashboard,
} from "../app/services/worker-shopify-staging-dashboard.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const origin="https://staging.builder.example.org",shop="merchant.myshopify.com";
const id="page_42",stamp="2026-10-16T07:30:00.000Z";
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-only",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/db?sslmode=require",
 VSN_STAGING_DASHBOARD_ENABLED:"true",
};
const metadata={id,title:"Landing page",handle:"landing-page",
 template:"Blank",status:"draft",version:2,updatedAt:stamp};
const content={id,version:2,updatedAt:stamp,elements:[
  {id:"b1",type:"text",props:{text:"Hello, merchant!"}},
]};
const path="/app/__vsn/pages/"+id+"/view?shop="+shop;
function fixture({paid=true,rbac=null,missing=false,invalidContent=false}={}){
 const calls=[];
 const session={id:"offline_"+shop,shop,isOnline:false,accessToken:"private-oauth-token"};
 const db={
  builderShopInstallation:{async findUnique({where}){calls.push(["install",where]);return {
   shop,installedAt:new Date("2026-10-15"),uninstalledAt:null,
  }}},
  session:{async findUnique({where}){calls.push(["session",where]);return session;}},
  builderSubscription:{async findUnique({where}){calls.push(["paid",where]);return paid?{
   shop,provider:"shopify-app-pricing",planKey:"starter",planHandle:"starter",
   status:"active",verifiedAt:new Date(),trialEndsAt:null,cancelEffectiveOn:null,
  }:null;}},
  builderShopSetting:{async findUnique({where}){calls.push(["rbac",where]);return {roleAccessJson:rbac};}},
  builderPage:{async findFirst({where,select}){
   calls.push(["page",where,select]);
   if(missing)return null;
   if(select.contentJson) return {...metadata,shop,updatedAt:new Date(stamp),
    contentJson:invalidContent?'[{"__proto__":{"pwned":true}}]':JSON.stringify(content.elements)};
   return {...metadata,shop,updatedAt:new Date(stamp)};
  }},
 };
 const context={database:db,shopify:{authenticate:{admin:async()=>{
  calls.push(["sdk"]);return {session,admin:{}};
 }}},async close(){calls.push(["close"])}};
 return {calls,createSdkContext:async()=>context};
}
const request=(pathname=path)=>new Request(origin+pathname);
const serve=(f,e=env,req=request())=>handleVerifiedStagingPageInspection(req,e,{
 createSdkContext:f.createSdkContext,
});

test("dashboard links to safe read-only page inspection for the verified tenant",async()=>{
 const res=renderVerifiedStagingMerchantDashboard({shop,apiKey:env.SHOPIFY_API_KEY,summary:{
  total:1,draft:1,published:0,recent:[
   {id,title:"Landing page",template:"Blank",status:"draft",updatedAt:stamp},
  ],
 }});
 const html=await res.text();
 assert.match(html,/href="\/app\/__vsn\/pages\/page_42\/view\?shop=merchant.myshopify.com"/);
});

test("official SDK, installed session, paid plan and staff RBAC authorize inspection",async()=>{
 const f=fixture(),result=await serve(f);
 assert.equal(result.status,200);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.match(result.headers.get("content-security-policy"),/script-src https:\/\/cdn.shopify.com/);
 assert.doesNotMatch(result.headers.get("content-security-policy"),/unsafe-eval/);
 const html=await result.text();
 for(const text of ["Landing page","landing-page","Blank","Saved version","Top-level blocks",
   "Hello, merchant!","Block 1: text","cdn.shopify.com/shopifycloud/app-bridge.js",
   "not a live storefront preview"])
   assert(html.toLowerCase().includes(text.toLowerCase()),text);
 assert.doesNotMatch(html,/private-oauth-token|fake@|contentJson|DATABASE_URL/);
 const pages=f.calls.filter(x=>x[0]==="page");
 assert.equal(pages.length,2);
 assert(pages.every(x=>x[1].shop===shop&&x[1].id===id&&x[1].deletedAt===null));
 assert.equal(pages[0][2].contentJson,undefined);
 assert.equal(pages[1][2].contentJson,true);
 assert.equal(f.calls.at(-1)[0],"close");
});

test("unpaid and disallowed staff users cannot query any page records",async()=>{
 for(const options of [{paid:false},{rbac:'{"editor":false}'}]){
  const f=fixture(options),response=await serve(f);
  assert.equal(response.status,403);
  assert.equal(await response.text(),"");
  assert.equal(f.calls.filter(x=>x[0]==="page").length,0);
  assert.equal(f.calls.at(-1)[0],"close");
 }
});

test("production, missing feature flag, rogue request and duplicated shop keys are refused",async()=>{
 const f=fixture();
 for(const e of [
  {...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},
  {...env,VSN_STAGING_DASHBOARD_ENABLED:"false"},
  {...env,VSN_STAGING_DASHBOARD_ENABLED:undefined},
 ]){
  assert.equal((await serve(f,e)).status,503);
 }
 for(const bad of [
  path.replace(shop,"other.myshopify.com"),
  path+"&test=1",
  path+"&shop="+shop,
 ]){
  const res=await serve(f,env,request(bad));
  assert([401,404].includes(res.status),bad);
 }
 assert.equal((await serve(f,env,new Request(origin+path,{method:"POST"}))).status,503);
 assert.equal((await serve(f,env,request("/app/__vsn/pages/../view?shop="+shop))).status,503);
 assert.equal(f.calls.filter(x=>x[0]==="page").length,0);
 const code=readFileSync("workers/app.js","utf8");
 assert.match(code,/handleVerifiedStagingPageInspection\(request,env\)/);
 assert.equal((await worker.fetch(request(),{...env,DATABASE_URL:""})).status,503);
});

test("missing, malformed or inconsistent persisted pages fail closed",async()=>{
 for(const options of [{missing:true},{invalidContent:true}]){
  const f=fixture(options),r=await serve(f);
  assert.equal(r.status,options.missing?404:503);
  assert.equal(await r.text(),"");
  assert.equal(f.calls.at(-1)[0],"close");
 }
 assert.throws(()=>renderVerifiedStagingPageInspection({
  shop,apiKey:env.SHOPIFY_API_KEY,metadata,content:{...content,version:3},
 }));
});

test("malicious stored page values are HTML-escaped and never executable",async()=>{
 const malicious={...metadata,title:'<script>alert("x")</script>',
 handle:'"><iframe src="//evil.invalid">',status:'"><img src=x onerror=alert(1)>'};
 const draft={...content,elements:[{id:"b1",type:"text",
  props:{text:'<img src=x onerror="alert(2)">'}}]};
 const html=await renderVerifiedStagingPageInspection({
  shop,apiKey:env.SHOPIFY_API_KEY,metadata:malicious,content:draft,
 }).then(x=>x.text());
 assert(!html.includes('<script>alert'));
 assert(!html.includes('<iframe src'));
 assert(!html.includes('<img src=x'));
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img src=x onerror=&quot;alert\(2\)&quot;&gt;/);
 assert(!html.includes("javascript:"));
});

test("long documents produce at most 30 escaped preview rows and no raw JSON blob",async()=>{
 const draft={...content,elements:Array.from({length:160},(_,i)=>({
  id:"block-"+i,type:"text",props:{text:"line-"+i},
 }))};
 const html=await renderVerifiedStagingPageInspection({
  shop,apiKey:env.SHOPIFY_API_KEY,metadata,content:draft,
 }).then(x=>x.text());
 assert.equal((html.match(/Block \d+: text/g)||[]).length,30);
 assert(!html.includes("line-159"));
 assert(!html.includes("contentJson"));
});
