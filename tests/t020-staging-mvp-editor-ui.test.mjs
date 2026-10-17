import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import worker from "../workers/app.js";
import { STAGING_EDITOR_UI_SCRIPT } from "../workers/staging-editor-ui.js";
import { decorateVerifiedStagingEditorUi } from "../app/services/worker-shopify-staging-editor-html.js";
import {
  renderVerifiedStagingMerchantDashboard,renderVerifiedStagingPageInspection,
} from "../app/services/worker-shopify-staging-dashboard.js";
const shop="merchant.myshopify.com",id="page_42",apiKey="a".repeat(32);
const stamp="2026-10-16T07:30:00.000Z";
const origin="https://staging.builder.example.org";
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  VSN_STAGING_DASHBOARD_ENABLED:"true",VSN_STAGING_DRAFT_SAVE_ENABLED:"true",
};
const summary={total:1,draft:1,published:0,recent:[{
  id,title:"Landing",template:"Blank",status:"draft",updatedAt:stamp,
}]};
const metadata={id,title:"Landing",handle:"landing",template:"Blank",
  status:"draft",version:2,updatedAt:stamp};
const draft={id,version:2,updatedAt:stamp,elements:[
  {id:"text1",type:"text",props:{text:"This content stays private"}},
]};
const page=()=>renderVerifiedStagingPageInspection({shop,apiKey,metadata,content:draft});

test("default dashboard and inspection stay read-only and script-free",async()=>{
  const dashboard=await renderVerifiedStagingMerchantDashboard({shop,apiKey,summary}).text();
  const inspector=await page().text();
  for(const html of [dashboard,inspector]){
    assert(!html.includes("data-vsn-stage-editor"));
    assert(!html.includes('src="/__vsn/staging-editor-ui.js"'));
    assert(!html.includes("data-vsn-create-form"));
    assert(!html.includes("data-vsn-block-editor"));
    assert(html.includes("Read-only"));
  }
});

test("opted-in create UI uses only authenticated scoped Shopify App Bridge route",async()=>{
  const result=await decorateVerifiedStagingEditorUi(
    renderVerifiedStagingMerchantDashboard({shop,apiKey,summary}),{shop});
  assert.equal(result.status,200);
  const html=await result.text();
  assert.match(html,/data-vsn-stage-editor data-shop="merchant.myshopify.com"/);
  assert.match(html,/data-vsn-create-form/);
  assert.match(html,/builder-page-title/);
  assert.match(html,/staging-editor-ui.js" defer/);
  assert.match(result.headers.get("content-security-policy"),
    /script-src 'self' https:\/\/cdn.shopify.com/);
  assert.doesNotMatch(html,/<script[^>]*>\s*[^<\s]/);
  assert.doesNotMatch(html,/postgresql:|SHOPIFY_API_SECRET|Authorization: Bearer/);
});

test("opted-in draft inspection has text editor and no private JSON in HTML",async()=>{
  const result=await decorateVerifiedStagingEditorUi(page(),{shop,pageId:id});
  const html=await result.text();
  assert.match(html,/data-vsn-block-editor data-page-id="page_42"/);
  assert.match(html,/data-vsn-block-list/);
  assert.match(html,/data-vsn-save disabled/);
  assert.match(html,/data-vsn-version/);
  assert.match(html,/not published/);
  assert(!html.includes("contentJson"));
  assert(!html.includes('"accessToken"'));
  assert(!html.includes("data-vsn-create-form"));
  assert.match(result.headers.get("content-security-policy"),/'self'/);
});

test("spoofed tenant/page or insecure source HTML cannot enable edit surface",async()=>{
  for(const value of [
    {shop:"other.example.com"}, {shop,id:"../../../"},
    {shop:"x\" onclick=\"y"},
  ]){
    await assert.rejects(
      ()=>decorateVerifiedStagingEditorUi(page(),value),
      /scope required/,
    );
  }
  const altered=new Response("<html><main></main></html>",{
    headers:{"content-security-policy":"script-src 'unsafe-inline'"},
  });
  await assert.rejects(
    ()=>decorateVerifiedStagingEditorUi(altered,{shop}),/safety policy unavailable/,
  );
});

test("raw browser client script compiles and uses fresh App Bridge ID token",()=>{
  assert.doesNotThrow(()=>new Script(STAGING_EDITOR_UI_SCRIPT));
  assert.match(STAGING_EDITOR_UI_SCRIPT,/shopify\.idToken\(\)/);
  assert.match(STAGING_EDITOR_UI_SCRIPT,/credentials:"omit"/);
  assert.match(STAGING_EDITOR_UI_SCRIPT,/expectedVersion:version,elements/);
  assert.match(STAGING_EDITOR_UI_SCRIPT,/response\.status===409/);
  assert(!STAGING_EDITOR_UI_SCRIPT.includes("innerHTML"));
  assert(!STAGING_EDITOR_UI_SCRIPT.includes("localStorage"));
  assert(!STAGING_EDITOR_UI_SCRIPT.includes("sessionStorage"));
  assert(!STAGING_EDITOR_UI_SCRIPT.includes("SHOPIFY_API_SECRET"));
});

test("Worker serves the script only to exact opted-in Staging, never Live",async()=>{
  const req=(tail="/__vsn/staging-editor-ui.js",method="GET")=>
    new Request(origin+tail,{method});
  const allowed=await worker.fetch(req(),env);
  assert.equal(allowed.status,200);
  assert.match(allowed.headers.get("content-type"),/text\/javascript/);
  assert.match(await allowed.text(),/shopify\.idToken\(\)/);
  for(const setting of [
    {...env,VSN_STAGING_DRAFT_SAVE_ENABLED:"false"},
    {...env,VSN_STAGING_DASHBOARD_ENABLED:undefined},
    {...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},
    {...env,VSN_WORKER_NAME:"wrong"},
  ]){
    const result=await worker.fetch(req(),setting);
    assert.equal(result.status,503);
  }
  assert.equal((await worker.fetch(req("/__vsn/staging-editor-ui.js?shop="+shop),env)).status,404);
  assert.equal((await worker.fetch(req("/__vsn/staging-editor-ui.js","POST"),env)).status,405);
});
