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
  assert.match(result.stderr, /PostgreSQL Prisma schema is not implemented/);
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
