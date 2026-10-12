import test from "node:test";
import assert from "node:assert/strict";
import {inspectWorkerNeonEnvironment,createWorkerNeonPrisma} from "../app/services/db-worker-neon.js";
const mk=(tier)=>({
 APP_ENV:tier,
 NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
 VSN_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
 SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
 DATABASE_URL:"postgresql://ci-user:fake-ci-password@ep-ci-writer.aws-ap-southeast-1.neon.tech/builder_ci?sslmode=require",
});
test("missing Worker secrets cannot initialize a Prisma Client",()=>{
 assert.equal(inspectWorkerNeonEnvironment({}).ready,false);
 assert.throws(()=>createWorkerNeonPrisma({}),/Worker PostgreSQL runtime blocked/);
});
for(const tier of ["staging","production"]){
 test(tier+" Worker database identity and adapter constructor are isolated",()=>{
   const settings=mk(tier);
   assert.equal(inspectWorkerNeonEnvironment(settings).ready,true);
   let cfg=null;
   class Adapter{constructor(v){cfg=v}}
   class Client{constructor(v){this.options=v}}
   const db=createWorkerNeonPrisma(settings,{Adapter,Client});
   assert.equal(cfg.connectionString,settings.DATABASE_URL);
   assert.equal(db.options.adapter instanceof Adapter,true);
 });
 test(tier+" refuses opposite Neon project/Worker and test billing",()=>{
   const settings=mk(tier);
   settings.NEON_PROJECT_ID=tier==="staging"?"nameless-violet-68750490":"shiny-violet-61219572";
   settings.VSN_WORKER_NAME=tier==="staging"?"vsn-builder-production":"vsn-builder-staging";
   settings.SHOPIFY_BILLING_TEST_MODE=tier==="staging"?"false":"true";
   const status=inspectWorkerNeonEnvironment(settings);
   assert.equal(status.ready,false);
   assert.equal(status.issues.length,3);
 });
}
test("local host, insecure Neon URL and malformed URI cannot pass",()=>{
 const settings=mk("staging");
 for(const url of ["postgresql://a:b@127.0.0.1/local","postgresql://a:b@ep-neon.neon.tech/db","file:dev.sqlite","not-url"]){
  assert.equal(inspectWorkerNeonEnvironment({...settings,DATABASE_URL:url}).ready,false);
 }
});
test("real Prisma Worker adapter constructs client without making a Neon network call",async()=>{
 const fake=mk("staging");
 const db=createWorkerNeonPrisma(fake);
 assert.equal(typeof db.session.findMany,"function");
 await db.$disconnect();
});
test("errors never disclose connection strings or password",()=>{
 const settings=mk("production");
 settings.NEON_PROJECT_ID="wrong";
 assert.throws(()=>createWorkerNeonPrisma(settings),(err)=>{
  assert.equal(err.code,"VSN_WORKER_DATABASE_NOT_READY");
  assert(!String(err.message).includes("fake-ci-password"));
  assert(!String(err.message).includes("ep-ci-writer"));
  return true;
 });
});
