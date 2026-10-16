import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

// Exercise the REAL storefront renderer helper isolated from browser bootstrap.
// This is offline source-level QA, not a Shopify store or network E2E test.
const renderer=readFileSync("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js","utf8");
const start=renderer.indexOf("\tfunction withVisitorParams(input) {");
const stop=renderer.indexOf("\n\tasync function fetchBuilderHtml(url)",start);
assert(start>=0&&stop>start,"production proxy-transport function must exist");
const actualFunction=renderer.slice(start,stop);

const storefront="https://merchant.myshopify.com";
function prepare({
 customerId=1234567,
 customerName="Private Shopper <test>",
 customerEmail="private+buyer@example.org",
 pathname="/products/staging-sample",
 href=storefront+"/products/staging-sample?vsn_exp_preview=offer-A&vsn_variant=variant-1",
}={}){
 const sandbox={
  URL,
  window:{
   location:{origin:storefront,pathname,href},
   VSN_PAGE_CONTEXT:{language:"en",country:"CA",market:"north-america",cartItemCount:2},
   VSN_ASSET_PIPELINE_READY:true,
  },
  getContext:()=>({
   customerId,customerName,customerEmail,customerLoggedIn:true,
   path:pathname,
  }),
  visitorIdentity:()=>({visitorId:"ci-visitor",sessionId:"ci-session"}),
 };
 runInNewContext(actualFunction+"\nthis.renderQuery=withVisitorParams",sandbox,{timeout:1000});
 return input=>sandbox.renderQuery(input);
}
function parse(input){return new URL(input,storefront)}
const privateKeys=["customerId","customerName","customerEmail"];

test("actual Builder proxy URL never sends personal customer fields but retains required context",()=>{
 const url=parse(prepare()("/apps/vsn-builder/default?template=product&fragment=1"));
 assert.equal(url.pathname,"/apps/vsn-builder/default");
 assert.equal(url.searchParams.get("fragment"),"1");
 assert.equal(url.searchParams.get("template"),"product");
 assert.equal(url.searchParams.get("customerLoggedIn"),"1");
 assert.equal(url.searchParams.get("visitorPath"),"/products/staging-sample");
 assert.equal(url.searchParams.get("vsnVisitorId"),"ci-visitor");
 assert.equal(url.searchParams.get("vsnSessionId"),"ci-session");
 assert.equal(url.searchParams.get("language"),"en");
 assert.equal(url.searchParams.get("country"),"CA");
 assert.equal(url.searchParams.get("market"),"north-america");
 assert.equal(url.searchParams.get("cartItemCount"),"2");
 assert.equal(url.searchParams.get("vsnAssetPipeline"),"1");
 assert.equal(url.searchParams.get("vsnExpPreview"),"offer-A");
 assert.equal(url.searchParams.get("vsnVariant"),"variant-1");
 for(const key of privateKeys) assert.equal(url.searchParams.has(key),false,key);
 assert.doesNotMatch(url.href,/private%2Bbuyer|Private|1234567|example.org/);
});
test("legacy and forged PII query parameters are erased even if supplied by caller",()=>{
 const request=prepare()(
  "/apps/vsn-builder/page?customerId=999&customerName=stolen&customerEmail=evil%40example.test&customerEmail=duplicate&fragment=1");
 const uri=parse(request);
 for(const key of privateKeys)assert.equal(uri.searchParams.has(key),false,key);
 assert.equal(uri.searchParams.get("fragment"),"1");
});
test("no OAuth customer PII is injected for anonymous visitor",()=>{
 const uri=parse(prepare({customerId:null,customerName:"",customerEmail:""})("/apps/vsn-builder"));
 for(const key of privateKeys)assert.equal(uri.searchParams.has(key),false,key);
 assert.equal(uri.searchParams.get("customerLoggedIn"),"1","test fixture has authenticated boolean");
});
test("cross-origin, traversal and unrelated storefront paths cannot receive analytics context",()=>{
 const render=prepare();
 for(const input of [
  "https://evil.example.com/apps/vsn-builder/default",
  "//evil.example.com/apps/vsn-builder/default",
  "/admin",
  "/apps/not-builder",
  "/apps/vsn-builder-evil",
  "/apps/vsn-builder/../other",
  "/apps/vsn-builder/%2e%2e/other",
 ]){
  assert.throws(()=>render(input),/Invalid VSN Builder app-proxy URL/,input);
 }
 assert.equal(parse(render("/apps/vsn-builder/default")).pathname,"/apps/vsn-builder/default");
});
test("the app proxy server does not use the removed client PII query fields",()=>{
 const handler=readFileSync("app/routes/builder-proxy.$.jsx","utf8");
 for(const key of privateKeys){
  assert(!handler.includes('searchParams.get("'+key+'")'),key);
  assert(!handler.includes("searchParams.get('"+key+"')"),key);
 }
});
