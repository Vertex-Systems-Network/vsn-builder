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
  assert.match(yaml, /wrangler deploy --config wrangler\.staging\.jsonc --keep-vars/);
  assert.doesNotMatch(yaml, /--config wrangler\.production\.jsonc/);
  assert.doesNotMatch(yaml, /environment: (cloudflare-)?production/i);
  assert.match(yaml, /grep -q '"name": "vsn-builder-staging"' wrangler\.staging\.jsonc/);
  assert.doesNotMatch(yaml, /DIRECT_URL: \$\{\{ secrets/);
  assert.doesNotMatch(yaml, /NEON_API_KEY|migrate deploy|db push/);
});

test("staging deploy uses pinned actions and no write credentials", () => {
  assert.match(yaml, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(yaml, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(yaml, /persist-credentials: false/);
  assert.match(yaml, /set \+x/);
});
