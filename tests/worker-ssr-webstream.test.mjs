import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderWorkerDocument } from "../app/services/worker-ssr-webstream.js";
import { renderWorkerReactRouter } from "../workers/worker-ssr-bridge.js";

const req=(ua="Mozilla/5.0")=>new Request("https://staging.vsn.invalid/app",{headers:{"user-agent":ua}});
const authorize=(request,headers)=>{headers.set("Content-Security-Policy","frame-ancestors https://admin.shopify.com; default-src 'self'");};
test("Web Streams renderer returns actual React HTML and preserves Shopify CSP",async()=>{
 const response=await renderWorkerDocument({
   request:req(), reactElement:React.createElement("main",{"data-worker":"yes"},"VSN Edge test"),
   addShopifyHeaders:authorize,responseStatusCode:201
 });
 assert.equal(response.status,201);
 assert.match(await response.text(),/VSN Edge test/);
 assert.match(response.headers.get("content-security-policy"),/admin\.shopify\.com/);
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 assert.equal(response.headers.get("content-type"),"text/html; charset=utf-8");
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.equal(response.headers.get("cross-origin-opener-policy"),"same-origin-allow-popups");
 assert.match(response.headers.get("x-request-id"),/^[0-9a-f-]{36}$/i);
});
test("unconfigured Shopify header callback is a hard failure, not a weak CSP",async()=>{
 await assert.rejects(renderWorkerDocument({request:req(),reactElement:React.createElement("div",null,"test")}),/Shopify document security headers/);
});
test("a callback that forgets embedded Shopify CSP is rejected",async()=>{
 await assert.rejects(renderWorkerDocument({request:req(),reactElement:React.createElement("div"),addShopifyHeaders:()=>{}}),/Content-Security-Policy is missing/);
});
test("a weak CSP without frame-ancestors cannot be used for Shopify embedding",async()=>{
 const weak=(request,headers)=>headers.set("Content-Security-Policy","default-src 'self'");
 await assert.rejects(renderWorkerDocument({request:req(),reactElement:React.createElement("div"),addShopifyHeaders:weak}),/frame-ancestors is missing/);
});
test("callback errors propagate before any response is returned",async()=>{
 await assert.rejects(renderWorkerDocument({request:req(),reactElement:React.createElement("div"),addShopifyHeaders(){throw new Error("authentication not configured")}}),/authentication not configured/);
});
test("bots render via Web Streams and return complete markup",async()=>{
 const response=await renderWorkerDocument({request:req("Googlebot/2.1"),reactElement:React.createElement("article",null,"Bot ready"),addShopifyHeaders:authorize});
 assert.equal(response.status,200);
 assert.match(await response.text(),/Bot ready/);
});
test("existing response headers and request correlation ID are preserved",async()=>{
 const headers=new Headers({"x-request-id":"safe-request-id","x-evidence":"pass"});
 const response=await renderWorkerDocument({request:req(),reactElement:React.createElement("span",null,"OK"),responseHeaders:headers,addShopifyHeaders:authorize});
 assert.equal(response.headers.get("x-request-id"),"safe-request-id");
 assert.equal(response.headers.get("x-evidence"),"pass");
 assert.equal(headers.get("content-security-policy"),null,"do not mutate input headers");
});
test("React Router adapter refuses missing route context",()=>{
 assert.throws(()=>renderWorkerReactRouter(req(),200,new Headers(),null,{addShopifyHeaders:authorize}),/server context not available/);
});
test("invalid render request or status cannot return a response",async()=>{
 await assert.rejects(renderWorkerDocument({request:{url:"invalid"},reactElement:React.createElement("div"),addShopifyHeaders:authorize}),/requires a Request/);
 await assert.rejects(renderWorkerDocument({request:req(),reactElement:React.createElement("div"),addShopifyHeaders:authorize,responseStatusCode:100}),/Invalid Worker SSR response status/);
});
