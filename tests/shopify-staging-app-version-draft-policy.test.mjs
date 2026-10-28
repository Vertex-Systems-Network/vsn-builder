import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/t021-shopify-staging-app-version-draft.yml", "utf8");
const workerDeploy = readFileSync(".github/workflows/t021-staging-worker-deploy.yml", "utf8");

test("Shopify Staging app draft is protected, exact-development and manual", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/development'/);
  assert.match(workflow, /github\.ref_protected == true/);
  assert.match(workflow, /CREATE_STAGING_SHOPIFY_APP_DRAFT/);
  assert.match(workflow, /environment: cloudflare-staging/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /node-version: "22\.18\.0"/);
});

test("Shopify draft is scoped to Staging and cannot release or delete app components", () => {
  assert.match(workflow, /SHOPIFY_API_KEY/);
  assert.match(workflow, /SHOPIFY_APP_AUTOMATION_TOKEN/);
  assert.match(workflow, /--config staging/);
  assert.doesNotMatch(workflow, /--allow-updates/);
  assert.match(workflow, /--no-release/);
  assert.doesNotMatch(workflow, /--allow-deletes|SHOPIFY_FLAG_ALLOW_DELETES|shopify" app release/);
  assert.doesNotMatch(workerDeploy, /@shopify\/cli|shopify" app deploy/);
});

test("Staging config placeholder is replaced only in the ephemeral runner", () => {
  assert.match(workflow, /__SHOPIFY_STAGING_CLIENT_ID__/);
  assert.match(workflow, /shopify\.app\.staging\.toml/);
  assert.match(workflow, /writeFileSync\(path, source\.replace/);
  assert.match(workflow, /trap 'git restore --worktree -- shopify\.app\.staging\.toml' EXIT/);
  assert.match(workflow, /git diff --exit-code -- package\.json package-lock\.json shopify\.app\.staging\.toml/);
});
