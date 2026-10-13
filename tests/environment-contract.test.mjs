import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function verify(mode, extra = {}) {
  return spawnSync(process.execPath, ["scripts/environment-contract.mjs", "--environment=" + mode], {
    encoding: "utf8", env: { PATH: process.env.PATH, ...extra }
  });
}

test("repository three-tier isolation contract is consistent", () => {
  const result = verify("repository");
  assert.equal(result.status, 0, result.stderr);
});
test("local requires Dev identity and test billing", () => {
  const result = verify("local", { APP_ENV: "development", SHOPIFY_BILLING_TEST_MODE: "false",
    DATABASE_URL: "file:./dev.sqlite", SHOPIFY_API_KEY: "bad", SHOPIFY_API_SECRET: "dummy" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /test mode|dedicated Dev/);
});
test("staging denies current Dev app even with a PostgreSQL URL", () => {
  const result = verify("staging", { APP_ENV: "staging", SHOPIFY_BILLING_TEST_MODE: "true",
    SHOPIFY_API_KEY: "997eae5a9961f21d131e5f31bbbe31d3", SHOPIFY_API_SECRET: "dummy",
    SHOPIFY_APP_URL: "https://staging.example.org", DATABASE_URL: "postgresql://test.invalid/db",
    DIRECT_URL: "postgresql://test.invalid/direct" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dedicated non-Dev Shopify app/);
  // An offline migration proposal now exists; this must remain blocked by the
  // missing *actual* Worker runtime and the deliberately unverified Dev identity.
  assert.match(result.stderr, /Cloudflare Worker entry point and configuration are not implemented/);
});
test("production rejects billing-test mode and Dev identity", () => {
  const result = verify("production", { APP_ENV: "production", SHOPIFY_BILLING_TEST_MODE: "true",
    SHOPIFY_API_KEY: "997eae5a9961f21d131e5f31bbbe31d3", SHOPIFY_API_SECRET: "dummy",
    SHOPIFY_PRODUCTION_CLIENT_ID: "997eae5a9961f21d131e5f31bbbe31d3",
    SHOPIFY_APP_URL: "https://live.example.org", DATABASE_URL: "postgresql://test.invalid/db",
    DIRECT_URL: "postgresql://test.invalid/direct" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Billing test mode/);
  assert.match(result.stderr, /dedicated non-Dev Shopify app/);
});

// These fixtures are intentionally synthetic and never contact Neon,
// Cloudflare or Shopify. Phase 1 identity configuration can be checked before
// Phase 3 migrations and Phase 4 Worker routes exist.
function hostedFixture(tier, overrides={}) {
 const staging=tier==="staging";
 const id=staging?"b".repeat(32):"c".repeat(32);
 const endpoint=staging
   ?"ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech"
   :"ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech";
 const pooled=endpoint.replace(".","-pooler.");
 const databaseName=staging?"vsn_stage_ci":"vsn_prod_ci";
 return {
  APP_ENV:tier,
  SHOPIFY_BILLING_TEST_MODE:staging?"true":"false",
  SHOPIFY_API_KEY:id,
  SHOPIFY_API_SECRET:"ci-synthetic-not-a-real-shopify-secret",
  SHOPIFY_APP_URL:staging?"https://staging.builder.example.org":"https://builder.example.org",
  SHOPIFY_PRODUCTION_CLIENT_ID:staging?"c".repeat(32):id,
  DATABASE_URL:`postgresql://ci_user:ci_password@${pooled}/${databaseName}?sslmode=require`,
  DIRECT_URL:`postgresql://ci_user:ci_password@${endpoint}/${databaseName}?sslmode=require`,
  NEON_PROJECT_ID:staging?"shiny-violet-61219572":"nameless-violet-68750490",
  CLOUDFLARE_WORKER_NAME:staging?"vsn-builder-staging":"vsn-builder-production",
  ...overrides,
 };
}
function identityPreflight(tier,overrides={}) {
 return spawnSync(process.execPath,[
  "scripts/environment-contract.mjs","--environment="+tier,"--identity-only",
 ],{encoding:"utf8",env:{PATH:process.env.PATH,...hostedFixture(tier,overrides)}});
}
test("Phase 1 Staging and Production synthetic identity-only preflight validates tier without hosted Worker",()=>{
 for(const tier of ["staging","production"]){
  const result=identityPreflight(tier);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Phase 1 identity\/config/);
  assert.match(result.stdout,/no external identity ownership/);
 }
});
test("Phase 1 refuses wrong Neon project or Cloudflare Worker identity",()=>{
 for(const tier of ["staging","production"]){
  for(const wrong of [
   {NEON_PROJECT_ID:tier==="staging"?"nameless-violet-68750490":"shiny-violet-61219572"},
   {CLOUDFLARE_WORKER_NAME:tier==="staging"?"vsn-builder-production":"vsn-builder-staging"},
   {SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"false":"true"},
  ]){
   const result=identityPreflight(tier,wrong);
   assert.equal(result.status,1,"Wrong identity unexpectedly allowed for "+tier);
   assert.match(result.stderr,/BLOCKED/);
  }
 }
});
test("Phase 1 refuses wrong Neon endpoint, mismatched roles or Production Shopify ID",()=>{
 for(const [tier,overrides] of [
  ["staging",{DIRECT_URL:hostedFixture("production").DIRECT_URL}],
  ["production",{DATABASE_URL:hostedFixture("staging").DATABASE_URL}],
  ["staging",{DIRECT_URL:hostedFixture("staging").DIRECT_URL.replace("ci_user","other_role")}],
  ["production",{SHOPIFY_PRODUCTION_CLIENT_ID:"d".repeat(32)}],
  ["staging",{SHOPIFY_API_KEY:"997eae5a9961f21d131e5f31bbbe31d3"}],
 ]){
  const r=identityPreflight(tier,overrides);
  assert.equal(r.status,1,"Wrong tier/merchant identity incorrectly accepted");
  assert.match(r.stderr,/BLOCKED/);
  assert(!r.stderr.includes("ci_password"),"DB password exposed in error");
  assert(!r.stdout.includes("ci_password"),"DB password exposed in result");
 }
});
test("Legacy hosted preflight still requires Phase 3/4 Worker, even when identity-only passes",()=>{
 for(const tier of ["staging","production"]){
  const r=verify(tier,hostedFixture(tier));
  assert.equal(r.status,1);
  assert.match(r.stderr,/Cloudflare Worker entry point and configuration are not implemented/);
  assert(!r.stdout.includes("Phase 1 identity\/config"));
 }
});
test("Phase 1 option does not let repository contract bypass its ordinary mode",()=>{
 const r=spawnSync(process.execPath,[
  "scripts/environment-contract.mjs","--environment=repository","--identity-only",
 ],{encoding:"utf8",env:{PATH:process.env.PATH}});
 assert.equal(r.status,2);
});
test("no package script can directly deploy or switch to production Shopify config", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const name of ["deploy", "deploy:staging", "deploy:production", "config:use"]) {
    assert.match(pkg.scripts[name], /^node scripts\/deployment-blocked\.mjs /, name + " must fail closed");
  }
  const script = spawnSync(process.execPath, ["scripts/deployment-blocked.mjs", "production"], { encoding: "utf8" });
  assert.equal(script.status, 1);
  assert.match(script.stderr, /BLOCKED|disabled/i);
  assert.match(pkg.scripts["release:production:check"], /env:production:check/);
});

