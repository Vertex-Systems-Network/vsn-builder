import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const yaml = readFileSync(new URL("../.github/workflows/t021-staging-worker-deploy.yml", import.meta.url), "utf8");

test("staging deploy is manual-only from protected development with typed confirmation", () => {
  assert.match(yaml, /\non:\n {2}workflow_dispatch:\n/);
  assert.doesNotMatch(yaml, /\n {2}(push|pull_request|pull_request_target|schedule|workflow_run):/);
  assert.match(yaml, /if: github\.ref == 'refs\/heads\/development' && github\.ref_protected == true && inputs\.confirmation == 'DEPLOY_DEVELOPMENT_SHA_TO_STAGING'/);
  assert.match(yaml, /environment: cloudflare-staging\n/);
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /permissions:\n {2}contents: read\n/);
});

test("staging deploy targets only the Staging worker config and never Production", () => {
  assert.match(yaml, /react-router build --config vite\.staging-cloudflare\.config\.js/);
  assert.match(yaml, /wrangler deploy --config dist\/server\/wrangler\.json --keep-vars --secrets-file/);
  assert.doesNotMatch(yaml, /--config wrangler\.production\.jsonc/);
  assert.doesNotMatch(yaml, /environment: (cloudflare-)?production/i);
  assert.match(yaml, /grep -q '"name": "vsn-builder-staging"' dist\/server\/wrangler\.json/);
  assert.doesNotMatch(yaml, /DIRECT_URL: \$\{\{ secrets/);
  assert.doesNotMatch(yaml, /NEON_API_KEY|migrate deploy|db push/);
});

test("staging secret values come only from the protected GitHub staging environment", () => {
  assert.match(yaml, /STAGING_DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}/);
  assert.match(yaml, /STAGING_SHOPIFY_API_KEY: \$\{\{ secrets\.SHOPIFY_API_KEY \}\}/);
  assert.match(yaml, /STAGING_SHOPIFY_API_SECRET: \$\{\{ secrets\.SHOPIFY_API_SECRET \}\}/);
  assert.match(yaml, /STAGING_SHOPIFY_PARTNER_API_ACCESS_TOKEN: \$\{\{ secrets\.SHOPIFY_PARTNER_API_ACCESS_TOKEN \}\}/);
  assert.match(yaml, /SHOPIFY_PARTNER_API_TOKEN: process\.env\.STAGING_SHOPIFY_PARTNER_API_ACCESS_TOKEN/);
  assert.match(yaml, /Missing required GitHub cloudflare-staging environment secrets/);
  assert.match(yaml, /mode: 0o600/);
  assert.match(yaml, /trap 'rm -f "\$secret_file"' EXIT/);
});

test("staging deploy uses pinned actions and no GitHub write credentials", () => {
  assert.match(yaml, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(yaml, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(yaml, /persist-credentials: false/);
  assert.match(yaml, /set \+x/);
});
