// Official Shopify SDK and real Prisma storage against disposable Postgres 18.
// No OAuth tokens, live Shopify requests, Neon URL or Worker deployment.
import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createWorkerShopifySdkContext} from "../app/services/shopify-worker-sdk-context.js";
import {createWorkerShopifySessionContext} from "../app/services/shopify-worker-session-context.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const only="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
assert.equal(process.env.DATABASE_URL,only);
assert.equal(process.env.DIRECT_URL,only);
assert.equal(process.env.NODE_ENV,"test");
const require=createRequire(import.meta.url);
const {PrismaClient}=require("../generated/prisma-cloud/index.js");
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"fake-sdk-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3",
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://unused:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
};
const req=new Request("https://staging.builder.example.org/app?shop=tenant-ci.myshopify.com");
const sessionCtx=(request,e)=>createWorkerShopifySessionContext(request,e,{createDatabase:()=>new PrismaClient()});
test("official Shopify React Router SDK persists a synthetic session using real PostgreSQL Prisma storage",async()=>{
 const scoped=await createWorkerShopifySdkContext(req,env,{createSessionContext:sessionCtx});
 const id="offline_tenant-ci.myshopify.com";
 try{
  assert.equal(typeof scoped.shopify.authenticate.admin,"function");
  assert.equal(typeof scoped.shopify.authenticate.webhook,"function");
  const fake={id,shop:"tenant-ci.myshopify.com",state:"synthetic-no-auth",isOnline:false,
    accessToken:"synthetic-not-real",toObject(){return {}}};
  await scoped.shopify.sessionStorage.storeSession(fake);
  const stored=await scoped.shopify.sessionStorage.loadSession(id);
  assert.equal(stored?.id,id);
  assert.equal(stored?.shop,fake.shop);
  const headers=new Headers();
  scoped.shopify.addDocumentResponseHeaders(req,headers);
  assert.match(headers.get("content-security-policy"),/frame-ancestors https:\/\/tenant-ci\.myshopify\.com/);
 }finally{
  await scoped.shopify.sessionStorage.deleteSession(id);
  await scoped.close();
 }
});
