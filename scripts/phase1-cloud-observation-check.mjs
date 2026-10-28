// Read-only observation integrity check: never inspects credentials, accesses
// networks, or interprets script existence as a functional hosted application.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,
  "config/deployment/environments.json"),"utf8"));
const names=["staging","production"];
const validMetaKeys=new Set(["schema_version","observed_on","source","scope",
  "neon","cloudflare","not_verified"]);
export function inspectPhase1CloudObservation(observation) {
 const issues=[],blockers=[];
 if(!observation || observation.schema_version!==1)
   issues.push("Cloud observation schema must be version 1");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(observation?.observed_on||""))
   issues.push("Missing dated read-only observation");
 if(observation?.source!=="authorized_read_only_cloudflare_and_neon_connector_metadata")
   issues.push("Source must identify authorized read-only metadata");
 if(observation?.scope!=="resource_inventory_only_not_deployment_or_shopify_identity_attestation")
   issues.push("Resource existence must not be represented as Shopify acceptance");
 for(const key of Object.keys(observation||{}))
   if(!validMetaKeys.has(key))issues.push("Unexpected sensitive or unreviewed observation field");
 for(const tier of names){
  const cfg=manifest[tier];
  const n=observation?.neon?.[tier];
  const w=observation?.cloudflare?.[tier];
  if(n?.project_id!==cfg.neon_project_id ||
     n?.project_name!==cfg.cloudflare_worker)
    issues.push(tier+" Neon project identity mismatches reviewed manifest");
  if(w?.script_name!==cfg.cloudflare_worker || w?.script_exists!==true)
    issues.push(tier+" Worker identity not verified");
  if(!Number.isSafeInteger(w?.deployment_record_count) ||
     w.deployment_record_count<0)
    issues.push(tier+" Worker deployment inventory malformed");
  for(const field of ["secret_binding_names","script_setting_binding_names"]){
   if(!Array.isArray(w?.[field]) || w[field].some(x=>typeof x!=="string" ||
       !/^[A-Z][A-Z0-9_]*$/.test(x))){
    issues.push(tier+" Worker binding name inventory invalid");
   }
  }
  if(n?.postgres_version!==18 ||
    n?.region_id!=="aws-ap-southeast-1" ||
    !["production","staging","main"].includes(n?.primary_branch_name))
    issues.push(tier+" Neon project metadata malformed or unexpectedly changed");
  if(typeof n?.primary_branch_protected!=="boolean")
    issues.push(tier+" Neon primary protection metadata missing");
  if(n?.primary_branch_protected===false)
    blockers.push(tier+" Neon primary branch protection review pending");
  const secretNames=new Set((w?.secret_binding_names||[]));
  // Cloudflare script bindings are a Phase 4 hosted-app readiness precondition,
  // not a reason to mark an existing Phase 1 resource inventory false.
  for(const required of ["SHOPIFY_API_SECRET","DATABASE_URL"])
    if(!secretNames.has(required))
      blockers.push(tier+" hosted Worker missing "+required+" binding");
 }
 if(observation?.neon?.staging?.project_id===observation?.neon?.production?.project_id ||
    observation?.cloudflare?.staging?.script_name===
      observation?.cloudflare?.production?.script_name)
   issues.push("Staging and Production cannot share infrastructure identities");
 if(!Array.isArray(observation?.not_verified) ||
   observation.not_verified.length<3)
   issues.push("Snapshot must disclose remaining external verification limits");
 return {issues,blockers,inventory_valid:issues.length===0,
   hosted_ready:issues.length===0 && blockers.length===0};
}

export function readPhase1Observation(file=path.join(root,
  "config/project/phase1-cloud-observation.json")){
 return JSON.parse(fs.readFileSync(file,"utf8"));
}
function main(){
 const filename=process.argv.find(x=>x.startsWith("--input="))?.slice(8);
 const observation=readPhase1Observation(filename?path.resolve(filename):undefined);
 const {issues,blockers,inventory_valid,hosted_ready}=
   inspectPhase1CloudObservation(observation);
 for(const issue of issues)console.error("INVENTORY INVALID: "+issue);
 if(issues.length){process.exitCode=1;return}
 console.log("Phase 1 read-only cloud resource observation: VERIFIED HISTORICAL SNAPSHOT");
 console.log("Neon Staging/Production project and Cloudflare script identities: DISTINCT");
 console.log("No Shopify app ownership, GitHub scoped secrets, or runtime readiness is certified.");
 for(const blocker of blockers)console.log("NOT READY: "+blocker);
 if(process.argv.includes("--require-hosted-ready") && !hosted_ready){
  console.error("Hosted prerequisites BLOCKED: "+blockers.length+" unverified/missing checks.");
  process.exitCode=1;
 }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main();
