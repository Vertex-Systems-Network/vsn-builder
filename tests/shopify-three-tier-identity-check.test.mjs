import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const keys=["SHOPIFY_DEVELOPMENT_CLIENT_ID","SHOPIFY_STAGING_CLIENT_ID","SHOPIFY_PRODUCTION_CLIENT_ID"];
const canonical="997eae5a9961f21d131e5f31bbbe31d3";
function run(overrides={}){
 const env={PATH:process.env.PATH,
  [keys[0]]:"a".repeat(32),[keys[1]]:"b".repeat(32),[keys[2]]:canonical,
  ...overrides};
 return spawnSync(process.execPath,["scripts/shopify-three-tier-identity-check.mjs"],{
  encoding:"utf8",env,
 });
}
test("one canonical public Production app with two isolated internal identities passes, never prints client IDs",()=>{
 const r=run();
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/uniqueness PASS/);
 assert.match(r.stdout,/NOT verified/);
 for(const id of ["a".repeat(32),"b".repeat(32),canonical]){
  assert(!r.stdout.includes(id));
  assert(!r.stderr.includes(id));
 }
});
test("cross-tier duplicates and case variants are rejected",()=>{
 for(const overrides of [
  {[keys[1]]:"a".repeat(32)},
  {[keys[2]]:"b".repeat(32)},
  {[keys[2]]:"A".repeat(32)},
 ]){
  const r=run(overrides);
  assert.equal(r.status,1);
  assert.match(r.stderr,/must use different Shopify apps|must match canonical public/);
 }
});
test("missing or malformed Shopify identity fails closed",()=>{
 for(const overrides of [
  {[keys[0]]:""},
  {[keys[1]]:"not-an-id"},
  {[keys[2]]:"z".repeat(32)},
 ]){
  const r=run(overrides);
  assert.equal(r.status,1);
  assert.match(r.stderr,/missing or invalid format/);
 }
});
test("canonical public Shopify app is permitted only for Production, never Dev/Staging",()=>{
 for(const key of keys.slice(0,2)){
  const r=run({[key]:canonical});
  assert.equal(r.status,1);
  assert.match(r.stderr,/reuses canonical public Live app/);
  assert(!r.stderr.includes(canonical));
 }
 const prod=run({[keys[2]]:canonical.toUpperCase()});
 assert.equal(prod.status,0,prod.stderr);
 for(const wrong of ["c".repeat(32),"f".repeat(32)]){
  const r=run({[keys[2]]:wrong});
  assert.equal(r.status,1);
  assert.match(r.stderr,/Production Shopify Client ID must match canonical public/);
 }
});
