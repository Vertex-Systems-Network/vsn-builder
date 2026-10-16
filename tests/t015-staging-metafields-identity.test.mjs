import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const file = fs.readFileSync(".github/workflows/phase1-protected-identity-preflight.yml", "utf8");
test("T015 Staging identity preflight stays protected, manual and secret-scoped", () => {
  assert.match(file, /workflow_dispatch:/);
  assert.match(file, /github\.ref_protected == true/);
  assert.match(file, /github\.ref == 'refs\/heads\/development'/);
  assert.match(file, /environment: \$\{\{\s*inputs\.target == 'staging' && 'cloudflare-staging'/);
  assert.doesNotMatch(file, /^  push:|^  pull_request:|actions\/checkout|wrangler deploy|prisma migrate deploy/m);
  for (const name of ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "DATABASE_URL", "DIRECT_URL", "CLOUDFLARE_API_TOKEN"]) {
    assert(file.includes("secrets." + name), name);
  }
});
test("T015 pins only nonsecret Staging identifiers from actual live configuration", () => {
  for (const id of [
    "0ecd6b7151485b41ea65924fe827806a",
    "997eae5a9961f21d131e5f31bbbe31d3",
    "https://vsn-builder-staging.vertexsystemsnetwork.workers.dev",
    "shiny-violet-61219572",
    "vsn-builder-staging",
  ]) assert(file.includes(id), "missing expected public staging identity");
  assert.match(file, /SHOPIFY_BILLING_TEST_MODE: \$\{\{ inputs.target == 'staging' && 'true'/);
  assert.match(file, /APP_ENV: \$\{\{ inputs.target == 'staging' && 'staging'/);
});
test("T015 MUST still require distinct real Dev app identity; production fallback unchanged", () => {
  assert(file.includes("SHOPIFY_DEVELOPMENT_CLIENT_ID: ${{ inputs.target == 'staging' && 'f6156da0bd799053f2f0bd0f9e10983c' || secrets.SHOPIFY_DEVELOPMENT_CLIENT_ID }}"));
  assert.match(file, /"development": require\("SHOPIFY_DEVELOPMENT_CLIENT_ID"\)/);
  assert.match(file, /Development, Staging and Production Shopify Client IDs must differ/);
  assert.match(file, /inputs\.target == 'staging' && 'shiny-violet-61219572' \|\| vars\.NEON_PROJECT_ID/);
  assert.match(file, /inputs\.target == 'staging' && '0ecd6b7151485b41ea65924fe827806a' \|\| secrets\.SHOPIFY_STAGING_CLIENT_ID/);
  assert.match(file, /inputs\.target == 'staging' && '997eae5a9961f21d131e5f31bbbe31d3' \|\| secrets\.SHOPIFY_PRODUCTION_CLIENT_ID/);
  assert.match(file, /NOT certified: Shopify Partner ownership/);
});


test("T015 pins the real distinct registered Dev public ID, not an extra Staging secret", () => {
  assert(file.includes("SHOPIFY_DEVELOPMENT_CLIENT_ID: ${{ inputs.target == 'staging' && 'f6156da0bd799053f2f0bd0f9e10983c' || secrets.SHOPIFY_DEVELOPMENT_CLIENT_ID }}"));
  assert(file.includes("Development, Staging and Production Shopify Client IDs must differ"));
});
test("T015 live audit requires protected development before GitHub Staging secrets", () => {
  const audit = fs.readFileSync(".github/workflows/t015-protected-staging-shopify-identity.yml", "utf8");
  for (const required of [
    "github.ref_protected == true", "github.ref == 'refs/heads/development'",
    "environment: cloudflare-staging",
    "SHOPIFY_API_KEY: ${{ secrets.SHOPIFY_API_KEY }}",
    "SHOPIFY_API_SECRET: ${{ secrets.SHOPIFY_API_SECRET }}",
    "T015_SCOPED_SHOPIFY_STAGING_CLIENT_MISMATCH",
    "NOT certified: Dev store install",
  ]) assert(audit.includes(required), required);
  for (const forbidden of [
    "pull_request:", "actions/checkout", "wrangler deploy", "prisma migrate",
    "print(key)", "print(os.environ",
  ]) assert(!audit.includes(forbidden), forbidden);
});
test("T015 hosted readiness source no longer expects duplicate GitHub public vars", () => {
  const hosted = fs.readFileSync(".github/workflows/staging-hosted-readiness.yml", "utf8");
  for (const required of [
    "SHOPIFY_PRODUCTION_CLIENT_ID: 997eae5a9961f21d131e5f31bbbe31d3",
    "SHOPIFY_APP_URL: https://vsn-builder-staging.vertexsystemsnetwork.workers.dev",
    "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    "VSN_STAGING_NEON_SCHEMA_VERIFIED: ${{ vars.VSN_STAGING_NEON_SCHEMA_VERIFIED }}",
    "VSN_STAGING_NEON_MIGRATIONS_VERIFIED: ${{ vars.VSN_STAGING_NEON_MIGRATIONS_VERIFIED }}",
    "staging-hosted-readiness.mjs --require-ready",
  ]) assert(hosted.includes(required), required);
  for (const forbidden of [
    "vars.SHOPIFY_APP_URL", "vars.SHOPIFY_PRODUCTION_CLIENT_ID",
    "vars.CLOUDFLARE_ACCOUNT_ID",
  ]) assert(!hosted.includes(forbidden), forbidden);
});
