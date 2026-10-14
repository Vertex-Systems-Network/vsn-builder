import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readTaskPlan,inspectTaskPlan} from "../scripts/task-dependency-check.mjs";

const fresh=()=>structuredClone(readTaskPlan());
const find=(plan,id)=>plan.tasks.find(t=>t.id===id);

test("canonical task board is valid, explicitly dependency-driven, and has 41 atomic tasks",()=>{
 const plan=fresh();
 const result=inspectTaskPlan(plan);
 assert.deepEqual(result.errors,[]);
 assert.equal(plan.policy,"dependency_driven_evidence_first_no_phase_gating");
 assert.equal(plan.tasks.length,41);
 assert.equal(result.summary.verified,9);
 assert.equal(result.summary.in_review,6);
 assert.equal(result.summary.ready,7);
 assert.equal(plan.public_shopify_apps,1);
 assert.deepEqual(plan.commercial_plans.map(p=>p.id),["starter","sliver","gold","platinum"]);
 assert(plan.commercial_plans.every(p=>p.trial_days===10));
 assert.equal(plan.commercial_plans[3].annual_usd,3000);
});
test("unrelated workstreams run READY without an earlier phase or cloud prerequisites",()=>{
 const {rows}=inspectTaskPlan(fresh());
 const ready=new Set(rows.filter(r=>r.execution==="READY").map(r=>r.id));
 for(const id of ["T011","T013","T014","T015","T024","T032","T040"])
  assert(ready.has(id),"Expected independent READY task "+id);
 for(const id of ["T018","T021","T023","T025","T029","T031","T037","T038","T041"])
  assert.equal(rows.find(r=>r.id===id).execution,"WAITING",id);
 assert.equal(rows.find(r=>r.id==="T017").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T012").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T020").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T027").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T026").execution,"IN_REVIEW");
});
test("blocking one task cannot artificially block independent READY tasks",()=>{
 const plan=fresh();
 find(plan,"T016").depends_on.push("T011");
 const {errors,rows}=inspectTaskPlan(plan);
 assert.deepEqual(errors,[]);
 assert.equal(rows.find(r=>r.id==="T020").execution,"READY");
 assert.equal(rows.find(r=>r.id==="T040").execution,"READY");
});
test("cycles, duplicate dependencies and unknown prerequisite fail",()=>{
 for(const mutation of [
  p=>find(p,"T011").depends_on.push("T038"),
  p=>find(p,"T012").depends_on=["T011","T011"],
  p=>find(p,"T015").depends_on=["T999"],
  p=>find(p,"T020").depends_on=["T020"],
 ]){
  const plan=fresh();mutation(plan);
  assert(inspectTaskPlan(plan).errors.length>0);
 }
});
test("never declare a release or Shopify review verified while direct security gates are pending",()=>{
 for(const id of ["T037","T038","T039","T041"]){
  const plan=fresh();
  find(plan,id).status="verified";
  find(plan,id).evidence=["https://github.com/Vertex-Systems-Network/vsn-builder/pull/155"];
  assert(inspectTaskPlan(plan).errors.some(e=>e.includes("unverified prerequisite")),id);
 }
 const plan=fresh();
 find(plan,"T041").depends_on=["T039"];
 assert(inspectTaskPlan(plan).errors.some(e=>e.includes("Live/Shopify safety")), "required gates never waived");
});
test("verified and in-review evidence must be present and source-traceable",()=>{
 const a=fresh();
 find(a,"T004").evidence=[];
 assert(inspectTaskPlan(a).errors.some(e=>e.includes("Verified task missing")));
 const b=fresh();
 find(b,"T017").evidence=[];
 assert(inspectTaskPlan(b).errors.some(e=>e.includes("In-review task missing")));
 const c=fresh();
 find(c,"T005").evidence=["https://untrusted.example.org/done"];
 assert(inspectTaskPlan(c).errors.some(e=>e.includes("traceable same-repository")));
});
test("must remain ONE public Shopify app with exact four PAID prices and 10-day trials",()=>{
 const plan=fresh();
 plan.public_shopify_apps=3;
 assert(inspectTaskPlan(plan).errors.some(e=>e.includes("ONE public")));
 for(const mutation of [
  p=>p.commercial_plans.unshift({name:"Free",id:"free",monthly_usd:0,annual_usd:null,trial_days:0}),
  p=>p.commercial_plans[1].id="silver",
  p=>p.commercial_plans[3].annual_usd=0,
  p=>p.commercial_plans[0].trial_days=7,
 ]){
  const p=fresh();mutation(p);
  assert(inspectTaskPlan(p).errors.some(e=>e.includes("Four paid canonical")));
 }
});
test("CLI prints actionable tasks and blocks unverified terminal acceptance",()=>{
 const ok=spawnSync(process.execPath,["scripts/task-dependency-check.mjs"],{encoding:"utf8"});
 assert.equal(ok.status,0,ok.stderr);
 assert.match(ok.stdout,/dependency graph VALID/i);
 assert.match(ok.stdout,/T011 P0 READY/);
 const md=spawnSync(process.execPath,["scripts/task-dependency-check.mjs","--format=markdown"],{encoding:"utf8"});
 assert.equal(md.status,0,md.stderr);
 assert.match(md.stdout,/\| T041 \|/);
 const deny=spawnSync(process.execPath,["scripts/task-dependency-check.mjs","--require-verified=T041"],{encoding:"utf8"});
 assert.equal(deny.status,1);
 assert.match(deny.stderr,/NOT met narrow-scope verified evidence/);
});