test("local CLI entrypoint never deploys or runs against main", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts.dev, "node scripts/local-development.mjs dev");
  assert.equal(pkg.scripts["local:prepare"], "node scripts/local-development.mjs prepare");
  const local = readFileSync("shopify.app.local.template.toml", "utf8");
  assert.match(local, /client_id = "__SHOPIFY_LOCAL_CLIENT_ID__"/);
  assert.match(readFileSync(".gitignore", "utf8"), /shopify\.app\.local\.toml/);
  assert.match(readFileSync("scripts/local-development.mjs", "utf8"), /process\.loadEnvFile\(file\)/);
});

test("staging is denied without exact Local/Dev acceptance evidence", () => {
  const sha = "a".repeat(40);
  const run = spawnSync(process.execPath,
    ["scripts/verify-environment-promotion.mjs", "--target=staging", "--source=" + sha], {encoding:"utf8"});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Local\/Dev not accepted/);
});
test("production is denied without Staging merchant acceptance evidence", () => {
  const sha = "b".repeat(40);
  const run = spawnSync(process.execPath,
    ["scripts/verify-environment-promotion.mjs", "--target=production", "--source=" + sha], {encoding:"utf8"});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Staging not accepted/);
});
test("unrecognized source SHA is denied before promotion", () => {
  const run = spawnSync(process.execPath,
    ["scripts/verify-environment-promotion.mjs", "--target=staging", "--source=main"], {encoding:"utf8"});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /40-character/);
});
