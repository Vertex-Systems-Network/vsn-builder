import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifestPath="config/project/phase-closure-sequence.json";
export const PHASE_NAMES=[
 "Environment Setup",
 "Local Application & Browser",
 "PostgreSQL / Neon Database",
 "Cloudflare Worker Runtime",
 "Shopify Authentication & Sessions",
 "Webhooks & Mutation Security",
 "Application Features & E2E",
 "Security, CI & Deployment",
];
const validStatus=new Set(["queued","in_progress","closed"]);
const validItemStatus=new Set(["verified","unverified","blocked"]);
const evidenceType=new Set(["ci","external"]);

export function inspectPhaseSequence(manifest){
 const errors=[];
 if(!manifest || manifest.schema_version!==1 ||
    manifest.policy!=="strict_serial_closure_evidence_first_no_fake_status")
   errors.push("Unknown or modified phase policy");
 if(!Array.isArray(manifest?.phases)||manifest.phases.length!==PHASE_NAMES.length){
   errors.push("All eight phases must exist");
   return {errors,rows:[]};
 }
 const rows=[];
 let firstNotClosed=null,activeCount=0;
 for(let i=0;i<PHASE_NAMES.length;i++){
   const phase=manifest.phases[i]||{};
   const count=phase.items?.length||0;
   if(phase.id!==i+1 || phase.name!==PHASE_NAMES[i])
     errors.push("Phase sequence/name mismatch at position "+(i+1));
   if(!validStatus.has(phase.status))
     errors.push("Invalid phase status "+(i+1));
   if(!Array.isArray(phase.items)||count===0)
     errors.push("Phase "+(i+1)+" must contain subtasks");
   if(phase.status==="in_progress")activeCount++;
   if(firstNotClosed===null && phase.status!=="closed")firstNotClosed=i;
   const verified=(phase.items||[]).filter(x=>x.status==="verified").length;
   const blocked=(phase.items||[]).filter(x=>x.status==="blocked").length;
   for(const task of phase.items||[]){
     if(!task || typeof task.name!=="string" || !task.name.trim() ||
        !evidenceType.has(task.evidence_type) || !validItemStatus.has(task.status))
       errors.push("Invalid subtask in phase "+(i+1));
     if(task.status==="verified" &&
        !(typeof task.evidence==="string" &&
          /^https:\/\/github\.com\/Vertex-Systems-Network\/vsn-builder\/(?:pull|actions\/runs)\/[0-9]+$/.test(task.evidence)))
       errors.push("Verified subtask requires a traceable GitHub PR or run in phase "+(i+1));
   }
   if(phase.status==="closed"){
     if(verified!==count)errors.push("Cannot close phase "+(i+1)+" with incomplete subtasks");
     if((manifest.phases||[]).slice(0,i).some(x=>x.status!=="closed"))
       errors.push("Cannot close phase "+(i+1)+" before all predecessors");
   }
   if(phase.status==="in_progress" &&
     (manifest.phases||[]).slice(0,i).some(x=>x.status!=="closed"))
     errors.push("Cannot start phase "+(i+1)+" before closing prior phases");
   if(phase.status==="queued" &&
     (manifest.phases||[]).slice(i+1).some(x=>x.status==="closed"))
     errors.push("Cannot queue phase "+(i+1)+" while later phase is closed");
   rows.push({id:phase.id,name:phase.name,status:phase.status,verified,count,blocked});
 }
 if(activeCount!==1 && rows.some(x=>x.status!=="closed"))
   errors.push("Exactly one phase must be in progress while work remains");
 if(activeCount!==0 && rows.every(x=>x.status==="closed"))
   errors.push("No phase can be in progress after complete closure");
 return {errors,rows};
}

export function readManifest(file=path.join(root,manifestPath)){
 return JSON.parse(fs.readFileSync(file,"utf8"));
}

function main(){
 const {errors,rows}=inspectPhaseSequence(readManifest());
 if(errors.length){
   for(const error of errors)console.error("PHASE ERROR: "+error);
   process.exitCode=1;
   return;
 }
 if(process.argv.includes("--format=markdown")){
   console.log("| # | Phase | Verified subtasks | Status |");
   console.log("|---|---|---|---|");
   for(const row of rows)
     console.log(`| ${row.id} | ${row.name} | ${row.verified}/${row.count} | ${row.status==="closed"?"CLOSED":row.status==="in_progress"?"IN PROGRESS":"QUEUED"}${row.blocked?" · "+row.blocked+" blocker(s)":""} |`);
 }else{
   console.log("Phase sequence policy PASS; this does NOT verify external merchant/hosted evidence.");
   for(const row of rows)
     console.log(`${row.id}. ${row.name}: ${row.status} (${row.verified}/${row.count} evidence-tracked)`);
 }
 const required=process.argv.find(x=>x.startsWith("--require-closed="));
 if(required){
   const target=Number(required.slice("--require-closed=".length));
   if(!Number.isInteger(target) || target<1||target>PHASE_NAMES.length ||
      rows[target-1].status!=="closed"){
     console.error("Phase "+target+" is NOT independently certified closed");
     process.exitCode=1;
   }
 }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main();
