import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../workers/app.js";

function parseJsonc(path) {
  return JSON.parse(fs.readFileSync(path,"utf8").replace(/^\s*\/\/.*$/gm,""));
}
test("separate hosted Worker manifests route to one gated source without secrets",()=>{
  for(const [tier,workerName,project] of [
    ["staging","vsn-builder-staging","shiny-violet-61219572"],
    ["production","vsn-builder-production","nameless-violet-68750490"],
  ]){
    const cfg=parseJsonc(`wrangler.${tier}.jsonc`);
    assert.equal(cfg.main,tier==="staging"?"./workers/staging-full-app.js":"./workers/app.js");
    assert.equal(cfg.name,workerName);
    assert.equal(cfg.vars.APP_ENV,tier);
    assert.equal(cfg.vars.VSN_WORKER_NAME,workerName);
    assert.equal(cfg.vars.NEON_PROJECT_ID,project);
    // Staging's verified workers.dev HTTPS transport is enabled, but
    // Production must remain non-public. This is transport only, not
    // approval to bypass the protected migration/OAuth/merchant gates.
    assert.equal(cfg.workers_dev,tier==="staging");
    assert.equal(cfg.vars.VSN_STAGING_OAUTH_ENABLED,tier==="staging"?"true":undefined);
    assert.equal(cfg.vars.VSN_STAGING_DASHBOARD_ENABLED,tier==="staging"?"true":undefined);
    assert.equal(cfg.vars.VSN_STAGING_DRAFT_SAVE_ENABLED,tier==="staging"?"true":undefined);
    assert.equal(cfg.vars.VSN_STAGING_REACT_ROUTER_ENABLED,tier==="staging"?"true":undefined);
    assert.equal(cfg.preview_urls,false);
    assert.equal(cfg.vars.SHOPIFY_BILLING_TEST_MODE,tier==="staging"?"true":"false");
    // Cloudflare Wrangler 4 supports declaring REQUIRED secret NAMES, not
    // secret values. The Stage-only declaration fails a future deploy when
    // encrypted bindings are absent. Neither tier can store them in vars.
    assert(!JSON.stringify(cfg.vars).match(/DATABASE_URL|DIRECT_URL|SHOPIFY_API_SECRET|SHOPIFY_PARTNER_API_TOKEN|NEON_API_KEY|CLOUDFLARE_API_TOKEN/i));
    if(tier==="staging"){
      assert.deepEqual([...cfg.secrets.required].sort(),[
        "DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET","SHOPIFY_PARTNER_API_TOKEN",
      ].sort());
    }else{
      assert.equal(cfg.secrets,undefined,
        "Live remains untouched and cannot inherit Stage required secrets");
    }
  }
});
test("hosted Worker rejects unclassified identity and unsafe application routes",async()=>{
  const origin="https://staging.builder.example.org";
  const env={APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",NEON_PROJECT_ID:"shiny-violet-61219572"};
  const health=await worker.fetch(new Request(origin+"/healthz"),env);
  assert.equal(health.status,200);
  assert.equal(health.headers.get("cache-control"),"no-store");
  assert.equal((await health.json()).merchantAppReady,false);
  for(const route of ["/readyz","/app","/app/pages","/auth/callback","/__vsn/database-health","/app/__vsn/verified-session"]){
    const resp=await worker.fetch(new Request(origin+route),env);
    assert.equal(resp.status,503,`Expected fail-closed ${route}`);
    assert.equal(resp.headers.get("cache-control"),"no-store");
  }
  const wrong={...env,NEON_PROJECT_ID:"nameless-violet-68750490",VSN_WORKER_NAME:"vsn-builder-production"};
  assert.equal((await worker.fetch(new Request(origin+"/healthz"),wrong)).status,503);
  assert.equal((await worker.fetch(new Request(origin+"/__vsn/database-health?debug=1"),env)).status,404);
  assert.equal((await worker.fetch(new Request(origin+"/missing"),env)).status,404);
});
test("unsigned uninstall requests cannot cause merchant deletion",async()=>{
  const request=new Request("https://staging.builder.example.org/webhooks/app/uninstalled",{
    method:"POST",headers:{"content-type":"application/json"},body:"{}",
  });
  const res=await worker.fetch(request,{
    APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",NEON_PROJECT_ID:"shiny-violet-61219572",
  });
  assert.ok([400,401,503].includes(res.status));
  assert.notEqual(res.status,204);
});
test("database readiness requires real Prisma migration history and never reports app readiness",()=>{
  const src=fs.readFileSync("workers/app.js","utf8");
  assert.match(src,/_prisma_migrations/);
  assert.match(src,/isVerifiedWorkerSchemaMetadata/);
  assert.match(src,/SELECT migration_name, checksum, started_at, finished_at, rolled_back_at/);
  assert.match(src,/sourceChecksumAttested:false/);
  assert.match(src,/merchantAppReady:false/);
  assert.match(src,/if\(url.pathname==="\/readyz"/);
  assert.doesNotMatch(src,/return safeJson\(\{ready:true\}/);
});
