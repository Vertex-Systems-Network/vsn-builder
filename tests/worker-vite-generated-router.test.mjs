import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";

const buildFile="tests/fixtures/t020-vite-build/build/server/index.js";
const endpoint="https://vsn-edge.test/__vsn/react-router-smoke";
const env={APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci"};
test("real Vite build exports exactly synthetic root and resource route",async()=>{
 assert(existsSync(buildFile),"Real React Router fixture must have been built by Vite");
 const build=await import(pathToFileURL(resolve(buildFile)));
 assert.equal(build.ssr,true);
 const routes=Object.values(build.routes||{});
 assert.equal(routes.length,3);
 assert(routes.some(x=>x.path==="app/__vsn-auth-smoke"));
 assert(routes.some(x=>x.path==="__vsn/react-router-smoke"));
 assert(!routes.some(x=>/app\/|auth|webhook|billing|shopify/i.test(x.path||"")));
});
test("Vite-generated React Router route dispatches and unauthorized paths fail closed",async()=>{
 const probe=(await import("../workers/edge-router-vite-ci-probe.js")).default;
 const ok=await probe.fetch(new Request(endpoint),env);
 assert.equal(ok.status,200);
 assert.match(await ok.text(),/VSN Builder Vite-generated route proof/);
 assert.equal(ok.headers.get("set-cookie"),null);
 assert.equal(ok.headers.get("cache-control"),"no-store");
 assert.match(ok.headers.get("content-security-policy"),/frame-ancestors 'none'/);
 for(const path of ["/app","/app/pages","/auth/callback","/webhooks/app/uninstalled","/billing","/__vsn/react-router-smoke?shop=evil"]){
   const result=await probe.fetch(new Request("https://vsn-edge.test"+path),env);
   assert.equal(result.status,404,path);
 }
 for(const context of [
   {APP_ENV:"staging",VSN_BUILD_INTENT:"react-router-ci"},
   {APP_ENV:"production",VSN_BUILD_INTENT:"react-router-ci"},
   {...env,SHOPIFY_API_SECRET:"never-use"},
   {...env,DATABASE_URL:"postgresql://never-use"},
 ]){
   const result=await probe.fetch(new Request(endpoint),context);
   assert.equal(result.status,503);
 }
});
test("build source is isolated from Node Shopify SDK and private production clients",()=>{
 const paths=[
  "tests/fixtures/t020-vite-build/app/root.jsx",
  "tests/fixtures/t020-vite-build/app/entry.server.jsx",
  "tests/fixtures/t020-vite-build/app/routes/smoke.jsx",
  "workers/edge-router-vite-ci-probe.js",
 ];
 for(const path of paths){
  const src=readFileSync(path,"utf8");
  assert.doesNotMatch(src,/^\s*import\s+.*(?:db\.server|shopify\.server|node:|@react-router\/node|PassThrough)/m,path);
 }
 const wrangler=readFileSync("wrangler.edge-router-vite-ci.jsonc","utf8");
 assert.doesNotMatch(wrangler,/"name"\s*:\s*"vsn-builder-(staging|production)"/);
 assert.doesNotMatch(wrangler,/"SHOPIFY_API_SECRET"\s*:/);
 assert.doesNotMatch(wrangler,/"DATABASE_URL"\s*:/);
});
