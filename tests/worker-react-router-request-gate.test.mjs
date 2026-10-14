import test from "node:test";
import assert from "node:assert/strict";
import { createIsolatedReactRouterGateway } from "../app/services/worker-react-router-request-gate.js";
import { readFileSync } from "node:fs";

const origin="https://vsn-edge.test";
const env={APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci"};
const endpoint=origin+"/__vsn/react-router-smoke";
function request(uri=endpoint,opts){return new Request(uri,opts)}
function mockEngine({
 response=()=>new Response("<main>React Router route handler smoke</main>",{
   headers:{"content-type":"text/html; charset=utf-8","set-cookie":"leak=1"},
 }),
 throwError=false,
}={}){
 const calls=[];
 const loader=async()=>({fixture:true});
 const make=(passedLoader,mode)=>{
   calls.push({step:"factory",passedLoader,mode});
   return async(req,context)=>{
     calls.push({step:"handler",req,context});
     if(throwError)throw Error("SHOPIFY_SECRET must not be logged");
     return response();
   };
 };
 return {calls,loader,make};
}
test("passes official createRequestHandler factory signature and safe Cloudflare context",async()=>{
 const sdk=mockEngine(),ctx={waitUntil(){}};
 const gateway=createIsolatedReactRouterGateway({
   makeRequestHandler:sdk.make,loadServerBuild:sdk.loader,
 });
 const result=await gateway.fetch(request(),env,ctx);
 assert.equal(result.status,200);
 assert.match(await result.text(),/React Router route handler smoke/);
 assert.equal(result.headers.get("set-cookie"),null);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.equal(result.headers.get("content-security-policy"),"default-src 'none'; frame-ancestors 'none'");
 assert.equal(sdk.calls.length,2);
 assert.equal(sdk.calls[0].passedLoader,sdk.loader);
 assert.equal(sdk.calls[0].mode,"production");
 assert.equal(sdk.calls[1].req.url,endpoint);
 assert.equal(sdk.calls[1].context.cloudflare.ctx,ctx);
 assert.deepEqual(sdk.calls[1].context.cloudflare.env,env);
 assert.notEqual(sdk.calls[1].context.cloudflare.env,env);
});
test("prohibits every production/Staging identity, secret and unintended route before framework handler",async()=>{
 const sdk=mockEngine(),gateway=createIsolatedReactRouterGateway({
   makeRequestHandler:sdk.make,loadServerBuild:sdk.loader,
 });
 const badEnvs=[
  {},{APP_ENV:"staging",VSN_BUILD_INTENT:"react-router-ci"},
  {APP_ENV:"production",VSN_BUILD_INTENT:"react-router-ci"},
  {APP_ENV:"test",VSN_BUILD_INTENT:"edge-ssr-ci"},
  {...env,DATABASE_URL:"postgresql://private"},
  {...env,SHOPIFY_API_SECRET:"secret"},
  {...env,CLOUDFLARE_API_TOKEN:"token"},
 ];
 for(const bad of badEnvs){
   assert.equal((await gateway.fetch(request(),bad)).status,503);
 }
 for(const path of ["/app","/app/pages","/auth/callback","/webhooks/app/uninstalled",
   "/readyz","/healthz","/checkout","/__vsn/react-router-smoke?shop=evil"]){
   assert.equal((await gateway.fetch(request(origin+path),env)).status,404,path);
 }
 for(const method of ["POST","PUT","PATCH","DELETE","HEAD"]){
   assert.equal((await gateway.fetch(request(endpoint,{method}),env)).status,404,method);
 }
 for(const forbidden of [
  {authorization:"Bearer fake"},
  {cookie:"shopifySession=fake"},
  {"x-shopify-hmac-sha256":"fake"},
  {"x-shopify-shop-domain":"merchant.myshopify.com"},
 ]){
   assert.equal((await gateway.fetch(request(endpoint,{headers:forbidden}),env)).status,403);
 }
 for(const unsafeOrigin of [
  "https://merchant.myshopify.com","https://builder.example.com",
  "https://vsn-edge.test.attacker.example.net",
  "http://127.0.0.1.evil.test",
 ]){
   assert.equal((await gateway.fetch(request(unsafeOrigin+"/__vsn/react-router-smoke"),env)).status,503);
 }
 assert.equal(sdk.calls.length,0);
});
test("rejects absent or broken factory, invalid router result and thrown secrets",async()=>{
 const expected=request();
 for(const config of [
  {},
  {makeRequestHandler:()=>null,loadServerBuild:async()=>({})},
  {makeRequestHandler:()=>async()=>new Response("oops",{status:500}),loadServerBuild:async()=>({})},
  {makeRequestHandler:()=>async()=>Response.redirect(origin+"/auth"),loadServerBuild:async()=>({})},
  {makeRequestHandler:()=>async()=>new Response("bad",{headers:{"content-type":"application/json"}}),loadServerBuild:async()=>({})},
  {makeRequestHandler:()=>async()=>new Response("<main>x</main>",{headers:{"content-type":"text/html","content-length":"90000"}}),loadServerBuild:async()=>({})},
  {makeRequestHandler:()=>{throw Error("DATABASE_URL leaked")},loadServerBuild:async()=>({})},
 ]){
   const result=await createIsolatedReactRouterGateway(config).fetch(expected,env);
   assert.equal(result.status,503);
   assert.equal(await result.text(),"");
 }
 const sdk=mockEngine({throwError:true});
 const result=await createIsolatedReactRouterGateway({
  makeRequestHandler:sdk.make,loadServerBuild:sdk.loader,
 }).fetch(expected,env);
 assert.equal(result.status,503);
 assert.ok(!(await result.text()).includes("SHOPIFY_SECRET"));
});
test("URL credentials and unrelated origins are never accepted as app access",async()=>{
 const sdk=mockEngine(),gateway=createIsolatedReactRouterGateway({
  makeRequestHandler:sdk.make,loadServerBuild:sdk.loader,
 });
 for(const url of [
  "https://builder.example.com/__vsn/react-router-smoke",
  "https://store.myshopify.com/__vsn/react-router-smoke",
  "https://vsn-edge.test.evil.com/__vsn/react-router-smoke",
 ]){
  const res=await gateway.fetch(request(url),env);
  assert.equal(res.status,503);
 }
 assert.equal(sdk.calls.length,0);
});
test("real hosted app entry remains fail-closed and cannot import CI-only gateway",()=>{
 const hosted=readFileSync("workers/app.js","utf8");
 assert(!hosted.includes("worker-react-router-request-gate"));
 assert.match(hosted,/return locked\(\)/);
 const gateway=readFileSync("app/services/worker-react-router-request-gate.js","utf8");
 assert(!gateway.includes("process.env"));
 assert(!gateway.includes("eval("));
});
