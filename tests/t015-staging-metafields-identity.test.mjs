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

test("T015 uses real publicly registered Development ID without requiring a duplicate Staging Environment secret", () => {
  assert.match(file, /SHOPIFY_DEVELOPMENT_CLIENT_ID: \$\\{\\{ inputs\\.target == 'staging' && 'f6156da0bd799053f2f0bd0f9e10983c'/);
  assert.match(file, /Development, Staging and Production Shopify Client IDs must differ/);
  assert.match(file, /NOT certified: Shopify Partner ownership/);
});
test("T015 protected live audit refuses unprotected or PR runs and does not log secret values", () => {
  const audit = fs.readFileSync(".github/workflows/t015-protected-staging-shopify-identity.yml", "utf8");
  assert.match(audit, /github\\.ref_protected == true/);
  assert.match(audit, /github\\.ref == 'refs\\/heads\\/development'/);
  assert.match(audit, /environment: cloudflare-staging/);
  assert.doesNotMatch(audit, /pull_request:|actions\\/checkout|wrangler deploy|prisma migrate|print\\(key\\)|print\\(os\\.environ/);
  assert.match(audit, /SHOPIFY_API_KEY: \$\\{\\{ secrets\\.SHOPIFY_API_KEY \\}\\}/);
  assert.match(audit, /SHOPIFY_API_SECRET: \$\\{\\{ secrets\\.SHOPIFY_API_SECRET \\}\\}/);
  assert.match(audit, /T015_SCOPED_SHOPIFY_STAGING_CLIENT_MISMATCH/);
  assert.match(audit, /NOT certified: Dev store install/);
});
test("T015 hosted readiness uses Staging Environment secrets; real hosted acceptance stays blocked", () => {
  const hosted = fs.readFileSync(".github/workflows/staging-hosted-readiness.yml", "utf8");
  assert.match(hosted, /SHOPIFY_PRODUCTION_CLIENT_ID: 997eae5a9961f21d131e5f31bbbe31d3/);
  assert.match(hosted, /SHOPIFY_APP_URL: https:\/\/vsn-builder-staging\\.vertexsystemsnetwork\\.workers\\.dev/);
  assert.match(hosted, /CLOUDFLARE_ACCOUNT_ID: \$\\{\\{ secrets\\.CLOUDFLARE_ACCOUNT_ID \\}\\}/);
  assert.doesNotMatch(hosted, /vars\\.SHOPIFY_APP_URL|vars\\.SHOPIFY_PRODUCTION_CLIENT_ID|vars\\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(hosted, /VSN_STAGING_NEON_SCHEMA_VERIFIED: \$\\{\\{ vars\\.VSN_STAGING_NEON_SCHEMA_VERIFIED \\}\\}/);
  assert.match(hosted, /VSN_STAGING_NEON_MIGRATIONS_VERIFIED: \$\\{\\{ vars\\.VSN_STAGING_NEON_MIGRATIONS_VERIFIED \\}\\}/);
  assert.match(hosted, /staging-hosted-readiness\\.mjs --require-ready/);
});
