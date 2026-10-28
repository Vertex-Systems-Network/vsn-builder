import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {hostedEnvironmentInventory} from "../scripts/hosted-environment-inventory.js";
const valid=(target)=>({
 APP_ENV:target, SHOPIFY_BILLING_TEST_MODE:target==="staging"?"true":"false",
 SHOPIFY_API_KEY:target==="staging"?"a".repeat(32):"b".repeat(32),
 SHOPIFY_API_SECRET:"do-not-print-SHOPIFY-SECRET",
 SHOPIFY_APP_URL:target==="staging"?"https://staging.builder.test":"https://live.builder.test",
 DATABASE_URL:"postgresql://username:sensitive@pooled.database.test:5432/builder",
 DIRECT_URL:"postgresql://username:sensitive@direct.database.test:5432/builder",
 CLOUDFLARE_ACCOUNT_ID:"c".repeat(32), CLOUDFLARE_API_TOKEN:"do-not-print-CLOUDFLARE-TOKEN",
 CLOUDFLARE_WORKER_NAME:target==="staging"?"vsn-builder-staging":"vsn-builder-production",
 ...(target==="production"?{SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32)}:{})
});
for(const tier of ["staging","production"]) {
 test(tier+" secure inventory succeeds with distinct identities and endpoints",()=>{
   assert.deepEqual(hostedEnvironmentInventory(valid(tier),tier),{ok:true,errors:[]});
 });
 test(tier+" unavailable credentials fail closed without logging secret values",()=>{
   const env=valid(tier);env.SHOPIFY_API_SECRET="";
   const r=hostedEnvironmentInventory(env,tier);
   assert.equal(r.ok,false);
   assert(r.errors.some(e=>e.includes("SHOPIFY_API_SECRET")));
   assert(!JSON.stringify(r).includes("sensitive"));
 });
 test(tier+" invalid API URL, PostgreSQL, and wrong worker are denied",()=>{
   const env=valid(tier);
   env.SHOPIFY_APP_URL="http://localhost:3000"; env.DATABASE_URL="file:../local.sqlite";
   env.CLOUDFLARE_WORKER_NAME="vsn-stock-down-sort-production";
   const r=hostedEnvironmentInventory(env,tier);
   assert.equal(r.ok,false);
   assert(r.errors.some(e=>e.includes("SHOPIFY_APP_URL")));
   assert(r.errors.some(e=>e.includes("DATABASE_URL")));
   assert(r.errors.some(e=>e.includes("Cloudflare Worker")));
 });
}
test("malformed or missing target never reports ready",()=>{
 assert.equal(hostedEnvironmentInventory(valid("staging"),"unknown").ok,false);
 assert.equal(hostedEnvironmentInventory({}, "production").ok,false);
});
test("Local launcher matches the dedicated Shopify Dev app name",()=>{
 const local=fs.readFileSync("scripts/local-development.mjs","utf8");
 assert.match(local,/VSN \| Builder \(Development\)/);
 assert.doesNotMatch(local,/VSN Builder Dev/);
});
test("Production generator emits exact Live name without suggesting blocked deploy command",()=>{
 const gen=fs.readFileSync("scripts/prepare-shopify-production-config.mjs","utf8");
 assert.match(gen,/VSN \| Builder/);
 assert.doesNotMatch(gen,/then npm run deploy:production/);
});

test("protected source branches alone can run hosted secret inventory",()=>{
 const wf=fs.readFileSync(".github/workflows/hosted-environment-secret-inventory.yml","utf8");
 // One job per tier, each pinned to its protected source branch and manual dispatch only.
 assert.match(wf,/github\.event_name == 'workflow_dispatch' && github\.ref_protected == true && github\.ref == 'refs\/heads\/development'/);
 assert.match(wf,/github\.event_name == 'workflow_dispatch' && github\.ref_protected == true && github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(wf,/pull_request|push:/);
});
test("Production app generator enforces exact app name",()=>{
 const gen=fs.readFileSync("scripts/prepare-shopify-production-config.mjs","utf8");
 assert.match(gen,/const appName = "VSN \| Builder";/);
 assert.match(gen,/Production Shopify app name must be/);
});
