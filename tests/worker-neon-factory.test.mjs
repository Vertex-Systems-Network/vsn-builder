import test from "node:test";
import assert from "node:assert/strict";
import {inspectWorkerNeonEnvironment,createWorkerNeonPrisma} from "../app/services/db-worker-neon.js";
const mk=(tier)=>({
 APP_ENV:tier,
 NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
 VSN_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
 SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
 DATABASE_URL:"postgresql://ci-user:fake-ci-password@"+(tier==="staging"?"ep-little-dream-b3g6puj2":"ep-jolly-truth-b3xbibzp")+".c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
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
test("a URL pointing to the other tier is blocked even with apparently valid Worker/project variables",()=>{
 for(const tier of ["staging","production"]){
  const other=tier==="staging"?"production":"staging";
  const env={...mk(tier),DATABASE_URL:mk(other).DATABASE_URL};
  const report=inspectWorkerNeonEnvironment(env);
  assert.equal(report.ready,false);
  assert(report.issues.includes("Neon endpoint identity mismatch"));
  assert.throws(()=>createWorkerNeonPrisma(env),{code:"VSN_WORKER_DATABASE_NOT_READY"});
 }
});
test("Neon hostname lookalikes, unknown endpoints and unexpected ports fail closed",()=>{
 const env=mk("staging");
 const tests=[
  env.DATABASE_URL.replace(".c-4.",".attacker.c-4."),
  env.DATABASE_URL.replace("ep-little-dream-b3g6puj2","ep-unknown-project"),
  env.DATABASE_URL.replace(".neon.tech",".neon.tech.attacker.test"),
  env.DATABASE_URL.replace("/builder_ci",":6543/builder_ci"),
 ];
 for(const DATABASE_URL of tests){
  assert.equal(inspectWorkerNeonEnvironment({...env,DATABASE_URL}).ready,false,DATABASE_URL.split("@")[1]);
 }
});
test("Worker denies duplicate SSL modes and URI fragments before Prisma construction",()=>{
 for(const tier of ["staging","production"]){
  const cfg=mk(tier);
  for(const DATABASE_URL of [
   cfg.DATABASE_URL+"&sslmode=disable",
   cfg.DATABASE_URL+"&sslmode=require",
   cfg.DATABASE_URL+"#ignored-fragment",
  ]){
   const env={...cfg,DATABASE_URL};
   const report=inspectWorkerNeonEnvironment(env);
   assert.equal(report.ready,false,"Unexpected accepted Worker URI");
   assert.throws(()=>createWorkerNeonPrisma(env),{
    code:"VSN_WORKER_DATABASE_NOT_READY",
   });
   assert(!JSON.stringify(report).includes("fake-ci-password"));
  }
 }
});

test("expected direct and pooled Neon endpoint variants are admitted without opening a connection",()=>{
 for(const tier of ["staging","production"]){
  const env=mk(tier);
  assert.equal(inspectWorkerNeonEnvironment(env).ready,true);
  const DATABASE_URL=env.DATABASE_URL.replace(".c-4.", "-pooler.c-4.");
  assert.equal(inspectWorkerNeonEnvironment({...env,DATABASE_URL}).ready,true);
 }
});
test("Worker refuses an accidentally bound opposite-tier direct migration URL",()=>{
 for(const tier of ["staging","production"]){
  const other=tier==="staging"?"production":"staging";
  const valid=mk(tier);
  const bad={
    ...valid,
    DIRECT_URL:mk(other).DATABASE_URL,
  };
  const status=inspectWorkerNeonEnvironment(bad);
  assert.equal(status.ready,false);
  assert(status.issues.some(issue=>issue.includes("direct Neon endpoint")));
  assert.throws(()=>createWorkerNeonPrisma(bad),{code:"VSN_WORKER_DATABASE_NOT_READY"});
 }
});
test("Worker accepts an isolated matching direct migration URL without DB I/O",()=>{
 for(const tier of ["staging","production"]){
  const cfg=mk(tier);
  const pooled=cfg.DATABASE_URL.replace(".c-4.", "-pooler.c-4.");
  assert.equal(inspectWorkerNeonEnvironment({...cfg,DATABASE_URL:pooled,DIRECT_URL:cfg.DATABASE_URL}).ready,true);
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
