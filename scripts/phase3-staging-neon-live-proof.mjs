// Read-only Staging Neon control-plane attestation before running *any* DDL.
// This must run in the protected, manual GitHub Environment workflow only.
// API token/passwords, response bodies and SQL are never printed.
import targets from "../config/deployment/environments.json" with { type: "json" };
import { inspectStagingMigrationGate } from "./phase3-staging-migration-preflight.mjs";

const target=targets.staging;
const API_BASE="https://console.neon.tech/api/v2/projects/"+target.neon_project_id;

function blocked(message) {
  const error=new Error("Staging Neon control-plane proof blocked: "+message);
  error.code="VSN_STAGING_NEON_CONTROL_PLANE_NOT_VERIFIED";
  return error;
}
async function list(api,resource,token,signal) {
  const response=await api(API_BASE+"/"+resource,{
    method:"GET",
    headers:{authorization:"Bearer "+token,accept:"application/json"},
    redirect:"error",signal,
  });
  if(!response?.ok)throw blocked("Neon API "+resource+" was not accessible");
  const payload=await response.json();
  if(!payload || !Array.isArray(payload[resource]))
    throw blocked("Neon API "+resource+" returned an invalid collection");
  // Reject truncated control-plane inventories, never mistake first-page
  // absence or incomplete inspection for a confirmed missing resource.
  if(payload.pagination?.next)throw blocked("Neon API "+resource+" inventory is incomplete");
  return payload[resource];
}
export async function verifyStagingNeonControlPlane(env={},{
  fetchImpl=fetch, signal=AbortSignal.timeout(10000),
}={}) {
  const preflight=inspectStagingMigrationGate(env);
  if(!preflight.ready)throw blocked("protected GitHub ref, tier, SQL URL or snapshot policy failed");
  const apiKey=String(env.NEON_API_KEY||"");
  if(!apiKey || apiKey.length<12)throw blocked("scoped Neon API token is not configured");
  try {
    const [branches,snapshots,endpoints]=await Promise.all([
      list(fetchImpl,"branches",apiKey,signal),
      list(fetchImpl,"snapshots",apiKey,signal),
      list(fetchImpl,"endpoints",apiKey,signal),
    ]);
    const defaults=branches.filter(b=>b.default===true);
    const current=defaults[0];
    if(defaults.length!==1 || current?.id!==target.neon_default_branch_id ||
       current?.project_id!==target.neon_project_id)
      throw blocked("Staging default Neon branch changed since independently reviewed restoration");
    // User policy: ONE active database branch per Neon project. Snapshots are
    // separate read-only backups, not active branches. Reject QA/recovery/PR
    // branches even when their default remains unchanged.
    if(branches.length!==1)
      throw blocked("Staging Neon must have exactly one active default branch");
    // Neon Free cannot protect a branch; the provider rejected this project's
    // protection update HTTP 422. Accept its pinned, unprotected Staging primary
    // ONLY under the explicit reviewed free-tier policy. This is NOT a
    // substitute for protected GitHub source, scoped Staging secrets, manual
    // migration approval, a real restore snapshot and the exact Neon compute.
    // No production project or branch is ever eligible for this exception.
    if(typeof current?.protected!=="boolean")
      throw blocked("Staging primary protected flag is missing or invalid");
    const freeTierPolicy="free-plan-staging-pinned-snapshot-github-reviewed";
    if(target.neon_project_id===targets.production.neon_project_id ||
       target.neon_default_branch_id===targets.production.neon_default_branch_id)
      throw blocked("Staging and Production Neon identities are not isolated");
    if(!current.protected && target.neon_primary_policy!==freeTierPolicy)
      throw blocked("Unprotected Staging primary requires reviewed Free-plan safeguards");
    // An existing independently stored legacy snapshot may reference its
    // already-retired source branch. Never require keeping that live branch
    // merely to attest the pinned snapshot ID and historical source identity.
    const backup=snapshots.find(s=>
      s.id===target.neon_pre_migration_snapshot_id &&
      s.id===env.VSN_STAGING_BACKUP_EVIDENCE &&
      s.source_branch_id===target.neon_recovery_source_branch_id &&
      Number.isFinite(Date.parse(s.created_at))
    );
    if(!backup)throw blocked("real pinned Staging snapshot was not found");
    // An eligible historic snapshot must actually be the restoration source
    // of THIS current default, not merely an unrelated snapshot with a
    // matching name in the same Neon project. The provider independently
    // reports all three fields on the default branch metadata.
    if(current.restored_from!==backup.id ||
       current.restored_as!==target.neon_recovery_source_branch_id ||
       current.restore_status!=="finalized")
      throw blocked("current Staging default branch restore provenance is unverified");

    const compute=endpoints.filter(e=>e.id===target.neon_endpoint_id);
    if(compute.length!==1 || compute[0].branch_id!==current.id ||
       compute[0].host!==target.neon_endpoint_host ||
       compute[0].pooler_enabled!==true ||
       compute[0].pooler_mode!=="transaction" &&
       compute[0].pooler_mode!==undefined)
      throw blocked("Staging direct and transaction-pool compute identity changed");
    if(endpoints.some(e=>
      e.id===target.neon_endpoint_id && e.project_id &&
      e.project_id!==target.neon_project_id))
      throw blocked("Staging compute project identity mismatch");
    // Success only certifies metadata. Prisma migration and real SQL checks
    // are subsequent protected steps and must not be skipped.
    return {ready:true,projectId:target.neon_project_id,
      defaultBranchId:current.id,primaryProtected:current.protected,
      freeTierPolicyApplied:!current.protected,
      activeBranchCount:branches.length,snapshotId:backup.id,
      historicalSnapshotSourceBranchId:backup.source_branch_id,
      computeId:compute[0].id,poolerEnabled:true,
    };
  }catch(err) {
    if(err?.code==="VSN_STAGING_NEON_CONTROL_PLANE_NOT_VERIFIED")throw err;
    throw blocked("Neon API request/response could not be independently verified");
  }
}
if(process.argv[1]?.endsWith("/phase3-staging-neon-live-proof.mjs")) {
  try {
    await verifyStagingNeonControlPlane(process.env);
    console.log("PASS Staging Neon one active branch, pinned backup snapshot, pooled compute and Free-plan policy; no SQL executed");
  }catch(err) {
    // Intentionally never expose API response, auth headers or URL passwords.
    console.error("BLOCKED "+(err?.code==="VSN_STAGING_NEON_CONTROL_PLANE_NOT_VERIFIED"
      ?err.message:"Neon proof unavailable"));
    process.exitCode=1;
  }
}
