import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasVerifiedWorkerPaidReadAccess}
  from "../app/services/worker-shopify-paid-read.js";
import {acceptWorkerShopifyAdminRequest}
  from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const origin="https://staging.builder.example.org";
const shop="first.myshopify.com";
const now=()=>new Date();
const paid=(options={})=>({
  shop,provider:"shopify-app-pricing",planKey:"starter",planHandle:"starter",
  status:"active",verifiedAt:new Date(Date.now()-60_000),
  trialEndsAt:null,cancelEffectiveOn:null,...options,
});
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-test-only",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci:unused@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const request=()=>new Request(origin+"/app/__vsn/page-summary?shop="+shop);
function fixture(row=paid(),{fail=false,missingDelegate=false}={}) {
  const calls=[];
  const session={id:"offline_"+shop,shop,state:"",isOnline:false,
    accessToken:"secret-stored-token"};
  const database={
    builderShopInstallation:{async findUnique(){
      // Stable persisted installation identity across two read-only checks.
      // Constructing a fresh new Date() on each mock query falsely emulates
      // an uninstall/reinstall that did not occur and must not pass the gate.
      calls.push("installation");return {shop,installedAt:new Date("2026-10-17T10:00:00.000Z"),uninstalledAt:null};
    }},
    session:{async findUnique(){calls.push("session");return session}},
    builderSubscription:{async findUnique(args){
      calls.push({kind:"subscription",args});
      if(fail)throw Error("postgresql://sensitive-host");
      return row;
    }},
    builderPage:{async count(){calls.push("page-read");return 0}},
  };
  if(missingDelegate)delete database.builderSubscription;
  const ctx={
    database,
    shopify:{authenticate:{admin:async()=>{
      calls.push("sdk");return {session,admin:{}};
    }}},
    async close(){calls.push("close")},
  };
  return {ctx,calls,database};
}
async function getPaidPage(f){
  return acceptWorkerShopifyAdminRequest(request(),env,{
    requireVerifiedPaidRead:true,
    createSdkContext:async()=>f.ctx,
    onAuthenticated:async()=>{f.calls.push("callback");
      return Response.json({allowed:true});
    },
  });
}

test("four commercial plans and the private test plan permit verified read-only access",async()=>{
  for(const plan of ["starter","sliver","gold","platinum","shopify-test"]){
    const f=fixture(paid({planKey:plan,planHandle:plan}));
    const res=await getPaidPage(f);
    assert.equal(res.status,200,plan);
    assert.equal(f.calls.filter(x=>x==="callback").length,1);
    const query=f.calls.find(x=>typeof x==="object");
    assert.deepEqual(query.args.where,{shop});
    assert.deepEqual(Object.keys(query.args.select).sort(),[
      "cancelEffectiveOn","planHandle","planKey","provider","shop",
      "status","trialEndsAt","verifiedAt",
    ]);
    assert.equal(f.calls.at(-1),"close");
  }
});

test("unauthorized plans, missing row, spoofed provider and cross-tenant mirrors deny",async()=>{
  const variants=[null,
    paid({planKey:"free",planHandle:"free"}),
    paid({planKey:"starter",planHandle:"sliver"}),
    paid({planKey:"platenium",planHandle:"platenium"}),
    paid({planKey:"starter",planHandle:"starter",provider:"local"}),
    paid({shop:"another.myshopify.com"}),
    paid({status:"frozen"}),paid({status:"canceled"}),
  ];
  for(const row of variants){
    const f=fixture(row);
    const res=await getPaidPage(f);
    assert.equal(res.status,403,JSON.stringify(row));
    assert.equal(await res.text(),"");
    assert.equal(f.calls.includes("callback"),false);
    assert.equal(f.calls.at(-1),"close");
  }
});

test("expired, non-date, stale or far-future verification must fail closed",async()=>{
  for(const verifiedAt of [
    null,"2026-10-15T12:00:00Z",new Date("invalid"),
    new Date(Date.now()-86_400_001),new Date(Date.now()+360_000),
  ]){
    const f=fixture(paid({verifiedAt}));
    assert.equal((await getPaidPage(f)).status,403,String(verifiedAt));
  }
});

test("expired trial and elapsed cancellation cannot keep merchant page read access",async()=>{
  const past=new Date(Date.now()-60_000);
  const future=new Date(Date.now()+3_600_000);
  for(const variant of [
    {status:"trialing",trialEndsAt:null},
    {status:"trialing",trialEndsAt:past},
    {status:"canceling",cancelEffectiveOn:null},
    {status:"canceling",cancelEffectiveOn:undefined},
    {status:"canceling",cancelEffectiveOn:"2026-10-18T00:00:00Z"},
    {status:"canceling",cancelEffectiveOn:new Date("invalid")},
    {status:"canceling",cancelEffectiveOn:past},
  ]){
    const f=fixture(paid(variant));
    assert.equal((await getPaidPage(f)).status,403);
  }
  for(const variant of [
    {status:"trialing",trialEndsAt:future},
    {status:"canceling",cancelEffectiveOn:future},
  ]){
    assert.equal((await getPaidPage(fixture(paid(variant)))).status,200);
  }
});

test("incomplete cancellation never grants another merchant paid page access",async()=>{
 const record=paid({status:"canceling",cancelEffectiveOn:null});
 const f=fixture(record);
 assert.equal((await getPaidPage(f)).status,403);
 assert.equal(f.calls.includes("callback"),false);
 assert.equal(f.calls.some(x=>x==="page-read"),false);
 assert.equal(f.calls.at(-1),"close");
 const future=new Date(Date.now()+90_000);
 const g=fixture(paid({status:"canceling",cancelEffectiveOn:future}));
 assert.equal((await getPaidPage(g)).status,200);
 assert.equal(g.calls.includes("callback"),true);
});

test("missing subscription delegate and query exception deny with no secret disclosure",async()=>{
  for(const options of [{missingDelegate:true},{fail:true}]){
    const f=fixture(paid(),options);
    const res=await getPaidPage(f);
    assert.equal(res.status,503);
    assert.equal(await res.text(),"");
    assert.equal(f.calls.includes("callback"),false);
    assert.equal(f.calls.at(-1),"close");
  }
});

test("no trust in request-controlled shop, invalid shop or invalid test clock",async()=>{
  const f=fixture();
  assert.equal(await hasVerifiedWorkerPaidReadAccess(f.database,shop,now()),true);
  await assert.rejects(hasVerifiedWorkerPaidReadAccess(f.database,"evil.example.com"),/unavailable/);
  await assert.rejects(hasVerifiedWorkerPaidReadAccess(f.database,shop,new Date("bad")) ,/unavailable/);
  assert.equal(await hasVerifiedWorkerPaidReadAccess(f.database,"other.myshopify.com"),false);
});

test("hosted page-data routes require paid mirrors; verified-session remains separate",()=>{
  const src=readFileSync("workers/app.js","utf8");
  assert.equal((src.match(/requireVerifiedPaidRead:true/g)||[]).length,3);
  assert.match(src,/enablePageSummary:true,\s*requireVerifiedPaidRead:true/);
  assert.match(src,/enablePageMetadata:true,\s*requireVerifiedPaidRead:true/);
  assert.match(src,/url\.pathname==="\/app\/__vsn\/verified-session"/);
});
