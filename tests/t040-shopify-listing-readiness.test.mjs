import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {inspectListingReadiness} from "../scripts/t040-shopify-listing-readiness.mjs";
const original=JSON.parse(readFileSync("config/shopify-listing-readiness.json","utf8"));
const fresh=()=>structuredClone(original);

test("draft describes ONE public VSN Builder app, exactly four paid plans and trial",()=>{
 const result=inspectListingReadiness(fresh());
 assert.equal(result.validDraft,true);
 assert.equal(result.metadataComplete,false);
 assert.equal(result.externallyVerified,false);
 assert.deepEqual(original.commerce.plan_ids,["starter","sliver","gold","platinum"]);
 assert.deepEqual(original.commerce.monthly_usd,{starter:30,sliver:100,gold:150,platinum:350});
 assert.equal(original.commerce.annual_usd.platinum,3000);
 assert.equal(original.commerce.trial_days,10);
 assert.equal(original.release.submission_allowed,false);
});
test("unverified privacy, support, actual screenshots and merchant E2E block release",()=>{
 const result=inspectListingReadiness(fresh());
 for(const required of ["privacy_policy_url","support_email","five_real_distinct_capture_files",
  "real_shopify_oauth_e2e","real_shopify_billing_e2e","production_release_accepted"]){
  assert(result.missing.includes(required),required);
 }
});
test("old free plan or unknown pricing may never be approved",()=>{
 for(const edit of [
  x=>x.commerce.free_plan=true,
  x=>x.public_app_count=3,
  x=>x.commerce.plan_ids.push("free"),
  x=>x.commerce.monthly_usd.sliver=99,
  x=>x.commerce.annual_usd.gold=1200,
  x=>x.commerce.trial_days=15,
  x=>x.release.submission_allowed=true,
 ]){
  const plan=fresh();edit(plan);
  assert(inspectListingReadiness(plan).errors.length>0);
 }
});
test("duplicate, fake or missing screenshot paths cannot certify listing",()=>{
 const plan=fresh();
 for(const key of ["shopify_partner_ownership","public_app_identity","plan_publication",
  "stable_live_https","reviewer_access","real_shopify_oauth_e2e",
  "real_shopify_billing_e2e","real_theme_browser_e2e","production_release_accepted"])
  plan.verified[key]=true;
 plan.verified.privacy_policy_url="https://vsn-test.example/privacy";
 plan.verified.support_email="shopify-support@vsn-test.example";
 plan.verified.screenshots=["docs/launch/evidence/one.png","docs/launch/evidence/one.png"];
 const result=inspectListingReadiness(plan,{screenshotExists:()=>true});
 assert(result.missing.includes("five_real_distinct_capture_files"));
 plan.verified.screenshots=["docs/launch/evidence/a.png","docs/launch/evidence/b.png",
  "docs/launch/evidence/c.png","docs/launch/evidence/d.png","docs/launch/evidence/e.png"];
 const metadata=inspectListingReadiness(plan,{screenshotExists:()=>true});
 assert.equal(metadata.metadataComplete,true);
 assert.equal(metadata.externallyVerified,false,"Static metadata is never genuine Partner proof");
});
test("strict CLI refuses to release on current unverified listing; draft validation succeeds",()=>{
 const base=spawnSync(process.execPath,["scripts/t040-shopify-listing-readiness.mjs"],{encoding:"utf8"});
 assert.equal(base.status,0,base.stderr);
 assert.match(base.stdout,/NOT VERIFIED/);
 const strict=spawnSync(process.execPath,["scripts/t040-shopify-listing-readiness.mjs","--strict"],{encoding:"utf8"});
 assert.equal(strict.status,1);
 assert.match(strict.stderr,/T040 NOT READY/);
});
