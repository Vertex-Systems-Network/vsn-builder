import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {acceptWorkerShopifyAdminRequest} from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const origin="https://staging.builder.example.org";
const shop="first.myshopify.com";
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-only",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci:unused@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/ci?sslmode=require",
};
const request=()=>new Request(origin+"/app/__vsn/pages/validPage123?shop="+shop);
function fixture({roleAccessJson=null,accountOwner=false,collaborator=false,
  paid=true,settingsFailure=false,missingSettings=false}={}){
  const calls=[];
  const session={id:"offline_"+shop,shop,state:"",isOnline:false,
    accessToken:"private-token",accountOwner,collaborator};
  const db={
    builderShopInstallation:{async findUnique(){
      calls.push("installation");return {shop,installedAt:new Date(),uninstalledAt:null};
    }},
    session:{async findUnique(){calls.push("session");return session}},
    builderSubscription:{async findUnique({where}){
      calls.push({type:"billing",where});
      if(!paid)return null;
      return {shop,provider:"shopify-app-pricing",
        planKey:"starter",planHandle:"starter",status:"active",
        verifiedAt:new Date(Date.now()-60_000),trialEndsAt:null,cancelEffectiveOn:null};
    }},
    builderShopSetting:{async findUnique(args){
      calls.push({type:"permission",args});
      if(settingsFailure)throw new Error("postgresql://SECRET.internal");
      return {roleAccessJson};
    }},
    builderPage:{async findFirst(){calls.push("page");return null}},
  };
  if(missingSettings)delete db.builderShopSetting;
  const ctx={
    database:db,shopify:{authenticate:{admin:async()=>{
      calls.push("official-admin");return {session,admin:{}};
    }}},async close(){calls.push("close")},
  };
  return {ctx,calls};
}
async function throughGate(f){
  return acceptWorkerShopifyAdminRequest(request(),env,{
    createSdkContext:async()=>f.ctx,
    enablePageMetadata:true,
    requireVerifiedPaidRead:true,
    requirePageViewPermission:true,
    onAuthenticated:async({pageMetadata})=>{
      f.calls.push("callback");
      await pageMetadata("validPage123");
      return Response.json({ok:true});
    },
  });
}
const denied=payload=>JSON.stringify(payload);

test("default enabled Shopify staff and collaborator may view, owner always allowed",async()=>{
  for(const config of [
    {},{collaborator:true},
    {accountOwner:true,roleAccessJson:denied({editor:false,collaborator:false})},
  ]){
    const f=fixture(config);
    const response=await throughGate(f);
    assert.equal(response.status,200,JSON.stringify(config));
    assert.equal(f.calls.includes("callback"),true);
    const permission=f.calls.find(x=>x?.type==="permission");
    if(config.accountOwner)assert.equal(permission,undefined);
    else assert.deepEqual(permission.args,{where:{shop},select:{roleAccessJson:true}});
    assert.equal(f.calls.at(-1),"close");
  }
});

test("shop disabled editor/collaborator and page system/action deny before query",async()=>{
  for(const config of [
    {roleAccessJson:denied({editor:false})},
    {collaborator:true,roleAccessJson:denied({collaborator:false})},
    {roleAccessJson:denied({systems:{editor:{pages:false}}})},
    {roleAccessJson:denied({actions:{editor:{pages:{view:false}}}})},
  ]){
    const f=fixture(config);
    const response=await throughGate(f);
    assert.equal(response.status,403,JSON.stringify(config));
    assert.equal(await response.text(),"");
    assert.equal(f.calls.includes("callback"),false);
    assert.equal(f.calls.includes("page"),false);
    assert.equal(f.calls.at(-1),"close");
  }
});

test("real pages/view policy allows explicitly enabled collaborator and editor",async()=>{
  for(const config of [
    {roleAccessJson:denied({editor:true,systems:{editor:{pages:true}},
      actions:{editor:{pages:{view:true}}}})},
    {collaborator:true,roleAccessJson:denied({collaborator:true,
      systems:{collaborator:{pages:true}},
      actions:{collaborator:{pages:{view:true}}}})},
  ]){
    assert.equal((await throughGate(fixture(config))).status,200);
  }
});

test("missing or failed role-permission DB contract denies without internal errors",async()=>{
  for(const config of [{missingSettings:true},{settingsFailure:true}]){
    const f=fixture(config);
    const result=await throughGate(f);
    assert.equal(result.status,503);
    assert.equal(await result.text(),"");
    assert.equal(f.calls.includes("callback"),false);
    assert.equal(f.calls.at(-1),"close");
  }
});

test("unpaid merchant never reads staff settings or page data",async()=>{
  const f=fixture({paid:false});
  const result=await throughGate(f);
  assert.equal(result.status,403);
  assert.equal(f.calls.some(x=>x?.type==="permission"),false);
  assert.equal(f.calls.includes("page"),false);
  assert.equal(f.calls.at(-1),"close");
});

test("both hosted page-data routes require RBAC; verified-session is not page-data",()=>{
  const source=readFileSync("workers/app.js","utf8");
  assert.equal((source.match(/requirePageViewPermission:true/g)||[]).length,2);
  assert.match(source,/enablePageSummary:true,\s*requireVerifiedPaidRead:true,\s*requirePageViewPermission:true/);
  assert.match(source,/enablePageMetadata:true,\s*requireVerifiedPaidRead:true,\s*requirePageViewPermission:true/);
  assert.match(source,/url\.pathname==="\/app\/__vsn\/verified-session"/);
});

test("page capabilities enforce paid and staff-view guards even if a new route forgets both flags",async()=>{
  for(const feature of ["enablePageMetadata","enablePageSummary"]){
    for(const config of [
      {paid:false},
      {roleAccessJson:denied({actions:{editor:{pages:{view:false}}}})},
    ]){
      const f=fixture(config);
      // No requireVerifiedPaidRead/requirePageViewPermission supplied on purpose.
      let called=false;
      const response=await acceptWorkerShopifyAdminRequest(request(),env,{
        [feature]:true,
        createSdkContext:async()=>f.ctx,
        onAuthenticated:async()=>{called=true;return Response.json({ok:true});},
      });
      assert.equal(response.status,403,feature+" "+JSON.stringify(config));
      assert.equal(called,false);
      assert.equal(f.calls.includes("page"),false);
      assert.equal(f.calls.at(-1),"close");
    }
  }
});
