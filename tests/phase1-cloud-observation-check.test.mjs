import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readPhase1Observation,inspectPhase1CloudObservation}
 from "../scripts/phase1-cloud-observation-check.mjs";

const fresh=()=>structuredClone(readPhase1Observation());

test("read-only account snapshots prove resource separation but NOT hosted readiness",()=>{
 const result=inspectPhase1CloudObservation(fresh());
 assert.deepEqual(result.issues,[]);
 assert.equal(result.inventory_valid,true);
 assert.equal(result.hosted_ready,false);
 assert(result.blockers.some(x=>x.includes("staging hosted Worker missing DATABASE_URL")));
 assert(result.blockers.some(x=>x.includes("production hosted Worker missing SHOPIFY_API_SECRET")));
 assert(result.blockers.some(x=>x.includes("production Neon primary branch protection review")));
});
test("reject swapped Neon projects and reused cloud Worker",()=>{
 const invalid=fresh();
 invalid.neon.staging.project_id=invalid.neon.production.project_id;
 invalid.cloudflare.staging.script_name=invalid.cloudflare.production.script_name;
 const result=inspectPhase1CloudObservation(invalid);
 assert.equal(result.inventory_valid,false);
 assert(result.issues.some(x=>x.includes("cannot share infrastructure identities")));
});
test("reject changed resource metadata, invalid bindings and unexpected secret-shaped keys",()=>{
 const invalid=fresh();
 invalid.neon.staging.postgres_version=14;
 invalid.cloudflare.production.secret_binding_names=["invalid secret value"];
 invalid.secret_value="never keep a secret in phase 1 evidence";
 const result=inspectPhase1CloudObservation(invalid);
 assert.equal(result.inventory_valid,false);
 assert(result.issues.some(x=>x.includes("Unexpected sensitive")));
 assert(result.issues.some(x=>x.includes("metadata malformed")));
 assert(result.issues.some(x=>x.includes("binding name inventory invalid")));
});
test("historical snapshot CLI succeeds but explicit hosted-ready requirement fails",()=>{
 const a=spawnSync(process.execPath,["scripts/phase1-cloud-observation-check.mjs"],{
  encoding:"utf8",
 });
 assert.equal(a.status,0,a.stderr);
 assert.match(a.stdout,/HISTORICAL SNAPSHOT/);
 assert.match(a.stdout,/NOT READY/);
 const b=spawnSync(process.execPath,[
  "scripts/phase1-cloud-observation-check.mjs","--require-hosted-ready",
 ],{encoding:"utf8"});
 assert.equal(b.status,1);
 assert.match(b.stderr,/BLOCKED/);
});
test("non-sensitive simulated complete bindings cannot erase missing Shopify/GitHub proof",()=>{
 const obs=fresh();
 for(const tier of ["staging","production"]){
  obs.neon[tier].primary_branch_protected=true;
  obs.cloudflare[tier].secret_binding_names=["SHOPIFY_API_SECRET","DATABASE_URL"];
 }
 const result=inspectPhase1CloudObservation(obs);
 assert.equal(result.hosted_ready,true);
 assert(result.issues.length===0);
 assert(obs.not_verified.some(x=>x.includes("GitHub Environment")));
 assert(obs.not_verified.some(x=>x.includes("Shopify Partner")));
});
