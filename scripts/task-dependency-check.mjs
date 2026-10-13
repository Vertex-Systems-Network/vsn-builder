import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const DEFAULT_FILE=path.join(ROOT,"config/project/task-dependency-plan.json");
export const STATUS=Object.freeze(["verified","in_review","todo"]);
export const PRIORITIES=Object.freeze(["P0","P1","P2"]);
const URL=/^https:\/\/github\.com\/Vertex-Systems-Network\/vsn-builder\/(?:issues|pull|actions\/runs)\/[0-9]+$/;

export function readTaskPlan(file=DEFAULT_FILE) {
 return JSON.parse(fs.readFileSync(file,"utf8"));
}
export function inspectTaskPlan(plan) {
 const errors=[];
 if(plan?.schema_version!==1 ||
   plan?.policy!=="dependency_driven_evidence_first_no_phase_gating")
   errors.push("Unrecognized or phase-ordered task policy");
 if(plan?.public_shopify_apps!==1)
   errors.push("Exactly ONE public Shopify Builder app is permitted");
 const expected=[
  ["Starter","starter",30,null,10],
  ["Sliver","sliver",100,null,10],
  ["Gold","gold",150,null,10],
  ["Platinum","platinum",350,3000,10],
 ];
 if(JSON.stringify((plan?.commercial_plans||[]).map(p=>[
    p.name,p.id,p.monthly_usd,p.annual_usd,p.trial_days
   ]))!==JSON.stringify(expected))
   errors.push("Four paid canonical Shopify plans/prices/10-day trials mismatch");
 if(!Array.isArray(plan?.tasks)||plan.tasks.length<20)
   return {errors:[...errors,"Task inventory must be a complete atomic backlog"],rows:[],ready:[],summary:{}};
 const tasks=plan.tasks;
 const byId=new Map(),statusCounts={verified:0,in_review:0,todo:0};
 for(const t of tasks){
  if(!t || !/^T[0-9]{3}$/.test(t.id||"") || byId.has(t.id))
   errors.push("Duplicate or invalid task ID: "+String(t?.id));
  else byId.set(t.id,t);
  if(!t.title?.trim()||!t.workstream?.trim() || !t.acceptance?.trim())
   errors.push("Task has no title, workstream or acceptance condition: "+t.id);
  if(!PRIORITIES.includes(t.priority)||!STATUS.includes(t.status))
   errors.push("Invalid priority/status for "+t.id);
  else statusCounts[t.status]++;
  if(!Array.isArray(t.depends_on)||new Set(t.depends_on).size!==t.depends_on.length)
   errors.push("Malformed/duplicate dependencies for "+t.id);
  if(!URL.test(t.github_issue||""))
   errors.push("Missing explicit GitHub issue for "+t.id);
  if(!Array.isArray(t.evidence)||t.evidence.some(x=>!URL.test(x)))
   errors.push("Evidence must point to traceable same-repository issue/PR/workflow for "+t.id);
  if(t.status==="verified" && (!Array.isArray(t.evidence)||t.evidence.length===0))
   errors.push("Verified task missing narrow-scope evidence for "+t.id);
  if(t.status==="in_review" && (!Array.isArray(t.evidence)||t.evidence.length===0))
   errors.push("In-review task missing PR/issue pointer for "+t.id);
 }
 for(const task of tasks) {
  for(const dep of task.depends_on||[]){
   if(dep===task.id)errors.push("Self dependency "+task.id);
   if(!byId.has(dep))errors.push("Missing dependency "+dep+" on "+task.id);
   if(task.status==="verified" && byId.has(dep)&&byId.get(dep).status!=="verified")
    errors.push("Verified task has unverified prerequisite: "+task.id+" -> "+dep);
  }
 }
 const color=new Map();
 function visit(id,stack=[]) {
  if(color.get(id)===2)return;
  if(color.get(id)===1){errors.push("Cycle: "+[...stack,id].join(" -> "));return}
  color.set(id,1);
  for(const dep of byId.get(id)?.depends_on||[]){
   if(byId.has(dep))visit(dep,[...stack,id]);
  }
  color.set(id,2);
 }
 for(const id of byId.keys())visit(id);
 // Audited terminal safety gates are ONLY logical prerequisites; no Phase 1→8 order.
 for(const [id,needed] of [
  ["T038",["T011","T012","T036","T037"]],
  ["T039",["T029","T038"]],
  ["T041",["T011","T025","T029","T035","T039","T040"]],
 ]) {
  const task=byId.get(id);
  if(!task||needed.some(x=>!task.depends_on.includes(x)))
   errors.push("Missing required Live/Shopify safety dependency in "+id);
 }
 const rows=tasks.map(t=>{
  const waiting=(t.depends_on||[]).filter(x=>byId.get(x)?.status!=="verified");
  const execution=t.status==="verified"?"VERIFIED":
    t.status==="in_review"?"IN_REVIEW":
    waiting.length?"WAITING":"READY";
  return {id:t.id,title:t.title,priority:t.priority,status:t.status,
    workstream:t.workstream,execution,waiting_on:waiting,
    depends_on:t.depends_on,github_issue:t.github_issue};
 }).sort((a,b)=>PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority)||
    a.id.localeCompare(b.id));
 const ready=rows.filter(x=>x.execution==="READY");
 return {errors,rows,ready,summary:{total:tasks.length,...statusCounts,
  ready:ready.length,waiting:rows.filter(x=>x.execution==="WAITING").length,
  in_review:statusCounts.in_review}};
}
function run() {
 const inspected=inspectTaskPlan(readTaskPlan());
 if(inspected.errors.length){
  for(const e of inspected.errors)console.error("DEPENDENCY ERROR: "+e);
  process.exitCode=1;
  return;
 }
 const required=process.argv.find(x=>x.startsWith("--require-verified="));
 if(required) {
  const id=required.slice("--require-verified=".length);
  if(!inspected.rows.some(x=>x.id===id&&x.status==="verified")){
   console.error("BLOCKED: "+id+" has NOT met narrow-scope verified evidence; no release authorization");
   process.exitCode=1;
  }
 }
 if(process.argv.includes("--format=json")){
  console.log(JSON.stringify(inspected,null,2));
 }else if(process.argv.includes("--format=markdown")){
  console.log("| ID | Priority | Task | Depends on | Execution |");
  console.log("| --- | --- | --- | --- | --- |");
  for(const x of inspected.rows)console.log("| "+x.id+" | "+x.priority+" | "+
   x.title.replace(/\|/g,"/")+" | "+(x.depends_on.join(", ")||"None")+" | "+x.execution+" |");
 }else {
  const s=inspected.summary;
  console.log("Dependency graph VALID; verified "+s.verified+"/"+s.total+
    " narrow tasks, "+s.ready+" READY, "+s.in_review+" IN_REVIEW, "+
    s.waiting+" WAITING. No phases.");
  for(const task of inspected.ready)console.log(task.id+" "+task.priority+" READY: "+task.title);
  console.log("This checker does not verify live GitHub, Shopify, Neon or Cloudflare services.");
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();
