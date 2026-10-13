import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {inspectPhase1GitHubProtection,readPhase1GitHubProtection}
  from "../scripts/phase1-github-protection-observation-check.mjs";

const fresh=()=>structuredClone(readPhase1GitHubProtection());
test("real read-only branch inventory distinguishes protected main from unprotected development",()=>{
 const result=inspectPhase1GitHubProtection(fresh());
 assert.deepEqual(result.issues,[]);
 assert.equal(result.inventory_valid,true);
 assert.equal(result.staging_protected,false);
 assert.equal(result.phase1_closed,false);
 assert(result.blockers.some(x=>x==="development branch is NOT protected"));
 assert(result.blockers.some(x=>x.includes("development has no verified active PR+required-status ruleset")));
 assert(!result.blockers.some(x=>x.startsWith("main")));
});
test("do not infer GitHub Environment protections or secrets from protected main",()=>{
 const obs=fresh();
 assert.equal(obs.branches.main.protected,true);
 assert.equal(obs.branches.development.protected,false);
 assert.equal(obs.preflight_implications.production_real_environment_secrets_verified,false);
 assert(obs.not_verified.some(x=>x.includes("GitHub Environment")));
 assert(obs.not_verified.some(x=>x.includes("Shopify Partner")));
});
test("reject fabricated Staging readiness while development reports unprotected",()=>{
 const obs=fresh();
 obs.preflight_implications.staging_can_dispatch_now=true;
 const result=inspectPhase1GitHubProtection(obs);
 assert(result.issues.some(x=>x.includes("Unprotected development")));
});
test("branch flag alone is not equivalent to enforced development ruleset",()=>{
 const obs=fresh();
 obs.branches.development.protected=true;
 const result=inspectPhase1GitHubProtection(obs);
 assert.equal(result.staging_protected,false);
 assert(result.blockers.some(x=>x.includes("development has no verified active")));
});
test("reject missing/disabled status and pull-request rules and malformed metadata",()=>{
 const obs=fresh();
 obs.rulesets[0].enforcement="disabled";
 obs.rulesets[0].required_status_checks=[];
 obs.extra_secret="do-not-include-secrets";
 const result=inspectPhase1GitHubProtection(obs);
 assert.equal(result.inventory_valid,false);
 assert(result.issues.some(x=>x.includes("Unexpected key")));
 assert(result.blockers.some(x=>x.includes("main has no verified active")));
});
test("synthetic protected development ruleset would unlock branch prerequisite only, not phase closure",()=>{
 const obs=fresh();
 obs.branches.development.protected=true;
 obs.rulesets.push({
  id:123,name:"synthetic development fixture",enforcement:"active",
  branch_refs:["refs/heads/development"],
  rules:["pull_request","required_status_checks"],
  required_status_checks:["verify"],strict_required_status_checks_policy:true,
  pull_request_review_count:1,require_review_thread_resolution:true,
 });
 obs.preflight_implications.staging_can_dispatch_now=true;
 const result=inspectPhase1GitHubProtection(obs);
 assert.deepEqual(result.issues,[]);
 assert.equal(result.staging_protected,true);
 assert.equal(result.phase1_closed,false);
});
test("CLI validates historical evidence but require-staging-protected fails",()=>{
 const historical=spawnSync(process.execPath,[
  "scripts/phase1-github-protection-observation-check.mjs",
 ],{encoding:"utf8"});
 assert.equal(historical.status,0,historical.stderr);
 assert.match(historical.stdout,/historical read-only inventory: VALID/);
 const required=spawnSync(process.execPath,[
  "scripts/phase1-github-protection-observation-check.mjs",
  "--require-staging-protected",
 ],{encoding:"utf8"});
 assert.equal(required.status,1);
 assert.match(required.stderr,/BLOCKED/);
});
