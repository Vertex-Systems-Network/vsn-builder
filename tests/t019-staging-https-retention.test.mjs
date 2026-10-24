import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "../workers/app.js";

const parse=(path)=>JSON.parse(readFileSync(path,"utf8")
  .replace(/^\s*\/\/[^\n]*(?:\n|$)/gm,"\n"));
const stage=parse("wrangler.staging.jsonc");
const live=parse("wrangler.production.jsonc");

test("Staging HTTPS workers.dev survives approved Wrangler deploys; preview URLs stay disabled",()=>{
  assert.equal(stage.name,"vsn-builder-staging");
  assert.equal(stage.main,"./workers/app.js");
  assert.equal(stage.workers_dev,true);
  assert.equal(stage.preview_urls,false);
  assert.equal(stage.vars.APP_ENV,"staging");
  assert.equal(stage.vars.VSN_WORKER_NAME,"vsn-builder-staging");
  assert.equal(stage.vars.SHOPIFY_BILLING_TEST_MODE,"true");
  // T023 activates Staging-only OAuth, dashboard and draft editor. Production stays disabled.
  assert.equal(stage.vars.VSN_STAGING_OAUTH_ENABLED,"true");
  assert.equal(stage.vars.VSN_STAGING_DASHBOARD_ENABLED,"true");
  assert.equal(stage.vars.VSN_STAGING_DRAFT_SAVE_ENABLED,"true");
});

test("Live remains non-public and cannot inherit Staging bindings",()=>{
  assert.equal(live.name,"vsn-builder-production");
  assert.equal(live.main,"./workers/app.js");
  assert.equal(live.workers_dev,false);
  assert.equal(live.preview_urls,false);
  assert.equal(live.vars.APP_ENV,"production");
  assert.equal(live.vars.SHOPIFY_BILLING_TEST_MODE,"false");
  assert.equal(live.vars.VSN_WORKER_NAME,"vsn-builder-production");
  assert.notEqual(live.vars.NEON_PROJECT_ID,stage.vars.NEON_PROJECT_ID);
  assert.equal(live.vars.VSN_STAGING_DRAFT_SAVE_ENABLED,undefined);
});

test("Staging routes stay closed without bound secrets and verified Shopify sessions",async()=>{
  const origin="https://vsn-builder-staging.vertexsystemsnetwork.workers.dev";
  const env={...stage.vars};
  const health=await worker.fetch(new Request(origin+"/healthz"),env);
  assert.equal(health.status,200);
  assert.equal((await health.json()).merchantAppReady,false);
  for(const req of [
    new Request(origin+"/readyz"),
    new Request(origin+"/app"),
    new Request(origin+"/auth/login"),
    new Request(origin+"/app/__vsn/pages/create",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({title:"Must not create"}),
    }),
    new Request(origin+"/app/__vsn/pages/page_1/content",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({expectedVersion:1,elements:[]}),
    }),
  ]){
    const result=await worker.fetch(req,env);
    assert.equal(result.status,503,req.url);
    assert.equal(await result.text(),"",req.url);
  }
});
