import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const wf=readFileSync(".github/workflows/development-localhost-smoke.yml","utf8");
const local=readFileSync("scripts/local-development.mjs","utf8");
const example=readFileSync(".env.local.example","utf8");
const devId="f6156da0bd799053f2f0bd0f9e10983c";
test("clean-room Local/Dev CI runs on PR and protected development pushes",()=>{
 assert.match(wf,/pull_request:\s*\n\s*paths:/);
 assert.match(wf,/push:\s*\n\s*branches: \[development\]/);
 assert.match(wf,/node-version: "22\.18\.0"/);
 assert.match(wf,/npm ci/);
 assert.match(wf,/npm run local:prepare/);
 assert.match(wf,/npm run env:local:check/);
 assert.match(wf,/npm run build/);
 assert.match(wf,/node scripts\/dev-loopback-smoke\.mjs/);
});
test("local smoke uses existing dedicated Dev client ID and synthetic non-live auth secret",()=>{
 assert(wf.includes(devId));
 assert(example.includes("SHOPIFY_API_KEY="+devId));
 assert(local.includes('key.toLowerCase() !== expectedDevId'));
 assert.match(wf,/SHOPIFY_API_SECRET: "synthetic-ci-only-shopify-secret"/);
 assert.match(wf,/DATABASE_URL: file:\.\/ci\.sqlite/);
 assert.match(wf,/APP_ENV: development/);
 assert.match(wf,/SHOPIFY_BILLING_TEST_MODE: "true"/);
 assert.match(wf,/git switch -c test\/ci-disposable-local/);
});
test("CI never deploys or consumes hosted credentials",()=>{
 assert.doesNotMatch(wf,/secrets\.[A-Z_]+|vars\.[A-Z_]+|pull_request_target:/);
 assert.doesNotMatch(wf,/shopify app (?:deploy|dev|config push)|wrangler deploy|prisma migrate deploy --schema prisma\/cloud/);
 assert.match(wf,/git diff --exit-code/);
 assert.match(wf,/git check-ignore -q \.env\.local/);
 assert.match(wf,/git check-ignore -q shopify\.app\.local\.toml/);
 for(const forbidden of ["CLOUDFLARE_API_TOKEN","NEON_API_KEY","NEON_PROJECT_ID","DIRECT_URL"])
   assert(wf.includes('test -z "${'+forbidden+':-}"'));
});
