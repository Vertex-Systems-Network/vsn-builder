import assert from "node:assert/strict";
import test from "node:test";
import { assessStaging } from "../scripts/staging-hosted-readiness.mjs";
const base = {
  vars: { VSN_TARGET_ENV: "staging", VSN_STAGING_PLATFORM: "cloudflare-worker",
    SHOPIFY_API_KEY: "test-key", SHOPIFY_API_SECRET: "test-secret",
    SHOPIFY_APP_URL: "https://builder-stage.example.org",
    VSN_STAGING_DATABASE_PROVIDER:"neon-postgresql", NEON_PROJECT_ID:"shiny-violet-61219572",
    VSN_STAGING_NEON_SCHEMA_VERIFIED:"1", VSN_STAGING_NEON_MIGRATIONS_VERIFIED:"1" },
  appConfig: 'name = "VSN | Builder (Staging)"\napplication_url = "https://builder-stage.example.org"\nredirect_urls = ["https://builder-stage.example.org/auth/callback"]',
  worker: { exists: true, deployments: 1, secretNames: ["SHOPIFY_API_KEY","SHOPIFY_API_SECRET","DATABASE_URL"],
    bindings: [], publicUrlVerified: true },
  hasWranglerConfig: true, hasNeonAdapter: true, hasWorkerMerchantRuntime: true,
};
test("fully evidenced Cloudflare staging readiness is accepted", () => {
  const report = assessStaging(base);
  assert.equal(report.ready, true, JSON.stringify(report.checks.filter(x=>!x.ok)));
});
test("missing staging secrets, database, URL and adapter fail closed", () => {
  const report = assessStaging({ ...base, worker: { exists: true, deployments: 1, secretNames: [], bindings: [], publicUrlVerified:false },
    hasNeonAdapter: false, hasWorkerMerchantRuntime: false, hasWranglerConfig: false });
  assert.equal(report.ready, false);
  const bad = report.checks.filter(x=>!x.ok).map(x=>x.name);
  assert.ok(bad.includes("Worker Neon DATABASE_URL secret"));
  assert.ok(bad.includes("Worker secret SHOPIFY_API_SECRET"));
  assert.ok(bad.includes("Worker Neon Prisma adapter"));
  assert.ok(bad.includes("Worker merchant SSR/OAuth integration"));
});
test("production targeting is rejected even if deployment settings exist", () => {
  assert.equal(assessStaging({ ...base, vars: { ...base.vars, VSN_TARGET_ENV:"production" } }).ready, false);
});
test("placeholder and ephemeral URLs are rejected", () => {
  assert.equal(assessStaging({ ...base, vars:{ ...base.vars, SHOPIFY_APP_URL:"https://example.com" } }).ready, false);
  assert.equal(assessStaging({ ...base, vars:{ ...base.vars, SHOPIFY_APP_URL:"https://abc.trycloudflare.com" } }).ready, false);
});
test("Node staging requires durable SQLite and externally verified health", () => {
  const b = { ...base, vars: { ...base.vars, VSN_STAGING_PLATFORM:"node", DATABASE_URL:"file:./staging.db" } };
  assert.equal(assessStaging(b).ready, false);
  assert.equal(assessStaging({ ...b, vars: { ...b.vars, VSN_STAGING_PERSISTENT_STORAGE_VERIFIED:"1",
    VSN_STAGING_HOST_HEALTH_VERIFIED:"1" } }).ready, true);
});

test("Neon default branch without migration proof blocks Shopify staging", () => {
  const v={...base.vars, VSN_STAGING_NEON_SCHEMA_VERIFIED:"0",VSN_STAGING_NEON_MIGRATIONS_VERIFIED:"0"};
  const report=assessStaging({...base,vars:v});
  assert.equal(report.ready,false);
  assert.ok(report.checks.some(x=>x.name==="Neon default branch schema attested"&&!x.ok));
  assert.ok(report.checks.some(x=>x.name==="Neon migration ledger attested"&&!x.ok));
});
test("Neon staging is isolated from Production and D1 is optional", () => {
  const v={...base.vars,NEON_PROJECT_ID:"nameless-violet-68750490"};
  const report=assessStaging({...base,vars:v});
  assert.equal(report.ready,false);
  assert.ok(report.checks.some(x=>x.name==="Staging Neon project identity"&&!x.ok));
  assert.equal(base.worker.bindings.length,0);
});
test("D1 alternative requires actual D1 and compatible Prisma and app runtime",()=>{
  const v={...base.vars,VSN_STAGING_DATABASE_PROVIDER:"d1"};
  assert.equal(assessStaging({...base,vars:v}).ready,false);
  const r=assessStaging({...base,vars:v,hasD1Adapter:true,worker:{...base.worker,bindings:[{type:"d1_database",name:"DB"}]}});
  assert.equal(r.ready,true);
});
