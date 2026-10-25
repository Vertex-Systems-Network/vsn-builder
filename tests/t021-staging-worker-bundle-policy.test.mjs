import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

function config(path){
 return JSON.parse(readFileSync(path,"utf8")
   .replace(/^\s*\/\/[^\n]*(?:\n|$)/gm,"\n"));
}
const staging=config("wrangler.staging.jsonc");
const production=config("wrangler.production.jsonc");
const workflow=readFileSync(".github/workflows/t021-staging-worker-bundle-dryrun.yml","utf8");
const required=["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET","SHOPIFY_PARTNER_API_TOKEN"];

test("exact staging identity requires four pre-existing encrypted secrets by NAME only",()=>{
 assert.equal(staging.name,"vsn-builder-staging");
 assert.equal(staging.main,"./workers/staging-full-app.js");
 assert.equal(staging.vars.APP_ENV,"staging");
 assert.equal(staging.vars.VSN_WORKER_NAME,"vsn-builder-staging");
 assert.equal(staging.vars.NEON_PROJECT_ID,"shiny-violet-61219572");
 assert.equal(staging.vars.SHOPIFY_BILLING_TEST_MODE,"true");
 assert.equal(staging.vars.SHOPIFY_APP_HANDLE,"vsn-builder-staging");
 assert.equal(staging.vars.SHOPIFY_PARTNER_ORGANIZATION_ID,"4859256");
 assert.equal(staging.vars.SHOPIFY_PARTNER_API_VERSION,"2026-07");
 assert.equal(staging.vars.VSN_STAGING_BILLING_SYNC_ENABLED,"true");
 assert.equal(staging.limits,undefined,
   "custom CPU limits are rejected on the Staging Cloudflare Free plan");
 assert.equal(staging.workers_dev,true);
 assert.equal(staging.preview_urls,false);
 assert.deepEqual([...staging.secrets.required].sort(),[...required].sort());
 assert.equal(new Set(staging.secrets.required).size,4);
 for(const name of required) {
   assert.equal(Object.hasOwn(staging.vars,name),false,
     "secret values or sentinel values must not be in plaintext vars");
 }
 for(const name of ["DIRECT_URL","NEON_API_KEY","CLOUDFLARE_API_TOKEN",
   "SHOPIFY_DEVELOPMENT_CLIENT_ID"]){
   assert(!staging.secrets.required.includes(name),name);
 }
 // T023: Staging OAuth, dashboard and draft editor are explicitly activated.
 assert.equal(staging.vars.VSN_STAGING_OAUTH_ENABLED,"true");
 assert.equal(staging.vars.VSN_STAGING_DASHBOARD_ENABLED,"true");
 assert.equal(staging.vars.VSN_STAGING_DRAFT_SAVE_ENABLED,"true");
 assert.equal(staging.vars.VSN_STAGING_REACT_ROUTER_ENABLED,"true");
});
test("production Worker config and no-public-URL policy are independent of staging build",()=>{
 assert.equal(production.name,"vsn-builder-production");
 assert.equal(production.workers_dev,false);
 assert.equal(production.preview_urls,false);
 assert.equal(production.vars.APP_ENV,"production");
 assert.equal(production.vars.VSN_WORKER_NAME,"vsn-builder-production");
 assert.equal(production.limits,undefined,
   "Production Worker limits remain independently configured");
 assert.notEqual(production.vars.NEON_PROJECT_ID,staging.vars.NEON_PROJECT_ID);
 assert.equal(production.vars.VSN_STAGING_DRAFT_SAVE_ENABLED,undefined,"draft save must remain disabled in production");
});
test("T021 PR workflow is credentials-free, real Staging bundle dry-run only",()=>{
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/CI: "true"/);
 assert.match(workflow,/NODE_ENV: test/);
 assert.match(workflow,/APP_ENV: development/);
 assert.match(workflow,/APP_ENV: staging\s+VSN_STAGING_FULL_APP_BUILD: "1"/);
 assert.match(workflow,/WRANGLER_SEND_METRICS: "false"/);
 assert.match(workflow,/npm ci/);
 assert.match(workflow,/@cloudflare\/vite-plugin@1\.64\.0/);
 assert.match(workflow,/prisma generate --schema prisma\/cloud\/schema\.prisma/);
 assert.match(workflow,/react-router build --config vite\.staging-cloudflare\.config\.js/);
 assert.match(workflow,/wrangler deploy --config dist\/server\/wrangler\.json --dry-run --outdir/);
 assert.match(workflow,/--keep-vars/);
 assert.doesNotMatch(workflow,/environment:\s*cloudflare-staging/);
 assert.doesNotMatch(workflow,/\$\{\{\s*secrets\./);
 assert.doesNotMatch(workflow,/\bworkflow_dispatch:/);
 assert.doesNotMatch(workflow,/(?:--config|deploy --config)\s+wrangler\.(?:production|live)(?:\.jsonc)?/i);
 assert.doesNotMatch(workflow,/shopify app deploy/i);
 assert.doesNotMatch(workflow,/prisma migrate (?:deploy|dev|reset)/);
});
