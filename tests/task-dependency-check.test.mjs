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
 assert.equal(result.summary.closed,10);
 assert.equal(result.summary.active,31);
 assert.equal(result.summary.verified,0);
 assert.equal(result.summary.in_review,5);
 assert.equal(result.summary.ready,7);
 assert.equal(result.summary.waiting,19);
 assert.deepEqual(plan.closed_task_ids,Array.from({length:10},(_,i)=>"T"+String(i+1).padStart(3,"0")));
 assert(result.rows.every(t=>t.status!=="closed"),"closed work must never appear in active queue");
 assert.equal(result.closed_tasks.length,0,"closed evidence must not appear in default JSON output");
 const withArchive=inspectTaskPlan(plan,{includeClosed:true});
 assert.equal(withArchive.closed_tasks.length,10);
 assert(withArchive.closed_tasks.every(t=>t.closed_on==="2026-10-15"&&t.evidence.length>0));
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
 assert.equal(rows.find(r=>r.id==="T024").execution,"READY");
 assert.equal(rows.find(r=>r.id==="T020").execution,"IN_REVIEW");
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
 assert(inspectTaskPlan(a).errors.some(e=>e.includes("Verified/closed task missing")));
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
 assert.match(ok.stdout,/10 FINAL CLOSED/);
 assert.match(ok.stdout,/31 ACTIVE/);
 assert.doesNotMatch(ok.stdout,/T001 P0/);
 assert.match(ok.stdout,/T011 P0 READY/);
 const md=spawnSync(process.execPath,["scripts/task-dependency-check.mjs","--format=markdown"],{encoding:"utf8"});
 assert.equal(md.status,0,md.stderr);
 assert.match(md.stdout,/\| T041 \|/);
 assert.doesNotMatch(md.stdout,/\| T001 \|/);
 const archive=spawnSync(process.execPath,["scripts/task-dependency-check.mjs","--format=markdown","--include-closed"],{encoding:"utf8"});
 assert.equal(archive.status,0,archive.stderr);
 assert.match(archive.stdout,/\| T001 \|/);
 assert.match(archive.stdout,/CLOSED/);
 const deny=spawnSync(process.execPath,["scripts/task-dependency-check.mjs","--require-verified=T041"],{encoding:"utf8"});
 assert.equal(deny.status,1);
 assert.match(deny.stderr,/NOT met narrow-scope verified evidence/);
});

test("final CLOSED is terminal, removed from active view, but satisfies downstream prerequisites",()=>{
 const plan=fresh();
 const result=inspectTaskPlan(plan);
 for(const id of plan.closed_task_ids){
   const task=find(plan,id);
   assert.equal(task.status,"closed",id);
   assert.equal(result.rows.some(x=>x.id===id),false,id);
   assert(task.closure_note?.trim(),id);
 }
 assert.equal(result.rows.find(x=>x.id==="T024").execution,"READY");
 assert.equal(result.rows.find(x=>x.id==="T022").waiting_on.includes("T002"),false);
 const withHistory=inspectTaskPlan(plan,{includeClosed:true});
 assert.equal(withHistory.rows.filter(t=>t.execution==="CLOSED").length,10);
 assert.equal(withHistory.ready.length,result.ready.length);
});
test("CLOSED cannot silently reopen, disappear, lose closure proof or bypass dependency safety",()=>{
 for(const mutation of [
  p=>find(p,"T001").status="todo",
  p=>find(p,"T002").closure_note="",
  p=>find(p,"T003").evidence=[],
  p=>p.closed_task_ids.splice(0,1),
  p=>p.tasks.splice(p.tasks.findIndex(t=>t.id==="T004"),1),
  p=>find(p,"T005").closed_on="",
 ]){
   const plan=fresh();mutation(plan);
   assert(inspectTaskPlan(plan).errors.length>0);
 }
 const premature=fresh();
 find(premature,"T041").status="closed";
 premature.closed_task_ids.push("T041");
 find(premature,"T041").closed_on="2026-10-15";
 find(premature,"T041").closure_note="Pretend release";
 find(premature,"T041").evidence=["https://github.com/Vertex-Systems-Network/vsn-builder/issues/168"];
 assert(inspectTaskPlan(premature).errors.some(e=>e.includes("unverified prerequisite")));
});
