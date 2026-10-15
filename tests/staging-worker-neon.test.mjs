import test from "node:test";
import assert from "node:assert/strict";
import { createStagingWorkerNeonClient, inspectStagingWorkerNeon } from "../app/services/staging-worker-neon.server.js";

const URL_OK="postgresql://stage_user:do-not-log-this-password@ep-little-dream-b3g6puj2-pooler.c-4.ap-southeast-1.aws.neon.tech/builder?sslmode=require";
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 DATABASE_URL:URL_OK,
};
test("valid Staging-only hosted Neon metadata passes pure policy",()=>{
 assert.deepEqual(inspectStagingWorkerNeon(env),{ready:true,issues:[]});
});
test("injected Client+Adapter construct edge connection without database access",async()=>{
 class FakeAdapter {constructor(options){this.host=new URL(options.connectionString).hostname;}}
 class FakeClient {constructor({adapter}){this.adapter=adapter;}}
 const client=await createStagingWorkerNeonClient(env,{Adapter:FakeAdapter,Client:FakeClient});
 assert.equal(client.adapter.host,"ep-little-dream-b3g6puj2-pooler.c-4.ap-southeast-1.aws.neon.tech");
});
test("staging worker refuses production, production project, and production Shopify ID",()=>{
 for(const wrong of [
  {APP_ENV:"production"},{VSN_WORKER_NAME:"vsn-builder-production"},
  {NEON_PROJECT_ID:"nameless-violet-68750490"},{SHOPIFY_BILLING_TEST_MODE:"false"},
  {SHOPIFY_PRODUCTION_CLIENT_ID:"paid",SHOPIFY_API_KEY:"paid"}
 ]){
   const result=inspectStagingWorkerNeon({...env,...wrong});
   assert.equal(result.ready,false,JSON.stringify(wrong));
 }
});
test("direct migration URL, production host, insecure TLS and malformed URL fail before client construction",async()=>{
 for(const wrong of [
  {DIRECT_URL:URL_OK}, {DATABASE_URL:URL_OK.replace("sslmode=require","sslmode=disable")},
  {DATABASE_URL:URL_OK.replace("ep-little-dream-b3g6puj2","ep-jolly-truth-b3xbibzp")},
  {DATABASE_URL:"file:/tmp/stage.sqlite"},{DATABASE_URL:"not-a-url"}
 ]){
  const invalid={...env,...wrong};
  assert.equal(inspectStagingWorkerNeon(invalid).ready,false);
  await assert.rejects(createStagingWorkerNeonClient(invalid,{Adapter:class{},Client:class{}}),
    /VSN Staging Neon Worker runtime not certified/);
 }
});
test("no credential bytes appear in failure reports",()=>{
 const value=inspectStagingWorkerNeon({...env,DATABASE_URL:URL_OK.replace("sslmode=require","sslmode=disable")});
 assert.ok(!JSON.stringify(value).includes("do-not-log-this-password"));
});
test("adapter construction errors are sanitized",async()=>{
 class BadAdapter {constructor(){throw Error("do-not-log-this-password");}}
 await assert.rejects(createStagingWorkerNeonClient(env,{Adapter:BadAdapter,Client:class{}}),
  e=>e.code==="VSN_STAGING_WORKER_NEON_NOT_READY"&&!e.message.includes("do-not-log-this-password"));
});
