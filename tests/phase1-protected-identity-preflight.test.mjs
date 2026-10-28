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
  REQUESTED_TIER:tier,APP_ENV:tier,SOURCE_BRANCH_PROTECTED:"true",
  SHOPIFY_BILLING_TEST_MODE:tier==="staging"?"true":"false",
  SHOPIFY_API_KEY:tier==="staging"?"0ecd6b7151485b41ea65924fe827806a":"997eae5a9961f21d131e5f31bbbe31d3",
  SHOPIFY_API_SECRET:"ci-do-not-use-merchant-secret",
  SHOPIFY_DEVELOPMENT_CLIENT_ID:"a".repeat(32),
  SHOPIFY_STAGING_CLIENT_ID:"0ecd6b7151485b41ea65924fe827806a",
  SHOPIFY_PRODUCTION_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3",
  SHOPIFY_APP_URL:tier==="staging"?"https://builder-staging.synthetic.dev":"https://builder-live.synthetic.dev",
  NEON_PROJECT_ID:tier==="staging"?"shiny-violet-61219572":"nameless-violet-68750490",
  CLOUDFLARE_WORKER_NAME:tier==="staging"?"vsn-builder-staging":"vsn-builder-production",
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
test("retired weak hosted inventory cannot report Phase 1 acceptance or receive secrets",()=>{
 const legacy=readFileSync(".github/workflows/hosted-environment-secret-inventory.yml","utf8");
 assert.match(legacy,/^  workflow_dispatch:/m);
 assert.doesNotMatch(legacy,/^  push:|^  pull_request:|^  pull_request_target:/m);
 assert.equal((legacy.match(/github\.ref_protected == true/g)||[]).length,2);
 const staging=legacy.split("  staging-inventory:")[1]?.split("  production-inventory:")[0]||"";
 const production=legacy.split("  production-inventory:")[1]||"";
 assert.match(staging,/github\.ref == 'refs\/heads\/development'/);
 assert.doesNotMatch(staging,/github\.ref == 'refs\/heads\/main'/);
 assert.match(production,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(production,/github\.ref == 'refs\/heads\/development'/);
 const executable=legacy.split("\n").filter(line=>!/^\s*#/.test(line)).join("\n");
 // A retired workflow cannot resolve GitHub secrets/vars, select an
 // Environment or accidentally claim a weaker check has passed.
 assert.doesNotMatch(executable,/secrets\.|vars\.|^\s+environment\s*:|^\s+env\s*:/m);
 assert.doesNotMatch(executable,/actions\/checkout|npm (?:install|ci|run)|curl |wget |gh api/);
 assert.equal((executable.match(/exit 1/g)||[]).length,2);
 assert.equal((executable.match(/::error::Legacy inventory is retired/g)||[]).length,2);
 assert.doesNotMatch(executable,/(?:syntax|inventory) PASS|presence\/format PASS/);
 assert.match(executable,/Phase 1 Protected Identity Preflight/);
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
test("both protected tiers refuse missing or swapped Neon Project/Cloudflare Worker identities",()=>{
 for(const tier of ["staging","production"]){
  for(const wrong of [
   {NEON_PROJECT_ID:""},
   {CLOUDFLARE_WORKER_NAME:""},
   {NEON_PROJECT_ID:tier==="staging"?"nameless-violet-68750490":"shiny-violet-61219572"},
   {CLOUDFLARE_WORKER_NAME:tier==="staging"?"vsn-builder-production":"vsn-builder-staging"},
   {NEON_PROJECT_ID:"synthetic-other-project"},
   {CLOUDFLARE_WORKER_NAME:"vsn-builder-another"},
  ]){
   const result=run(tier,wrong);
   assert(fail(result),tier+" must reject missing or cross-tier hosted resource ID");
   assert.match(result.stdout,/project ID|Worker name/);
   assert(!result.stdout.includes("ci_password"));
  }
 }
});
test("manual preflight takes resource names exclusively from protected GitHub Environment vars",()=>{
 assert.match(workflow,/NEON_PROJECT_ID:\s*\$\{\{\s*vars\.NEON_PROJECT_ID\s*\}\}/);
 assert.match(workflow,/CLOUDFLARE_WORKER_NAME:\s*\$\{\{\s*vars\.CLOUDFLARE_WORKER_NAME\s*\}\}/);
 assert.doesNotMatch(workflow,/NEON_PROJECT_ID:\s*\$\{\{\s*github\.event/);
});
test("scoped Staging/Production validator requires three real distinct Shopify Client IDs",()=>{
 for(const tier of ["staging","production"]){
  for(const overrides of [
   {SHOPIFY_DEVELOPMENT_CLIENT_ID:""},
   {SHOPIFY_STAGING_CLIENT_ID:""},
   {SHOPIFY_PRODUCTION_CLIENT_ID:""},
   {SHOPIFY_DEVELOPMENT_CLIENT_ID:"0ecd6b7151485b41ea65924fe827806a"},
   {SHOPIFY_DEVELOPMENT_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3"},
   {SHOPIFY_STAGING_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3"},
   {SHOPIFY_DEVELOPMENT_CLIENT_ID:"0ECD6B7151485B41EA65924FE827806A"},
   {SHOPIFY_STAGING_CLIENT_ID:"z".repeat(32)},
   {SHOPIFY_DEVELOPMENT_CLIENT_ID:"997eae5a9961f21d131e5f31bbbe31d3"},
  ]){
   const result=run(tier,overrides);
   assert(fail(result),tier+" should refuse invalid or duplicate app identities");
   assert(!result.stdout.includes("ci_password"));
   assert(!result.stdout.includes("ci-do-not-use-merchant-secret"));
  }
 }
});
test("protected runner verifies selected GitHub vars instead of comparing its own expected constants",()=>{
 assert.match(workflow,/REQUESTED_TIER:\s*\$\{\{\s*inputs\.target\s*\}\}/);
 assert.match(workflow,/APP_ENV:\s*\$\{\{\s*vars\.APP_ENV\s*\}\}/);
 assert.match(workflow,/SHOPIFY_BILLING_TEST_MODE:\s*\$\{\{\s*vars\.SHOPIFY_BILLING_TEST_MODE\s*\}\}/);
 assert.doesNotMatch(workflow,/APP_ENV:\s*\$\{\{\s*inputs\.target\s*\}\}/);
 assert.doesNotMatch(workflow,/SHOPIFY_BILLING_TEST_MODE:\s*\$\{\{\s*inputs\.target\s*==/);
});
test("configuration vars are resolved at runner step scope after protected environment declaration",()=>{
 const start=workflow.indexOf("      - name: Validate secret presence");
 const stepEnv=workflow.slice(start,workflow.indexOf("        shell: bash",start));
 const jobEnv=workflow.slice(workflow.indexOf("    env:"),workflow.indexOf("    steps:"));
 assert.match(workflow,/environment:.*cloudflare-staging.*cloudflare-production/);
 for(const name of ["APP_ENV","SHOPIFY_BILLING_TEST_MODE","NEON_PROJECT_ID","CLOUDFLARE_WORKER_NAME"]){
  assert.match(stepEnv,new RegExp(name+":\\s*\\$\\{\\{\\s*vars\\."+name+"\\s*\\}\\}"));
  assert.doesNotMatch(jobEnv,new RegExp("vars\\."+name));
 }
});
test("wrong or missing effective GitHub environment vars fail even with valid credentials",()=>{
 for(const [tier,overrides] of [
  ["staging",{APP_ENV:""}],
  ["staging",{APP_ENV:"production"}],
  ["staging",{REQUESTED_TIER:"production"}],
  ["production",{REQUESTED_TIER:"staging"}],
  ["production",{APP_ENV:"staging"}],
  ["production",{APP_ENV:""}],
  ["staging",{SHOPIFY_BILLING_TEST_MODE:""}],
  ["staging",{SHOPIFY_BILLING_TEST_MODE:"false"}],
  ["staging",{SHOPIFY_BILLING_TEST_MODE:"yes"}],
  ["production",{SHOPIFY_BILLING_TEST_MODE:""}],
  ["production",{SHOPIFY_BILLING_TEST_MODE:"true"}],
  ["production",{SHOPIFY_BILLING_TEST_MODE:"0"}],
 ]){
  const r=run(tier,overrides);
  assert(fail(r),"Mismatched scoped variables should be rejected: "+tier);
  assert.match(r.stdout,/Configured APP_ENV|Configured SHOPIFY_BILLING_TEST_MODE|Invalid target tier/);
  assert(!r.stdout.includes("ci_password"));
 }
});
test("scoped Client ID and SDK runtime Client ID must match the exact hosted tier",()=>{
 const cases=[
  ["staging",{SHOPIFY_API_KEY:"997eae5a9961f21d131e5f31bbbe31d3"}],
  ["production",{SHOPIFY_API_KEY:"0ecd6b7151485b41ea65924fe827806a"}],
  ["staging",{SHOPIFY_STAGING_CLIENT_ID:"d".repeat(32)}],
  ["production",{SHOPIFY_PRODUCTION_CLIENT_ID:"d".repeat(32)}],
 ];
 for(const [tier,overrides] of cases){
  const r=run(tier,overrides);
  assert(fail(r),tier+" must reject mismatched app runtime client identity");
  assert.match(r.stdout,/does not match|must differ/);
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
test("protected preflight refuses placeholder IP hosts, callback URL paths and URL credentials",()=>{
 const invalid=[
  "https://builder.example.org",
  "https://staging.example.net",
  "https://builder.test",
  "https://shop.localhost",
  "https://127.0.0.1",
  "https://10.0.0.12",
  "https://user:password@builder-staging.synthetic.dev",
  "https://builder-staging.synthetic.dev:8443",
  "https://builder-staging.synthetic.dev/app",
  "https://builder-staging.synthetic.dev?token=fake",
  "https://builder-staging.synthetic.dev/#frag",
  "http://builder-staging.synthetic.dev",
 ];
 for(const url of invalid){
  const r=run("staging",{SHOPIFY_APP_URL:url});
  assert(fail(r),"Protected workflow must reject unsafe app origin "+url);
  assert(!r.stdout.includes("ci_password"));
 }
 const good=run("staging");
 assert.equal(good.status,0,good.stderr);
});
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
