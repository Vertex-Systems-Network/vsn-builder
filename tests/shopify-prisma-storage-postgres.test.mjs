// Actual Shopify PrismaSessionStorage in a disposable PostgreSQL 18 service.
// No Neon connections, real merchant tokens or hosted credentials.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createWorkerShopifySessionContext } from "../app/services/shopify-worker-session-context.js";
import { SHOPIFY_EXPECTED_SCOPES } from "../app/config/shopifyIntegration.js";

const ci="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
assert.equal(process.env.DATABASE_URL,ci);
assert.equal(process.env.DIRECT_URL,ci);
assert.equal(process.env.NODE_ENV,"test");
const require=createRequire(import.meta.url);
const {PrismaClient}=require("../generated/prisma-cloud/index.js");
const env={
 APP_ENV:"staging", VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572", SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"fake-no-shopify",
 SHOPIFY_PRODUCTION_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3",
 SHOPIFY_APP_URL:"https://staging.builder.example.org",SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci-user:not-used@ep-fake.aws.neon.tech/not_used?sslmode=require"
};
const request=new Request("https://staging.builder.example.org/app");
const mk=()=>createWorkerShopifySessionContext(request,env,{createDatabase:()=>new PrismaClient()});
const prefix="builder-ci-prisma-storage-";

test("real Shopify Prisma storage persists, reloads and deletes offline sessions",async()=>{
 const id="offline_tenant-one.myshopify.com";
 const first=await mk();
 try {
  const session={id,shop:"tenant-one.myshopify.com",state:"synthetic-oauth-state",isOnline:false,scope:"read_products",accessToken:"synthetic-ci-token",toObject(){return {}}};
  assert.equal(await first.sessionStorage.storeSession(session),true);
  const loaded=await first.sessionStorage.loadSession(id);
  assert.equal(loaded?.shop,"tenant-one.myshopify.com");
  assert.equal(loaded?.accessToken,"synthetic-ci-token");
 }finally{await first.close()}
 const next=await mk();
 try {
  const resumed=await next.sessionStorage.loadSession(id);
  assert.equal(resumed?.id,id,"session must survive a Prisma instance restart");
  assert.equal(await next.sessionStorage.deleteSession(id),true);
  assert.equal(await next.sessionStorage.loadSession(id),undefined);
 }finally{await next.close()}
});
test("real Shopify session lookup only returns sessions for the selected merchant",async()=>{
 const ctx=await mk();
 const ids=["offline_merchant-one.myshopify.com","offline_merchant-two.myshopify.com"];
 try{
  const shops=["merchant-one.myshopify.com","merchant-two.myshopify.com"];
  for(let i=0;i<ids.length;i++){
   const session={id:ids[i],shop:shops[i],state:"synthetic-state",isOnline:false,accessToken:"not-real",toObject(){return {}}};
   await ctx.sessionStorage.storeSession(session);
  }
  const one=await ctx.sessionStorage.findSessionsByShop(shops[0]);
  assert(one.some(x=>x.id===ids[0]));
  assert(!one.some(x=>x.id===ids[1]));
 }finally {
  await ctx.sessionStorage.deleteSessions(ids);
  await ctx.close();
 }
});
test("real online Shopify session stores staff-member details in Prisma",async()=>{
 const ctx=await mk();
 const id=prefix+"online";
 const offlineId="offline_staff-tenant.myshopify.com";
 try{
  // Online user sessions require an active, fenced OFFLINE installation.
  // Creating a fake online session directly without this install must fail.
  await ctx.sessionStorage.storeSession({
   id:offlineId,shop:"staff-tenant.myshopify.com",state:"synthetic",
   isOnline:false,accessToken:"synthetic-ci-install-token",toObject(){return {}},
  });
  const session={
   id,shop:"staff-tenant.myshopify.com",state:"synthetic",isOnline:true,accessToken:"synthetic-online-token",
   toObject(){return {onlineAccessInfo:{associated_user:{
    id:12345,first_name:"Test",last_name:"Staff",email:"staff@example.invalid",
    account_owner:false,locale:"en",collaborator:false,email_verified:true
   }}}}
  };
  await ctx.sessionStorage.storeSession(session);
  const row=await ctx.database.session.findUnique({where:{id}});
  assert.equal(row?.isOnline,true);
  assert.equal(String(row?.userId),"12345");
  assert.equal(row?.email,"staff@example.invalid");
  assert.equal(row?.emailVerified,true);
 }finally{
  await ctx.sessionStorage.deleteSessions([id,offlineId]);
  await ctx.close();
 }
});
