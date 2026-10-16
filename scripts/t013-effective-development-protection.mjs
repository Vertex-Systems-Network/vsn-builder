// T013: inspect GitHub's EFFECTIVE protection rules for the development ref.
// GET-only: does not create rulesets, modify GitHub Settings, or access secrets.
// Never accept "Protect main" or workflow YAML as proof of development protection.
import {pathToFileURL} from "node:url";

export const TARGET_REPO="Vertex-Systems-Network/vsn-builder";
export const TARGET_BRANCH="development";
const ERROR_PREFIX="T013_GITHUB_PROTECTION_";
const REQUIRED_RULES=Object.freeze(["pull_request","required_status_checks","non_fast_forward","deletion"]);

function validatedChecks(parameters){
  if(!Array.isArray(parameters?.required_status_checks))return [];
  return parameters.required_status_checks
    .map(item=>typeof item?.context==="string"?item.context.trim():"")
    .filter(Boolean);
}

export function inspectEffectiveDevelopmentProtection(branch,rules){
  const reasons=[];
  if(!branch || typeof branch!=="object" || branch.name!==TARGET_BRANCH ||
     branch.protected!==true)reasons.push("DEVELOPMENT_BRANCH_NOT_PROTECTED");
  if(!Array.isArray(rules))reasons.push("EFFECTIVE_RULES_NOT_AVAILABLE");
  const effective=Array.isArray(rules)?rules:[];
  const rule=(type)=>effective.filter(item=>item?.type===type);
  for(const type of REQUIRED_RULES)if(rule(type).length===0)
    reasons.push("MISSING_"+type.toUpperCase());
  // User-mandated AI-led engineering: never require a human to approve a PR.
  // PR creation, checks, deletion and force-push restrictions remain mandatory.
  // GitHub defaults omitted required_approving_review_count to zero.
  const pull=rule("pull_request");
  if(pull.some(entry=>{
    const n=entry.parameters?.required_approving_review_count;
    return n!==undefined && (!Number.isInteger(n) || n!==0);
  }))reasons.push("HUMAN_PR_APPROVAL_NOT_ALLOWED");
  if(pull.some(entry=>entry.parameters?.require_code_owner_review===true))
    reasons.push("HUMAN_CODE_OWNER_REVIEW_NOT_ALLOWED");
  const checks=rule("required_status_checks");
  const allChecks=checks.flatMap(entry=>validatedChecks(entry.parameters));
  if(checks.length && allChecks.length===0)
    reasons.push("NO_REQUIRED_CI_CHECKS");
  // The real GitHub ruleset blocked a merge until this exact test existed.
  // It cannot be replaced by a cosmetic success status or an AI self-approval.
  if(checks.length && !allChecks.includes("repository-integrity"))
    reasons.push("REPOSITORY_INTEGRITY_NOT_REQUIRED");
  // We do NOT claim effective reviewer identities, bypass restrictions, or
  // GitHub Environment secrets/reviewer settings from these branch GETs.
  return {ready:reasons.length===0,reasons,
    branch:TARGET_BRANCH,requiredRuleTypes:REQUIRED_RULES.slice(),
    statusCheckCount:allChecks.length,
    reviewPolicy:"AI-led source review + enforced PR CI; no human approval",
    explicitlyNotCertified:["independent_ai_bot_review","environment_secrets",
      "environment_deployment_permissions","effective_ruleset_bypass",
      "shopify_partner_ownership","staging_application"],
  };
}

const endpoint=(suffix)=>"https://api.github.com/repos/"+TARGET_REPO+"/"+suffix;
async function githubGet(url,token,fetcher){
  if(!url.startsWith(endpoint("")))throw new Error(ERROR_PREFIX+"URL_INVALID");
  const result=await fetcher(url,{
    method:"GET",
    redirect:"error",
    headers:{
      Accept:"application/vnd.github+json",
      Authorization:"Bearer "+token,
      "X-GitHub-Api-Version":"2022-11-28",
    },
    signal:AbortSignal.timeout(10000),
  });
  if(!result?.ok)throw new Error(ERROR_PREFIX+"API_UNAVAILABLE");
  // Neither request nor response payloads are logged. The branch endpoint
  // contains commit metadata, not credentials; parse only minimum fields.
  return result.json();
}

export async function verifyEffectiveDevelopmentProtection({
  token,fetcher=fetch,repo=TARGET_REPO
}={}){
  if(repo!==TARGET_REPO)throw new Error(ERROR_PREFIX+"REPOSITORY_MISMATCH");
  if(typeof token!=="string"||!token.trim())throw new Error(ERROR_PREFIX+"READ_TOKEN_MISSING");
  if(typeof fetcher!=="function")throw new Error(ERROR_PREFIX+"FETCH_UNAVAILABLE");
  const [branch,rules]=await Promise.all([
    githubGet(endpoint("branches/development"),token,fetcher),
    githubGet(endpoint("rules/branches/development"),token,fetcher),
  ]);
  return inspectEffectiveDevelopmentProtection(branch,rules);
}

async function main(){
  const isDevelopmentRef=process.env.GITHUB_REF==="refs/heads/development";
  const isProtectedRef=process.env.GITHUB_REF_PROTECTED==="true";
  if(process.env.GITHUB_REPOSITORY!==TARGET_REPO || !isDevelopmentRef || !isProtectedRef){
    console.error("::error::"+ERROR_PREFIX+"WRONG_OR_UNPROTECTED_REF");
    process.exitCode=1;
    return;
  }
  try{
    const result=await verifyEffectiveDevelopmentProtection({token:process.env.GITHUB_TOKEN});
    if(!result.ready){
      for(const reason of result.reasons)console.error("::error::"+ERROR_PREFIX+reason);
      process.exitCode=1;
      return;
    }
    console.log("T013 protected development PR/required repository-integrity CI and no-human-approval policy: PASS.");
    console.log("AI review happens in the connected engineering workflow; CI is not proof of a separate AI reviewer bot.");
    console.log("NOT CERTIFIED: GitHub Environment secrets/deployment policy, bypass actors, Shopify/Neon/Cloudflare runtime.");
  }catch(error){
    console.error("::error::"+(String(error?.message||"").startsWith(ERROR_PREFIX)
      ?error.message:ERROR_PREFIX+"UNKNOWN_FAILURE"));
    process.exitCode=1;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await main();
