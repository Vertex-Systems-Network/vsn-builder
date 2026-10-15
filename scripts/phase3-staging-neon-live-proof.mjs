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
  if(!preflight.ready)throw blocked("protected branch, tier, SQL URL or snapshot policy failed");
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
    // GitHub branch rules do not protect the PostgreSQL primary itself.
    // Neon may reject protected=true on quota-limited plans (confirmed
    // HTTP 422 for this Staging project). Do not allow its migration merely
    // because Github or environment approval is later enabled.
    if(current?.protected!==true)
      throw blocked("Staging default Neon primary branch is not protected");
    const original=branches.find(b=>
      b.id===target.neon_recovery_source_branch_id &&
      b.project_id===target.neon_project_id && b.default!==true
    );
    if(!original)throw blocked("original recoverable Staging branch is missing");
    const backup=snapshots.find(s=>
      s.id===target.neon_pre_migration_snapshot_id &&
      s.id===env.VSN_STAGING_BACKUP_EVIDENCE &&
      s.source_branch_id===target.neon_recovery_source_branch_id &&
      Number.isFinite(Date.parse(s.created_at))
    );
    if(!backup)throw blocked("real original-root Staging backup snapshot was not found");
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
      defaultBranchId:current.id,primaryProtected:true,snapshotId:backup.id,
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
    console.log("PASS Staging Neon backup snapshot, restored branch and pooled compute real API identity; no SQL executed");
  }catch(err) {
    // Intentionally never expose API response, auth headers or URL passwords.
    console.error("BLOCKED "+(err?.code==="VSN_STAGING_NEON_CONTROL_PLANE_NOT_VERIFIED"
      ?err.message:"Neon proof unavailable"));
    process.exitCode=1;
  }
}
