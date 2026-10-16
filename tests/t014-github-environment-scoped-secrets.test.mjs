import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Staging-only T014: mirror Metafields' use of Environment-scoped secrets
// without requiring duplicate GitHub Environment variables.
const file = readFileSync(".github/workflows/t014-protected-github-staging-environment.yml", "utf8");
test("T014 requires protected development, scoped staging Environment, no deploy", () => {
  assert.match(file, /github\.ref_protected == true/);
  assert.match(file, /github\.ref == 'refs\/heads\/development'/);
  assert.match(file, /environment: cloudflare-staging/);
  assert.doesNotMatch(file, /environment: cloudflare-production|pull_request_target|actions\/checkout|wrangler deploy|prisma migrate deploy/);
});
test("T014 reads secret material only from matching GitHub Environment", () => {
  for (const name of ["DATABASE_URL", "DIRECT_URL", "SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
    assert(file.includes(name + ": ${{ secrets." + name + " }}"), name);
  }
  assert.doesNotMatch(file, /\$\{\{\s*vars\./);
  assert.doesNotMatch(file, /print\(os\.environ|echo.*\$DATABASE_URL/);
});
test("T014 pins four safe public constants instead of requiring separately entered vars", () => {
  for (const [name, value] of Object.entries({
    APP_ENV: "staging",
    NEON_PROJECT_ID: "shiny-violet-61219572",
    CLOUDFLARE_WORKER_NAME: "vsn-builder-staging",
    SHOPIFY_BILLING_TEST_MODE: '"true"',
  })) assert(file.includes(name + ": " + value), name);
  assert(file.includes("T014_SHOPIFY_STAGING_CLIENT_ID_MISMATCH"));
  assert(file.includes("T014_NEON_CONNECTION_PAIR_MISMATCH"));
});
