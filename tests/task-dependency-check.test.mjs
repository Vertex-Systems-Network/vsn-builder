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
 assert.equal(result.summary.closed,18);
 assert.equal(result.summary.active,23);
 assert.equal(result.summary.verified,0);
 assert.equal(result.summary.in_review,5);
 assert.equal(result.summary.ready,0);
 assert.equal(result.summary.waiting,18);
 assert.deepEqual(plan.closed_task_ids,[...Array.from({length:13},(_,i)=>"T"+String(i+1).padStart(3,"0")),"T014","T016","T026","T027","T032"]);
 assert(result.rows.every(t=>t.status!=="closed"),"closed work must never appear in active queue");
 assert.equal(result.closed_tasks.length,0,"closed evidence must not appear in default JSON output");
 const withArchive=inspectTaskPlan(plan,{includeClosed:true});
 assert.equal(withArchive.closed_tasks.length,18);
 assert(withArchive.closed_tasks.every(t=>["2026-10-15","2026-10-16","2026-10-17"].includes(t.closed_on)&&t.evidence.length>0));
 assert.equal(plan.public_shopify_apps,1);
 assert.deepEqual(plan.commercial_plans.map(p=>p.id),["starter","sliver","gold","platinum"]);
 assert(plan.commercial_plans.every(p=>p.trial_days===10));
 assert.equal(plan.commercial_plans[3].annual_usd,3000);
});
test("independent discovered Shopify app task moves to IN_REVIEW without unlocking release dependents",()=>{
 const {rows}=inspectTaskPlan(fresh());
 const ready=new Set(rows.filter(r=>r.execution==="READY").map(r=>r.id));
 assert.deepEqual([...ready],[],"T016 Neon pooled/direct real Staging connections are final closed; remaining dependencies stay gated");
 assert.equal(rows.find(r=>r.id==="T015").execution,"IN_REVIEW");
 for(const id of ["T018","T021","T023","T025","T029","T031","T037","T038","T041"])
  assert.equal(rows.find(r=>r.id===id).execution,"WAITING",id);
 assert.equal(rows.find(r=>r.id==="T017").execution,"IN_REVIEW");
 assert.equal(rows.some(r=>r.id==="T012"),false,"Merged PR integration is FINAL CLOSED");
 assert.equal(rows.find(r=>r.id==="T020").execution,"IN_REVIEW");
 assert.equal(rows.some(r=>r.id==="T027"),false,"Source pricing contract is FINAL CLOSED");
 assert.equal(rows.some(r=>r.id==="T011"),false,"Dependency audit is FINAL CLOSED");
 assert.equal(rows.some(r=>r.id==="T026"),false,"Server mutation entitlement is FINAL CLOSED");
 assert.equal(rows.find(r=>r.id==="T024").execution,"IN_REVIEW");
 assert.equal(rows.some(r=>r.id==="T013"),false,"Accepted AI-led protection no longer appears active");
 assert.equal(rows.some(r=>r.id==="T014"),false,"Verified T014 GitHub staging scope is FINAL CLOSED");
 assert.equal(rows.some(r=>r.id==="T016"),false,"T016 protected Neon Staging connectivity is FINAL CLOSED");
});
test("T026 stays permanently closed yet T029 cannot run without Shopify billing E2E",()=>{
 const plan=fresh();
 const t=find(plan,"T026");
 assert.equal(t.status,"closed");
 assert(t.evidence.some(x=>x.includes("38746336058")));
 const proof=inspectTaskPlan(plan);
 assert.deepEqual(proof.errors,[]);
 assert.equal(proof.rows.some(x=>x.id==="T026"),false);
 assert.equal(proof.rows.find(x=>x.id==="T029").execution,"WAITING");
 const reopened=fresh();find(reopened,"T026").status="todo";
 assert(inspectTaskPlan(reopened).errors.some(x=>x.includes("Immutable closed task was reopened")));
});
test("T032 source/fixture QA is final while hosted T033 remains independently blocked",()=>{
 const plan=fresh();
 assert.equal(find(plan,"T032").status,"closed");
 assert(find(plan,"T032").closure_note.includes("NO real merchant"));
 assert.equal(plan.closed_task_ids.includes("T032"),true);
 assert.equal(find(plan,"T033").status,"todo");
 assert(find(plan,"T033").depends_on.includes("T032"));
 assert.equal(inspectTaskPlan(plan).rows.some(x=>x.id==="T032"),false);
 const changed=fresh();find(changed,"T032").status="in_review";
 assert(inspectTaskPlan(changed).errors.some(e=>e.includes("Immutable closed task")));
});
test("T013 AI-led protection and T014 GitHub Staging Environment are permanently final",()=>{
 const p=fresh();
 const task=find(p,"T013");
 assert.equal(task.status,"closed");
 assert(task.evidence.some(x=>x.includes("/38921068981")));
 assert.equal(task.closed_on,"2026-10-16");
 assert.equal(p.closed_task_ids.includes("T013"),true);
 assert.equal(inspectTaskPlan(p).rows.some(x=>x.id==="T013"),false);
 assert.equal(find(p,"T014").status,"closed");
 assert(p.closed_task_ids.includes("T014"));
 assert.equal(inspectTaskPlan(p).rows.some(x=>x.id==="T014"),false);
 const reopening=fresh();find(reopening,"T013").status="in_review";
 assert(inspectTaskPlan(reopening).errors.some(x=>x.includes("Immutable closed task")));
});
test("T014 and T016 are final closed while T017/T019/T018 remain separately blocked",()=>{
 const plan=fresh();
 assert.equal(find(plan,"T014").status,"closed");
 assert.equal(plan.closed_task_ids.length,18);
 const proof=inspectTaskPlan(plan);
 assert.deepEqual(proof.errors,[]);
 assert.equal(find(plan,"T016").status,"closed");
 assert.equal(proof.rows.some(x=>x.id==="T016"),false);
 assert.equal(proof.rows.find(x=>x.id==="T017").execution,"IN_REVIEW");
 assert.equal(proof.rows.find(x=>x.id==="T018").execution,"WAITING");
 assert.equal(proof.rows.find(x=>x.id==="T019").execution,"WAITING");
 assert.equal(proof.rows.some(x=>x.id==="T014"),false);
});
test("blocking one task cannot artificially block independent READY tasks",()=>{
 const plan=fresh();
 find(plan,"T019").depends_on.push("T011");
 const {errors,rows}=inspectTaskPlan(plan);
 assert.deepEqual(errors,[]);
 assert.equal(rows.find(r=>r.id==="T024").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T020").execution,"IN_REVIEW");
 assert.equal(rows.find(r=>r.id==="T040").execution,"IN_REVIEW");
 assert.equal(rows.some(r=>r.id==="T032"),false,"T032 synthetic fixture scope must be absent from active list");
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
 assert.match(ok.stdout,/18 FINAL CLOSED/);
 assert.match(ok.stdout,/23 ACTIVE/);
 assert.doesNotMatch(ok.stdout,/T001 P0/);
 assert.doesNotMatch(ok.stdout,/T011 P0 READY/);
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
 assert.equal(result.rows.find(x=>x.id==="T024").execution,"IN_REVIEW");
 assert.equal(result.rows.find(x=>x.id==="T022").waiting_on.includes("T002"),false);
 const withHistory=inspectTaskPlan(plan,{includeClosed:true});
 assert.equal(withHistory.rows.filter(t=>t.execution==="CLOSED").length,18);
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
