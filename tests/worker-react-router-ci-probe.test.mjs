import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import probe from "../workers/edge-react-router-ci-probe.js";
const request=(path)=>new Request("https://vsn-edge.test"+path);
test("real React Router framework module is compiled but incomplete route build FAILS CLOSED",async()=>{
 for(const path of [
  "/app","/app/pages","/auth/callback","/webhooks/app/uninstalled",
  "/__vsn/react-router-smoke?shop=attacker",
 ]){
  assert.equal((await probe.fetch(request(path),{APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci"})).status,404,path);
 }
 for(const env of [
  {APP_ENV:"staging",VSN_BUILD_INTENT:"react-router-ci"},
  {APP_ENV:"production",VSN_BUILD_INTENT:"react-router-ci"},
  {APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci",DATABASE_URL:"postgres://private"},
 ]){
  assert.equal((await probe.fetch(request("/__vsn/react-router-smoke"),env)).status,503);
 }
 const result=await probe.fetch(request("/__vsn/react-router-smoke"),{
  APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci",
 });
 assert.equal(result.status,503,"An empty test build must never become a merchant-ready server");
 assert.equal(await result.text(),"");
});
test("Wrangler preview cannot use hosted Staging or Production identities",()=>{
 const source=readFileSync("wrangler.edge-router-ci.jsonc","utf8");
 const obj=JSON.parse(source.split("\n").filter(line=>!line.trimStart().startsWith("//")).join("\n"));
 assert.equal(obj.main,"./workers/edge-react-router-ci-probe.js");
 assert.equal(obj.workers_dev,false);
 assert.equal(obj.preview_urls,false);
 assert.equal(obj.vars.APP_ENV,"test");
 assert.equal(obj.vars.VSN_BUILD_INTENT,"react-router-ci");
 assert.notEqual(obj.name,"vsn-builder-staging");
 assert.notEqual(obj.name,"vsn-builder-production");
 assert(!source.includes("SHOPIFY_API_SECRET"));
 assert(!source.includes("DATABASE_URL"));
});
