import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {inspectListingDraft} from "../scripts/t040-shopify-listing-gate.mjs";

test("draft listing honors one VSN Builder listing and all four canonical paid plan contracts",()=>{
 const state=inspectListingDraft();
 assert.deepEqual(state.failures,[]);
 assert.equal(state.draftValid,true);
 assert.equal(state.onePublicApp,true);
 assert.deepEqual(state.paidPlans,["starter","sliver","gold","platinum"]);
 assert(state.pending.includes("VERIFIED_PRIVACY_POLICY_URL"));
 assert(state.pending.includes("PARTNER_OWNER_AND_PLAN_PROOF"));
 assert(state.pending.includes("REAL_SHOPIFY_E2E_SHOP_PROOF"));
 assert.equal(state.ready,false,"source docs must not certify an installed Shopify app");
});

test("release assertion fails closed while actual screenshots and public policy proof are absent",()=>{
 const report=spawnSync(process.execPath,["scripts/t040-shopify-listing-gate.mjs"],{
  encoding:"utf8",
 });
 assert.equal(report.status,0,report.stderr);
 assert.match(report.stdout,/Shopify release-listing READY: NO/);
 const blocked=spawnSync(process.execPath,["scripts/t040-shopify-listing-gate.mjs","--assert-ready"],{
  encoding:"utf8",
 });
 assert.equal(blocked.status,1);
 assert.doesNotMatch(blocked.stdout,/Shopify release-listing READY: YES/);
});

test("a fake listing, free plan or missing privacy notice cannot pass draft QA",()=>{
 const template=readFileSync("docs/launch/shopify-builder-app-store-listing-draft.md","utf8");
 const dir=mkdtempSync(path.join(os.tmpdir(),"vsn-t040-"));
 try{
  const target=path.join(dir,"docs/launch");
  mkdirSync(target,{recursive:true});
  for(const [find,replace,code] of [
   ["**App name:** VSN | Builder","**App name:** Fake Public App","WRONG_APP_NAME"],
   ["| Sliver | `sliver` | 100 | — | 10 days |","| Free | `free` | 0 | — | — |","DRAFT_PLAN_sliver_MISMATCH"],
   ["**Privacy Policy public HTTPS URL:** NOT VERIFIED","**Privacy Policy public HTTPS URL:** https://example.test","PRIVACY_POLICY_UNVERIFIED_NOTICE_MISSING"],
  ]){
   writeFileSync(path.join(target,"shopify-builder-app-store-listing-draft.md"),template.replace(find,replace));
   const state=inspectListingDraft({rootDir:dir});
   assert.equal(state.draftValid,false,find);
   assert(state.failures.includes(code),JSON.stringify(state));
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
});
