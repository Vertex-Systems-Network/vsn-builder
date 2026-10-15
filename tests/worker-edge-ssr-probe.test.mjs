import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import probe from "../workers/edge-ssr-probe.js";

const origin="https://isolated-probe.example.test";
const safe={APP_ENV:"test",VSN_BUILD_INTENT:"edge-ssr-ci"};
test("real fetch-handler renders streaming isolated Web Fetch response",async()=>{
 const response=await probe.fetch(new Request(origin+"/__vsn/edge-ssr-smoke"),safe);
 assert.equal(response.status,200);
 assert.match(response.headers.get("content-type"),/text\/html/);
 assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
 assert.match(await response.text(),/Cloudflare Web Streams SSR proof/);
});
test("probe cannot be used as a production/merchant runtime",async()=>{
 for(const env of [{},{APP_ENV:"staging",VSN_BUILD_INTENT:"edge-ssr-ci"},
    {APP_ENV:"production",VSN_BUILD_INTENT:"edge-ssr-ci"},
    {APP_ENV:"test",VSN_BUILD_INTENT:"merchant"}]){
  assert.equal((await probe.fetch(new Request(origin+"/__vsn/edge-ssr-smoke"),env)).status,503);
 }
 for(const path of ["/app","/app/pages","/auth/callback","/__vsn/edge-ssr-smoke?shop=evil",
  "/__vsn/database-health","/readyz"]){
  assert.equal((await probe.fetch(new Request(origin+path),safe)).status,404,path);
 }
 assert.equal((await probe.fetch(new Request(origin+"/__vsn/edge-ssr-smoke",{method:"POST"}),safe)).status,404);
});
test("CI-only SSR Wrangler cannot target hosted Staging or Live Worker name",()=>{
 const worker=JSON.parse(readFileSync("wrangler.edge-ssr-ci.jsonc","utf8")
   .replace(/^\s*\/\/.*$/gm,""));
 assert.equal(worker.main,"./workers/edge-ssr-probe.js");
 assert.equal(worker.vars.APP_ENV,"test");
 assert.equal(worker.workers_dev,false);
 assert.equal(worker.preview_urls,false);
 assert.notEqual(worker.name,"vsn-builder-staging");
 assert.notEqual(worker.name,"vsn-builder-production");
 assert.doesNotMatch(JSON.stringify(worker),/DATABASE_URL|SHOPIFY_API_SECRET|SHOPIFY_API_KEY/);
});
