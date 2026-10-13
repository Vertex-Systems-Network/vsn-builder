import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const workflow=readFileSync(".github/workflows/phase1-protected-identity-preflight.yml","utf8");
const code=workflow.match(/          python3 - <<'PY'\n([\s\S]*?)\n          PY/);
assert(code,"Protected workflow must use an inlined Python heredoc only");
const python=code[1].split("\n").map(x=>x.replace(/^          /,"")).join("\n");
const endpoint={
 staging:"ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech",
 production:"ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech",
};
const fail=(result)=>result.status!==0;
function run(tier,overrides={}){
 const direct=endpoint[tier];
 const pooled=direct.replace(".","-pooler.");
 const keys={
  APP_ENV:tier,SOURCE_BRANCH_PROTECTED:"true",
  SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
  SHOPIFY_API_KEY:tier==="staging"?"b".repeat(32):"c".repeat(32),
  SHOPIFY_API_SECRET:"ci-do-not-use-merchant-secret",
  SHOPIFY_PRODUCTION_CLIENT_ID:"c".repeat(32),
  SHOPIFY_APP_URL:tier==="staging"?"https://builder-staging.synthetic.dev":"https://builder-live.synthetic.dev",
  CLOUDFLARE_ACCOUNT_ID:"d".repeat(32),
  CLOUDFLARE_API_TOKEN:"ci-not-a-real-token",
  DATABASE_URL:`postgresql://ci_user:ci_password@${pooled}/builder_ci?sslmode=require`,
  DIRECT_URL:`postgresql://ci_user:ci_password@${direct}/builder_ci?sslmode=require`,
  ...overrides,
 };
 return spawnSync("python3",["-c",python],{
  env:{PATH:process.env.PATH,...keys},
  encoding:"utf8",timeout:3000,
 });
}
test("protected GitHub preflight is exclusively manual, protected-branch and environment-scoped",()=>{
 assert.match(workflow,/^  workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^  pull_request:|^  push:|^  pull_request_target:/m);
 assert.match(workflow,/github\.ref_protected == true/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/development'/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/environment:.*cloudflare-staging.*cloudflare-production/);
 assert.doesNotMatch(workflow,/actions\/checkout|npm (?:install|ci|run)|curl |wget |gh api|cloudflare\.request/);
 assert.match(workflow,/set \+x/);
 assert.match(workflow,/contents: read/);
});
test("actual inline workflow preflight accepts isolated CI-only Staging and Production shapes",()=>{
 for(const tier of ["staging","production"]){
  const r=run(tier);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/identity syntax\/tier map: PASS/);
  assert.match(r.stdout,/NOT certified/);
  assert(!r.stdout.includes("ci_password"));
 }
});
test("a workflow run from an unprotected ref never passes even with valid-shaped secrets",()=>{
 for(const tier of ["staging","production"]){
  const r=run(tier,{SOURCE_BRANCH_PROTECTED:"false"});
  assert(fail(r));
  assert.match(r.stdout,/Source branch is not protected/);
 }
});
test("wrong environment, wrong Neon host, wrong app identity, billing mode all fail closed",()=>{
 const cases=[
  ["staging",{APP_ENV:"another"}],
  ["staging",{DIRECT_URL:runUrl(endpoint.production)}],
  ["production",{DATABASE_URL:runUrl(endpoint.staging,true)}],
  ["staging",{SHOPIFY_API_KEY:"997eae5a9961f21d131e5f31bbbe31d3"}],
  ["production",{SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32)}],
  ["staging",{SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32)}],
  ["staging",{SHOPIFY_BILLING_TEST_MODE:"false"}],
  ["production",{SHOPIFY_BILLING_TEST_MODE:"true"}],
 ];
 for(const [tier,wrong] of cases){
  const result=run(tier,wrong);
  assert(fail(result),JSON.stringify([tier,Object.keys(wrong)]));
 }
});
function runUrl(host,pooled=false){
 return `postgresql://ci_user:ci_password@${pooled?host.replace(".","-pooler."):host}/builder_ci?sslmode=require`;
}
test("invalid URL/role/TLS, credentials, public origin must be rejected without leaks",()=>{
 const cases=[
  {DIRECT_URL:runUrl(endpoint.staging).replace("ci_user","other_user")},
  {DATABASE_URL:runUrl(endpoint.staging,true).replace("sslmode=require","sslmode=disable")},
  {SHOPIFY_APP_URL:"https://builder.example.org"},
  {SHOPIFY_APP_URL:"https://builder-staging.synthetic.dev/app"},
  {CLOUDFLARE_API_TOKEN:""},
  {SHOPIFY_API_SECRET:""},
  {CLOUDFLARE_ACCOUNT_ID:"wrong"},
 ];
 for(const wrong of cases){
  const r=run("staging",wrong);
  assert(fail(r),"Malformed scoped identity should not be authorized");
  assert(!r.stdout.includes("ci_password"));
  assert(!r.stdout.includes("ci-do-not-use-merchant-secret"));
  assert(!r.stdout.includes("ci-not-a-real-token"));
 }
});
