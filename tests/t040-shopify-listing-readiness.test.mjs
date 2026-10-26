import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {canonicalListingImagePath,inspectRealListingPng} from "../scripts/t040-shopify-screenshot-evidence.mjs";
import {spawnSync} from "node:child_process";
import {inspectListingReadiness} from "../scripts/t040-shopify-listing-readiness.mjs";
const original=JSON.parse(readFileSync("config/shopify-listing-readiness.json","utf8"));
const fresh=()=>structuredClone(original);
const syntheticImageInfo=path=>({
 format:"png",width:1600,height:900,
 sha256:createHash("sha256").update(path).digest("hex"),
});


test("draft describes ONE public VSN Builder app, eight paid plans and trial",()=>{
 const result=inspectListingReadiness(fresh());
 assert.equal(result.validDraft,true);
 assert.equal(result.metadataComplete,false);
 assert.equal(result.externallyVerified,false);
 assert.deepEqual(original.commerce.plan_ids,["starter","solo","silver","gold","business","platinum","agency","scale"]);
 assert.deepEqual(original.commerce.monthly_usd,{starter:30,solo:59,silver:100,gold:150,business:249,platinum:350,agency:599,scale:999});
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
 // Syntactically eligible URL only: this fixture deliberately does NOT certify the page exists.
 plan.verified.privacy_policy_url="https://vertexsystemsnetwork.com/privacy-policy";
 plan.verified.support_email="shopify-support@vertexsystemsnetwork.com";
 plan.verified.screenshots=["docs/launch/evidence/one.png","docs/launch/evidence/one.png"];
 const result=inspectListingReadiness(plan,{screenshotProbe:syntheticImageInfo});
 assert(result.missing.includes("five_real_distinct_capture_files"));
 plan.verified.screenshots=["docs/launch/evidence/a.png","docs/launch/evidence/b.png",
  "docs/launch/evidence/c.png","docs/launch/evidence/d.png","docs/launch/evidence/e.png"];
 const metadata=inspectListingReadiness(plan,{screenshotProbe:syntheticImageInfo});
 assert.equal(metadata.metadataComplete,true);
 assert.equal(metadata.externallyVerified,false,"Static metadata is never genuine Partner proof");
});
test("private, credentialed, homepage and reserved policy URLs never satisfy listing gate",()=>{
 for(const url of [
  "https://127.0.0.1/privacy","https://192.168.0.9/privacy",
  "https://10.0.0.1/privacy","https://[::1]/privacy",
  "https://localhost/privacy","https://shop.test/privacy",
  "https://privacy.example.org/privacy","https://example.com./privacy",
  "https://vsn.internal/privacy","https://user:pass@vertexsystemsnetwork.com/privacy",
  "https://vertexsystemsnetwork.com/",
  "https://vertexsystemsnetwork.com/privacy?token=secret",
  "https://vertexsystemsnetwork.com/privacy#frag",
  "http://vertexsystemsnetwork.com/privacy",
 ]){
  const plan=fresh();plan.verified.privacy_policy_url=url;
  assert(inspectListingReadiness(plan).missing.includes("privacy_policy_url"),url);
 }
 const shape=fresh();
 shape.verified.privacy_policy_url="https://vertexsystemsnetwork.com/privacy-policy";
 assert(!inspectListingReadiness(shape).missing.includes("privacy_policy_url"),
  "A public-looking URL passes syntax only, NEVER real HTTPS verification");
 assert.equal(inspectListingReadiness(shape).externallyVerified,false);
});

