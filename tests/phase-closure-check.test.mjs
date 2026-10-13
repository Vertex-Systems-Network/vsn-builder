import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {inspectPhaseSequence,readManifest,PHASE_NAMES} from "../scripts/phase-closure-check.mjs";

function fresh(){return structuredClone(readManifest())}
test("repository maintains eight phases in required immutable order",()=>{
 const {errors,rows}=inspectPhaseSequence(fresh());
 assert.deepEqual(errors,[]);
 assert.equal(rows.length,8);
 assert.deepEqual(rows.map(r=>r.name),PHASE_NAMES);
 assert.equal(rows[0].status,"in_progress");
 assert(rows.slice(1).every(r=>r.status==="queued"));
 assert(rows.some(x=>x.verified>0));
 assert(rows.some(x=>x.blocked>0));
});
test("cannot mark Environment Setup closed until actual identities and scoped secrets are verified",()=>{
 const manifest=fresh();
 manifest.phases[0].status="closed";
 const {errors}=inspectPhaseSequence(manifest);
 assert(errors.some(x=>x.includes("Cannot close phase 1")));
});
test("cannot bypass earlier phases to claim Staging, Shopify or Production closed",()=>{
 const manifest=fresh();
 manifest.phases[0].status="queued";
 manifest.phases[2].status="closed";
 manifest.phases[5].status="in_progress";
 const {errors}=inspectPhaseSequence(manifest);
 assert(errors.some(x=>x.includes("Cannot close phase 3")));
 assert(errors.some(x=>x.includes("Cannot start phase 6")));
});
test("verified claims need a traceable PR or CI run reference, not status alone",()=>{
 const manifest=fresh();
 manifest.phases[0].items[0].evidence=null;
 assert(inspectPhaseSequence(manifest).errors.some(e=>e.includes("traceable GitHub")));
});
test("even after all phase-1 checks gain refs, closure requires correct predecessor ordering",()=>{
 const manifest=fresh();
 const phase1=manifest.phases[0];
 phase1.items.forEach((item)=>{
  item.status="verified";
  item.evidence="https://github.com/Vertex-Systems-Network/vsn-builder/pull/94";
 });
 phase1.status="closed";
 manifest.phases[1].status="in_progress";
 assert.deepEqual(inspectPhaseSequence(manifest).errors,[]);
 // This test uses synthetic refs; it does NOT claim real merchant proof.
 manifest.phases[2].status="closed";
 assert(inspectPhaseSequence(manifest).errors.length>0);
});
test("CLI --require-closed refuses phase 1 without real acceptance",()=>{
 const check=spawnSync(process.execPath,[
  "scripts/phase-closure-check.mjs","--require-closed=1",
 ],{encoding:"utf8"});
 assert.equal(check.status,1);
 assert.match(check.stderr,/NOT independently certified closed/);
});
test("CLI prints all eight phase statuses as a single markdown table",()=>{
 const check=spawnSync(process.execPath,[
  "scripts/phase-closure-check.mjs","--format=markdown",
 ],{encoding:"utf8"});
 assert.equal(check.status,0,check.stderr);
 assert.match(check.stdout,/\| 1 \| Environment Setup \|/);
 assert.match(check.stdout,/\| 8 \| Security, CI & Deployment \|/);
});
