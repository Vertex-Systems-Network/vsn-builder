import assert from "node:assert/strict";
import test from "node:test";
import { assessStaging } from "../scripts/staging-hosted-readiness.mjs";
const base = {
  vars: { VSN_TARGET_ENV: "staging", VSN_STAGING_PLATFORM: "cloudflare-worker",
    SHOPIFY_API_KEY: "test-key", SHOPIFY_API_SECRET: "test-secret",
    SHOPIFY_APP_URL: "https://builder-stage.example.org" },
  appConfig: 'name = "VSN | Builder (Staging)"\napplication_url = "https://builder-stage.example.org"\nredirect_urls = ["https://builder-stage.example.org/auth/callback"]',
  worker: { exists: true, deployments: 1, secretNames: ["SHOPIFY_API_KEY","SHOPIFY_API_SECRET"],
    bindings: [{ type:"d1", name:"DB" }], publicUrlVerified: true },
  hasWranglerConfig: true, hasD1Adapter: true,
};
test("fully evidenced Cloudflare staging readiness is accepted", () => {
  const report = assessStaging(base);
  assert.equal(report.ready, true, JSON.stringify(report.checks.filter(x=>!x.ok)));
});
test("missing staging secrets, database, URL and adapter fail closed", () => {
  const report = assessStaging({ ...base, worker: { exists: true, deployments: 1, secretNames: [], bindings: [], publicUrlVerified:false },
    hasD1Adapter: false, hasWranglerConfig: false });
  assert.equal(report.ready, false);
  const bad = report.checks.filter(x=>!x.ok).map(x=>x.name);
  assert.ok(bad.includes("Persistent D1 database binding"));
  assert.ok(bad.includes("Worker secret SHOPIFY_API_SECRET"));
  assert.ok(bad.includes("D1-compatible Prisma client"));
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
