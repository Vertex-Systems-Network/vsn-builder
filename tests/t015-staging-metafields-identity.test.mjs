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
  assert.match(file, /SHOPIFY_DEVELOPMENT_CLIENT_ID: \$\{\{\s*secrets\.SHOPIFY_DEVELOPMENT_CLIENT_ID/);
  assert.match(file, /"development": require\("SHOPIFY_DEVELOPMENT_CLIENT_ID"\)/);
  assert.match(file, /Development, Staging and Production Shopify Client IDs must differ/);
  assert.match(file, /inputs\.target == 'staging' && 'shiny-violet-61219572' \|\| vars\.NEON_PROJECT_ID/);
  assert.match(file, /inputs\.target == 'staging' && '0ecd6b7151485b41ea65924fe827806a' \|\| secrets\.SHOPIFY_STAGING_CLIENT_ID/);
  assert.match(file, /inputs\.target == 'staging' && '997eae5a9961f21d131e5f31bbbe31d3' \|\| secrets\.SHOPIFY_PRODUCTION_CLIENT_ID/);
  assert.match(file, /NOT certified: Shopify Partner ownership/);
});
