import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const yaml = readFileSync(".github/workflows/t041-production-deploy.yml", "utf8");
const config = JSON.parse(readFileSync("wrangler.production-full.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));

test("Production deploy is manual, protected-main only and needs the exact confirmation", () => {
  assert.match(yaml, /^on:\n {2}workflow_dispatch:/m);
  assert.doesNotMatch(yaml, /^\s+(push|pull_request):/m);
  const guard = "github.ref == 'refs/heads/main' && github.ref_protected == true && inputs.confirmation == 'DEPLOY_MAIN_SHA_TO_PRODUCTION'";
  assert.equal(yaml.split(guard).length - 1, 2, "both jobs carry the protected-main guard");
  assert.equal(yaml.split("environment: cloudflare-production").length - 1, 2);
  assert.match(yaml, /cancel-in-progress: false/);
});

test("Production backs up Neon before migrating and only runs migrate deploy", () => {
  const backup = yaml.indexOf("Create a Neon backup branch");
  const migrate = yaml.indexOf("run: npx prisma migrate deploy");
  assert.ok(backup > 0 && migrate > backup, "backup precedes migration");
  assert.doesNotMatch(yaml, /migrate dev|db push|accept-data-loss|migrate reset/);
  assert.match(yaml, /needs: migrate-production-database/);
});

test("Production Worker config is the Live tier with real billing and explicit opt-in", () => {
  assert.equal(config.name, "vsn-builder-production");
  assert.equal(config.vars.APP_ENV, "production");
  assert.equal(config.vars.VSN_WORKER_NAME, "vsn-builder-production");
  assert.equal(config.vars.NEON_PROJECT_ID, "nameless-violet-68750490");
  assert.equal(config.vars.SHOPIFY_BILLING_TEST_MODE, "false");
  assert.equal(config.vars.VSN_PRODUCTION_ENABLED, "true");
  assert.equal(config.vars.SHOPIFY_PRODUCTION_CLIENT_ID, "997eae5a9961f21d131e5f31bbbe31d3");
  assert.equal(config.preview_urls, false);
  assert.ok(!JSON.stringify(config).includes("shiny-violet-61219572"), "no Staging Neon identity");
  assert.ok(!JSON.stringify(config).includes("vsn-builder-staging"), "no Staging Worker identity");
});

test("Production secrets come only from the protected environment and are never echoed", () => {
  assert.match(yaml, /set \+x/);
  assert.match(yaml, /--secrets-file "\$secret_file"/);
  assert.doesNotMatch(yaml, /echo "\$\{?(DATABASE_URL|DIRECT_URL|SHOPIFY_API_SECRET|CLOUDFLARE_API_TOKEN)/);
});
