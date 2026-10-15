import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const observationFile=path.join(root,"config/project/phase1-github-protection-observation.json");
const allowedKeys=new Set([
 "schema_version","observed_on","source","scope","repository",
 "branches","rulesets","preflight_implications","not_verified",
]);

export function inspectPhase1GitHubProtection(data) {
 const issues=[],blockers=[];
 if(data?.schema_version!==1)issues.push("Unsupported observation format");
 if(data?.repository!=="Vertex-Systems-Network/vsn-builder")
   issues.push("Wrong repository identity");
 if(data?.source!=="authorized_read_only_github_repository_branch_and_ruleset_endpoints" ||
    data?.scope!=="historical_repository_branch_ruleset_metadata_not_environment_policy_or_secret_attestation")
   issues.push("Source/scope must clearly identify historical read-only metadata");
 if(!/^\d{4}-\d\d-\d\d$/.test(String(data?.observed_on||"")))
   issues.push("Missing observation date");
 for(const key of Object.keys(data||{}))
   if(!allowedKeys.has(key))issues.push("Unexpected key in non-sensitive observation");
 const branches=data?.branches||{};
 for(const name of ["main","development"]){
   const value=branches[name];
   if(typeof value?.protected!=="boolean" ||
      !/^[0-9a-f]{40}$/.test(String(value?.head_sha||"")))
     issues.push(name+" branch protection/commit metadata invalid");
 }
 if(!Array.isArray(data?.rulesets)||!data.rulesets.length)
   issues.push("Repository active ruleset inventory missing");
 for(const set of data?.rulesets||[]){
   if(!Number.isInteger(set?.id)||set.id<1 || typeof set.name!=="string" ||
      !["active","disabled","evaluate"].includes(set.enforcement) ||
      !Array.isArray(set.branch_refs) || !Array.isArray(set.rules) ||
      !Array.isArray(set.required_status_checks) ||
      !Number.isInteger(set.pull_request_review_count) ||
      typeof set.require_review_thread_resolution!=="boolean"){
     issues.push("Invalid ruleset metadata");continue;
   }
 }
 const covers=(set,name)=>set.enforcement==="active" &&
   (set.branch_refs.includes("refs/heads/"+name) ||
    (name==="main" && set.branch_refs.includes("~DEFAULT_BRANCH")) ||
    set.branch_refs.includes("~ALL"));
 const guardFor=(name)=>(data?.rulesets||[]).filter(s=>
   Array.isArray(s.branch_refs) && covers(s,name) &&
   Array.isArray(s.rules) && s.rules.includes("pull_request") &&
   s.rules.includes("required_status_checks"));
 for(const name of ["main","development"]){
   if(branches[name]?.protected!==true)
     blockers.push(name+" branch is NOT protected");
   if(!guardFor(name).length)
     blockers.push(name+" has no verified active PR+required-status ruleset");
 }
 const mainChecks=guardFor("main").flatMap(s=>s.required_status_checks||[]);
 if(branches.main?.protected===true &&
    (!mainChecks.includes("verify") ||
     !mainChecks.includes("Analyze JavaScript and TypeScript")))
   issues.push("Protected main ruleset required check list mismatches live observation");
 if(!Array.isArray(data?.not_verified)||data.not_verified.length<3)
   issues.push("External GitHub Environment and Shopify uncertainties must be disclosed");
 if(data?.preflight_implications?.staging_protected_source!=="development" ||
    data?.preflight_implications?.production_protected_source!=="main")
   issues.push("Source branch mapping drift");
 if(data?.preflight_implications?.staging_can_dispatch_now===true &&
    branches.development?.protected!==true)
   issues.push("Unprotected development cannot be certified dispatch-ready");
 if(data?.preflight_implications?.production_real_environment_secrets_verified!==false)
   issues.push("Historical observation must not certify protected secret values");
 return {issues,blockers,inventory_valid:issues.length===0,
   staging_protected:issues.length===0&&!blockers.some(x=>x.startsWith("development")),
   phase1_closed:false};
}
export function readPhase1GitHubProtection(file=observationFile){
 return JSON.parse(fs.readFileSync(file,"utf8"));
}
function main(){
 const {issues,blockers,inventory_valid,staging_protected}=inspectPhase1GitHubProtection(readPhase1GitHubProtection());
 if(!inventory_valid){
   for(const issue of issues)console.error("OBSERVATION INVALID: "+issue);
   process.exitCode=1;return;
 }
 console.log("GitHub branch/ruleset historical read-only inventory: VALID");
 for(const blocker of blockers)console.log("NOT READY: "+blocker);
 console.log("GitHub Environment reviewer policies, secret presence and actual dispatch NOT verified.");
 if(process.argv.includes("--require-staging-protected")&&!staging_protected){
   console.error("BLOCKED: Staging preflight must not run against unprotected development.");
   process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
