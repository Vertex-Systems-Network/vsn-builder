import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  buildStagingPricingUrl,
  handleVerifiedStagingPlanPage,
  renderStagingPlanPage,
} from "../app/services/worker-shopify-staging-plans.js";
import {renderStagingBillingRequired} from "../app/services/worker-shopify-staging-billing-notice.js";
import {renderVerifiedStagingMerchantDashboard} from "../app/services/worker-shopify-staging-dashboard.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const origin="https://staging.builder.example.org";
const shop="staging-oath3rth.myshopify.com";
const apiKey="a".repeat(32);
const pricingUrl="https://admin.shopify.com/store/staging-oath3rth/charges/vsn-builder-staging/pricing_plans";
const env={APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_STAGING_DASHBOARD_ENABLED:"true",SHOPIFY_API_KEY:apiKey,
  SHOPIFY_API_SECRET:"synthetic-only",SHOPIFY_APP_HANDLE:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),SHOPIFY_APP_URL:origin,
  SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"};

function fixture(){
  const calls=[];
  const session={id:"offline_"+shop,shop,isOnline:false,accessToken:"private-token"};
  const database={
    builderShopInstallation:{async findUnique({where}){
      calls.push(["install",where]);
      return {shop,installedAt:new Date("2026-10-15T00:00:00Z"),uninstalledAt:null};
    }},
    session:{async findUnique({where}){calls.push(["session",where]);return session;}},
  };
  const context={database,shopify:{authenticate:{admin:async req=>{
    calls.push(["authenticate",new URL(req.url).search]);return {session,admin:{}};
  }}},async close(){calls.push(["close"]);}};
  return {calls,createSdkContext:async()=>context};
}

test("the Staging pricing URL is generated only from a verified shop shape and safe app handle",()=>{
  assert.equal(buildStagingPricingUrl(shop,"vsn-builder-staging"),pricingUrl);
  for(const bad of ["https://attacker.example", "bad/path", "", "x".repeat(81)])
    assert.equal(buildStagingPricingUrl(shop,bad),null);
  for(const bad of ["attacker.example", "a.myshopify.com.evil.test", "../foo.myshopify.com"])
    assert.equal(buildStagingPricingUrl(bad,"vsn-builder-staging"),null);
});

test("plan page lists all eight plans, shows comparison and only links checkout to Shopify",async()=>{
  const response=renderStagingPlanPage({shop,apiKey,appHandle:"vsn-builder-staging"});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-security-policy"),/frame-ancestors https:\/\/admin\.shopify\.com/);
  const html=await response.text();
  for(const plan of ["Starter","Solo","Silver","Gold","Business","Platinum","Agency","Scale"])
    assert.match(html,new RegExp(`<h2>${plan}<\\/h2>`));
  assert.match(html,/Compare all 8 plans/);
  assert.match(html,/\$30\/month/);
  assert.match(html,/\$59\/month/);
  assert.match(html,/\$100\/month/);
  assert.match(html,/\$150\/month/);
  assert.match(html,/\$350\/month · \$3000\/year/);
  assert.equal((html.match(/https:\/\/admin\.shopify\.com\/store\/staging-oath3rth\/charges\/vsn-builder-staging\/pricing_plans/g)||[]).length,8);
  assert.doesNotMatch(html,/private-token|accessToken|DATABASE_URL|SHOPIFY_API_SECRET/);
  assert.match(html,/Shopify confirms billing/);
  assert.match(html,/only after Shopify verifies the subscription/i);
});

test("plan page uses official Shopify authentication without requiring an existing paid plan",async()=>{
  const f=fixture();
  const request=new Request(origin+"/app/plans?shop="+shop+"&host=admin-host&embedded=1");
  const response=await handleVerifiedStagingPlanPage(request,env,{createSdkContext:f.createSdkContext});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Plans &amp; License/);
  assert.equal(f.calls[0][0],"authenticate");
  assert.equal(f.calls[0][1],"?shop="+shop+"&host=admin-host&embedded=1");
  assert.equal(f.calls.filter(([kind])=>kind==="install").length,2);
  assert.equal(f.calls.filter(([kind])=>kind==="session").length,2);
  assert.equal(f.calls.at(-1)[0],"close");
});

test("plan route is Staging GET-only and production remains locked",async()=>{
  const f=fixture();
  for(const [req,e,status] of [
    [new Request(origin+"/app/plans",{method:"POST"}),env,404],
    [new Request(origin+"/app/plans"),{...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},503],
    [new Request(origin+"/app/plans"),{...env,VSN_STAGING_DASHBOARD_ENABLED:"false"},503],
    [new Request(origin+"/app/pages"),env,404],
  ])assert.equal((await handleVerifiedStagingPlanPage(req,e,{createSdkContext:f.createSdkContext})).status,status);
  assert.equal(f.calls.length,0);
  const src=readFileSync("workers/app.js","utf8");
  assert.match(src,/url\.pathname==="\/app\/plans"/);
});

test("dashboard and unpaid install screen expose plan discovery safely",async()=>{
  const dashboard=await renderVerifiedStagingMerchantDashboard({
    shop,apiKey,appHandle:"vsn-builder-staging",
    summary:{total:0,draft:0,published:0,recent:[]},
  }).text();
  assert.match(dashboard,/href="\/app\/plans\?shop=staging-oath3rth\.myshopify\.com"/);
  const unpaid=await renderStagingBillingRequired({shop,apiKey,billingCode:"plan-inactive-none",pricingUrl}).text();
  assert.match(unpaid,/href="https:\/\/admin\.shopify\.com\/store\/staging-oath3rth\/charges\/vsn-builder-staging\/pricing_plans"/);
  assert.match(unpaid,/Compare plan features/);
  const attacker=await renderStagingBillingRequired({
    shop,apiKey,billingCode:"plan-inactive-none",
    pricingUrl:"https://attacker.example/steal",
  }).text();
  assert.doesNotMatch(attacker,/attacker\.example/);
});
