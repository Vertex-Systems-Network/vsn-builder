import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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
