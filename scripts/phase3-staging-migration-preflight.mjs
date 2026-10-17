// Run on a protected GitHub Environment, never in ordinary PR CI.
// Pure policy check; does not connect, migrate, back up, or print secrets.
import { inspectHostedNeonUrlPair } from "../app/services/neon-target-policy.js";
import targets from "../config/deployment/environments.json" with { type: "json" };
import {
  expectedStagingMigrationChecksums,expectedStagingMigrationTables,
} from "./t018-staging-migration-ledger.mjs";

// Prisma consumes DSN query parameters, unlike the separately constructed
// read-only libpq probe. Never let an otherwise correctly pinned Neon URL
// silently redirect migration DDL through schema/options/host overrides.
const SAFE_QUERY_KEYS=new Set([
  "sslmode","channel_binding","application_name","connect_timeout",
  "pgbouncer","connection_limit","pool_timeout",
]);
function safeMigrationDsnQuery(raw,direct=false) {
  try {
    const url=new URL(raw);
    const entries=[...url.searchParams.entries()];
    if(new Set(entries.map(([key])=>key)).size!==entries.length)return false;
    for(const [key,value] of entries) {
      if(!SAFE_QUERY_KEYS.has(key))return false;
      if(key==="sslmode" && value!=="require")return false;
      if(key==="channel_binding" && value!=="require")return false;
      if(key==="application_name" && !/^[a-zA-Z0-9_-]{1,64}$/.test(value))return false;
      if(key==="connect_timeout" && (!/^[1-9][0-9]?$/.test(value) || Number(value)>30))return false;
      if(key==="pgbouncer" && (direct || value!=="true"))return false;
      if(key==="connection_limit" && (direct || !/^[1-9][0-9]?$/.test(value) || Number(value)>20))return false;
      if(key==="pool_timeout" && (direct || !/^[1-9][0-9]?$/.test(value) || Number(value)>60))return false;
    }
    return true;
  }catch{return false;}
}

export function inspectStagingMigrationGate(env={}) {
  const issues=[];
  if(env.GITHUB_REF!=="refs/heads/development" || env.GITHUB_REF_PROTECTED!=="true")
    issues.push("Staging migration requires a protected development branch");
  // This must be the approved source repository AND the protected, manual
  // migration workflow. Ref-protected + dispatch alone can be recreated in
  // a fork or in a different workflow carrying staging credentials.
  if(env.GITHUB_REPOSITORY!=="Vertex-Systems-Network/vsn-builder" ||
     env.GITHUB_WORKFLOW_REF!==
       "Vertex-Systems-Network/vsn-builder/.github/workflows/phase3-staging-neon-migration.yml@refs/heads/development")
    issues.push("Staging migration requires the reviewed protected workflow identity");
  if(env.GITHUB_EVENT_NAME!=="workflow_dispatch")
    issues.push("Staging migration requires deliberate manual dispatch");
  if(env.APP_ENV!=="staging" || env.NEON_PROJECT_ID!=="shiny-violet-61219572")
    issues.push("Staging Neon target identity mismatch");
  if(env.SHOPIFY_BILLING_TEST_MODE!=="true")
    issues.push("Staging must use Shopify test billing");
  if(env.STAGING_MIGRATION_APPROVED!=="true")
    issues.push("Migration approval has not been attested");
  // A branch name/id is NOT evidence that a recoverable backup exists.
  // Match a pinned Neon SNAPSHOT ID, then verify its real project ownership,
  // source branch and restored default via the read-only Neon control-plane API.
  const backup=String(env.VSN_STAGING_BACKUP_EVIDENCE||"");
  if(!/^snap-[a-z0-9-]{8,90}$/.test(backup) ||
     backup!==targets.staging.neon_pre_migration_snapshot_id)
    issues.push("Verified Staging backup snapshot identifier missing or mismatched");
  // Fail BEFORE Prisma migrate deploy if any SQL byte differs from the
  // reviewed/pinned SHA-256 identities, even when filenames and model-table
  // counts still look correct. A runtime-computed hash is not an approval.
  try {
    expectedStagingMigrationChecksums();
    expectedStagingMigrationTables();
  }catch {
    issues.push("Reviewed Staging migration SQL checksum or model inventory mismatch");
  }
  // Validate secrets by shape and identical DB user/name; do not print them.
  const pair=inspectHostedNeonUrlPair("staging",{
    DATABASE_URL:env.DATABASE_URL,DIRECT_URL:env.DIRECT_URL,
  });
  issues.push(...pair.issues);
  if(!safeMigrationDsnQuery(env.DATABASE_URL) ||
     !safeMigrationDsnQuery(env.DIRECT_URL,true))
    issues.push("Unreviewed or ambiguous Prisma connection query parameters");
  // A correct Neon endpoint can contain multiple databases: the migration is
  // authorized solely for the empty Builder Staging 'neondb' database. Never
  // accept two matching URLs that both point to an unrelated database.
  try {
    if(new URL(env.DATABASE_URL).pathname!=="/neondb" ||
       new URL(env.DIRECT_URL).pathname!=="/neondb")
      issues.push("Staging Prisma migrations require exactly neondb");
  }catch {
    issues.push("Staging Prisma database identity could not be verified");
  }
  return {ready:issues.length===0,issues};
}
if(process.argv[1]?.endsWith("/phase3-staging-migration-preflight.mjs")){
  const result=inspectStagingMigrationGate(process.env);
  if(!result.ready){
    for(const issue of result.issues)console.error("BLOCKED "+issue);
    process.exitCode=1;
  }else console.log("Staging-only protected migration policy PASS (no SQL executed)");
}
