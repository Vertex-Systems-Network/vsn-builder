import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderEdgeHtml } from "../app/services/worker-edge-html.server.js";

const url="https://builder-staging.example.test";
function merchantRequest(method="GET",path="/app/pages",userAgent="Mozilla/5.0"){
 return new Request(url+path,{method,headers:{"user-agent":userAgent}});
}
const trustedHeaders={
 "content-security-policy":"default-src 'self'; frame-ancestors 'none'",
 "content-length":"1",
};
test("Cloudflare Web Streams SSR produces HTML and preserves trusted Shopify CSP",async()=>{
 const response=await renderEdgeHtml(merchantRequest(),200,trustedHeaders,
   createElement("main",{id:"edge-test"},"VSN Builder edge SSR smoke"));
 assert.equal(response.status,200);
 assert.match(response.headers.get("content-type"),/text\/html/);
 assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.equal(response.headers.get("content-length"),null);
 assert.ok(response.headers.get("x-request-id"));
 assert.match(await response.text(),/VSN Builder edge SSR smoke/);
});
test("merchant SSR must fail closed without Shopify-provided frame-ancestors",async()=>{
 for(const headers of [{}, {"content-security-policy":"default-src 'self'"},
   {"content-security-policy":"frame-src 'self'"}]){
  const result=await renderEdgeHtml(merchantRequest(),200,headers,
    createElement("main",null,"must not render"));
  assert.equal(result.status,503);
  assert.equal(await result.text(),"");
 }
});
test("POST/HEAD and invalid renderers are never treated as authenticated SSR",async()=>{
 for(const method of ["POST","HEAD"]){
  const r=await renderEdgeHtml(merchantRequest(method),200,trustedHeaders,
    createElement("main",null,"unsafe"));
  assert.equal(r.status,503);
 }
 const r=await renderEdgeHtml(merchantRequest(),200,trustedHeaders,
   createElement("main",null,"unsafe"),{render:async()=>null});
 assert.equal(r.status,503);
});
test("edge stream crashes are sanitized without leaking internals",async()=>{
 const r=await renderEdgeHtml(merchantRequest(),200,trustedHeaders,
   createElement("main",null,"unsafe"),{render:async()=>{throw Error("API_SECRET_leak")}});
 assert.equal(r.status,503);
 assert.ok(!(await r.text()).includes("API_SECRET"));
});
test("bot responses await allReady; regular merchant visitors stream immediately",async()=>{
 let release,ready=new Promise(resolve=>{release=resolve;});
 const fakeStream=()=>{const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode("hello"));controller.close();}});
 body.allReady=ready;return body;};
 const robot=renderEdgeHtml(merchantRequest("GET","/app","Googlebot"),200,trustedHeaders,
   createElement("main"),{render:async()=>fakeStream(),bot:()=>true});
 let robotDone=false;void robot.then(()=>robotDone=true);
 await Promise.resolve();await Promise.resolve();
 assert.equal(robotDone,false);
 release();
 assert.equal((await robot).status,200);
 const human=await renderEdgeHtml(merchantRequest(),200,trustedHeaders,createElement("main"),
   {render:async()=>fakeStream(),bot:()=>false});
 assert.equal(human.status,200);
});
test("Node SSR and Worker SSR remain physically isolated",()=>{
 const worker=readFileSync("app/entry.worker.js","utf8");
 assert.match(worker,/ServerRouter/);
 assert.match(worker,/worker-edge-html\.server\.js/);
 assert.doesNotMatch(worker,/^\\s*import\\s+.*(?:PassThrough|@react-router\\/node|shopify\\.server|db\\.server)/m);
 const isolated=readFileSync("app/services/worker-edge-html.server.js","utf8");
 assert.doesNotMatch(isolated,/node:|PassThrough|@react-router\/node|@shopify\/shopify-app-react-router\/adapters\/node/);
 const old=readFileSync("app/entry.server.jsx","utf8");
 assert.match(old,/PassThrough/);
});
