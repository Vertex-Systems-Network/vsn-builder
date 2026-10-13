import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
const keys=["SHOPIFY_DEVELOPMENT_CLIENT_ID","SHOPIFY_STAGING_CLIENT_ID","SHOPIFY_PRODUCTION_CLIENT_ID"];
function run(overrides={}){
 const env={PATH:process.env.PATH,
  [keys[0]]:"a".repeat(32),[keys[1]]:"b".repeat(32),[keys[2]]:"c".repeat(32),
  ...overrides};
 return spawnSync(process.execPath,["scripts/shopify-three-tier-identity-check.mjs"],{
  encoding:"utf8",env,
 });
}
test("three unique synthetic app identities pass without printing actual IDs",()=>{
 const r=run();
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/uniqueness PASS/);
 for(const fake of ["a".repeat(32),"b".repeat(32),"c".repeat(32)]){
  assert(!r.stdout.includes(fake));
  assert(!r.stderr.includes(fake));
 }
 assert.match(r.stdout,/NOT verified/);
});
test("duplicate or case-variant cross-tier Shopify apps always fail",()=>{
 for(const changes of [
  {[keys[1]]:"a".repeat(32)},
  {[keys[2]]:"b".repeat(32)},
  {[keys[2]]:"A".repeat(32)},
 ]){
  const r=run(changes);
  assert.equal(r.status,1);
  assert.match(r.stderr,/must use different Shopify apps/);
  assert(!r.stderr.includes("a".repeat(32)));
 }
});
test("missing or malformed Shopify identity fails closed",()=>{
 for(const changes of [
  {[keys[0]]:""},
  {[keys[1]]:"not-an-id"},
  {[keys[2]]:"z".repeat(32)},
 ]){
  const r=run(changes);
  assert.equal(r.status,1);
  assert.match(r.stderr,/missing or invalid format/);
 }
});
test("unclassified root Shopify app identity cannot be reused in any tier",()=>{
 const sourceId="997eae5a9961f21d131e5f31bbbe31d3";
 for(const key of keys){
  const r=run({[key]:sourceId});
  assert.equal(r.status,1);
  assert.match(r.stderr,/reuses unclassified default app/);
  assert(!r.stderr.includes(sourceId));
 }
});