test("a forged all-true Partner/listing config and mocked capture files still lack external proof",()=>{
 const plan=fresh();
 for(const field of ["shopify_partner_ownership","public_app_identity","plan_publication",
  "stable_live_https","reviewer_access","real_shopify_oauth_e2e","real_shopify_billing_e2e",
  "real_theme_browser_e2e","production_release_accepted"]){
  plan.verified[field]=true;
 }
 plan.verified.privacy_policy_url="https://vertexsystemsnetwork.com/privacy-policy";
 plan.verified.support_email="verified-on-live-server@vertexsystemsnetwork.com";
 plan.verified.screenshots=["a","b","c","d","e"].map(n=>"docs/launch/evidence/"+n+".png");
 plan.release.submission_allowed=true;
 const report=inspectListingReadiness(plan,{screenshotProbe:syntheticImageInfo});
 assert.equal(report.metadataComplete,true);
 assert.equal(report.externallyVerified,false,
  "Self-asserted flags and mocked image existence can never certify submission");
});

test("non-PNG, traversal, alias, near-path and duplicate bytes cannot claim real five screenshots",()=>{
 const plan=fresh();
 plan.verified.screenshots=["1","2","3","4","5"].map(x=>
  "docs/launch/evidence/capture-"+x+".png");
 plan.verified.privacy_policy_url="https://vertexsystemsnetwork.com/privacy-policy";
 plan.verified.support_email="shopify-support@vertexsystemsnetwork.com";
 const completeFields=["shopify_partner_ownership","public_app_identity","plan_publication",
   "stable_live_https","reviewer_access","real_shopify_oauth_e2e",
   "real_shopify_billing_e2e","real_theme_browser_e2e","production_release_accepted"];
 for(const key of completeFields)plan.verified[key]=true;
 assert.equal(inspectListingReadiness(plan,{screenshotProbe:syntheticImageInfo}).metadataComplete,true);
 // Existence alone, with real original folder empty, can NEVER certify assets.
 assert.equal(inspectListingReadiness(plan).metadataComplete,false);
 for(const invalid of [
  "docs/launch/evidence/../fake.png",
  "docs/launch/evidence//double.png",
  "docs/launch/evidence/one.webp",
  "docs/launch/evidence/nested/file.png",
  "docs/launch/evidence/.hidden.png",
  "docs/launch/evidence/one.png?copy=1",
 ]){
  assert.equal(canonicalListingImagePath(invalid),false,invalid);
  assert.equal(inspectRealListingPng(invalid),null,invalid);
  const copy=structuredClone(plan);copy.verified.screenshots[0]=invalid;
  assert(inspectListingReadiness(copy,{screenshotProbe:syntheticImageInfo}).missing.includes(
   "five_real_distinct_capture_files"),invalid);
 }
 for(const probe of [
  ()=>null,
  ()=>({format:"jpg",width:1600,height:900,sha256:"a".repeat(64)}),
  ()=>({format:"png",width:1920,height:1080,sha256:"a".repeat(64)}),
  ()=>({format:"png",width:1600,height:900,sha256:"a".repeat(64)}),
 ]){
  assert(inspectListingReadiness(plan,{screenshotProbe:probe}).missing.includes(
   "five_real_distinct_capture_files"));
 }
 // A syntactically realistic contact email is not independently verified.
 assert.equal(inspectListingReadiness(plan,{screenshotProbe:syntheticImageInfo}).externallyVerified,false);
});

test("reserved fake customer-support domains cannot count as merchant support",()=>{
 const plan=fresh();
 for(const email of [
  "shopify@something.test","support@something.example",
  "contact@localhost","support@company.internal","test@domain.invalid",
 ]){
  plan.verified.support_email=email;
  assert(inspectListingReadiness(plan).missing.includes("support_email"),email);
 }
});

test("strict CLI refuses to release on current unverified listing; draft validation succeeds",()=>{
 const base=spawnSync(process.execPath,["scripts/t040-shopify-listing-readiness.mjs"],{encoding:"utf8"});
 assert.equal(base.status,0,base.stderr);
 assert.match(base.stdout,/NOT VERIFIED/);
 const strict=spawnSync(process.execPath,["scripts/t040-shopify-listing-readiness.mjs","--strict"],{encoding:"utf8"});
 assert.equal(strict.status,1);
 assert.match(strict.stderr,/T040 NOT READY/);
});
