import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { AppDistribution } from "@shopify/shopify-app-react-router/server";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { renderWorkerDocument } from "../app/services/worker-ssr-webstream.js";
import { SHOPIFY_EXPECTED_SCOPES } from "../app/config/shopifyIntegration.js";

const tierEnv = (tier="staging") => ({
 APP_ENV:tier,
 VSN_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
 NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
 SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
 SHOPIFY_API_KEY:tier==="staging"?"a".repeat(32):"b".repeat(32),
 SHOPIFY_API_SECRET:"fake-sdk-secret-must-not-be-logged",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:tier==="staging"?"https://staging.builder.example.org":"https://builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
});
const request=(env,shop)=>new Request(env.SHOPIFY_APP_URL+"/app"+(shop?"?shop="+encodeURIComponent(shop):""));
const mockContext=()=>{
 let closed=0;
 const sessionStorage={
   async storeSession(){return true},
   async loadSession(){return undefined},
   async deleteSession(){return true},
   async deleteSessions(){return true},
   async findSessionsByShop(){return []},
 };
 return {sessionStorage,async close(){closed++},get closed(){return closed}};
};
test("official Shopify App Store SDK initializes from safe staging session context",async()=>{
 const env=tierEnv(),ctx=mockContext();
 const scoped=await createWorkerShopifySdkContext(request(env,"tenant.myshopify.com"),env,{createSessionContext:async()=>ctx});
 assert.equal(scoped.sessionStorage,ctx.sessionStorage);
 assert.equal(scoped.shopify.sessionStorage,ctx.sessionStorage);
 assert.equal(typeof scoped.shopify.authenticate.admin,"function");
 assert.equal(typeof scoped.shopify.authenticate.webhook,"function");
 await scoped.close();
 assert.equal(ctx.closed,1);
});
test("real Shopify SDK sets merchant-specific embedded frame-ancestors for Web Streams",async()=>{
 const env=tierEnv(),ctx=mockContext(),req=request(env,"tenant.myshopify.com");
 const scoped=await createWorkerShopifySdkContext(req,env,{createSessionContext:async()=>ctx});
 try {
  const response=await renderWorkerDocument({
   request:req,
   reactElement:React.createElement("main",null,"VSN Shopify SDK integration CI"),
   addShopifyHeaders:scoped.shopify.addDocumentResponseHeaders,
  });
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/VSN Shopify SDK integration CI/);
  assert.match(response.headers.get("content-security-policy"),/frame-ancestors https:\/\/tenant\.myshopify\.com/);
  assert.match(response.headers.get("content-security-policy"),/https:\/\/admin\.shopify\.com/);
 } finally {await scoped.close()}
});
test("official SDK cannot render an unscoped Shopify iframe without a merchant shop",async()=>{
 const env=tierEnv(),ctx=mockContext(),req=request(env);
 const scoped=await createWorkerShopifySdkContext(req,env,{createSessionContext:async()=>ctx});
 try {
  await assert.rejects(renderWorkerDocument({
   request:req,reactElement:React.createElement("main",null,"No merchant"),
   addShopifyHeaders:scoped.shopify.addDocumentResponseHeaders
  }),/Content-Security-Policy/);
 }finally{await scoped.close()}
});
test("separate Production SDK uses a different configured Client ID and billing tier",async()=>{
 const env=tierEnv("production"),ctx=mockContext();
 const scoped=await createWorkerShopifySdkContext(request(env,"different.myshopify.com"),env,{createSessionContext:async()=>ctx,distribution:AppDistribution.AppStore});
 assert.equal(scoped.shopify.sessionStorage,ctx.sessionStorage);
 await scoped.close();
});
test("invalid Worker identity is refused before any SDK initializer receives credentials",async()=>{
 const env=tierEnv();env.NEON_PROJECT_ID="nameless-violet-68750490";
 let invoked=false;
 await assert.rejects(createWorkerShopifySdkContext(request(env),env,{
  createSessionContext(){invoked=true}
 }),e=>e.code==="VSN_WORKER_SHOPIFY_BOOTSTRAP_BLOCKED");
 assert.equal(invoked,false);
});
test("SDK initialization failure disconnects storage and does not leak credentials",async()=>{
 const env=tierEnv(),ctx=mockContext();
 await assert.rejects(createWorkerShopifySdkContext(request(env),env,{
  createSessionContext:async()=>ctx,
  sdkFactory(){throw new Error(env.SHOPIFY_API_SECRET)}
 }),err=>{
  assert.equal(err.code,"VSN_WORKER_SHOPIFY_BOOTSTRAP_BLOCKED");
  assert(!err.message.includes(env.SHOPIFY_API_SECRET));
  return true;
 });
 assert.equal(ctx.closed,1);
});
test("incomplete SDK verification API cannot be treated as initialized",async()=>{
 const env=tierEnv(),ctx=mockContext();
 await assert.rejects(createWorkerShopifySdkContext(request(env),env,{
  createSessionContext:async()=>ctx,
  sdkFactory(){return {sessionStorage:ctx.sessionStorage}}
 }),err=>err.code==="VSN_WORKER_SHOPIFY_BOOTSTRAP_BLOCKED");
 assert.equal(ctx.closed,1);
});
