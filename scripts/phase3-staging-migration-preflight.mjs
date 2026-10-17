// Run on a protected GitHub Environment, never in ordinary PR CI.
// Pure policy check; does not connect, migrate, back up, or print secrets.
import { inspectHostedNeonUrlPair } from "../app/services/neon-target-policy.js";
import targets from "../config/deployment/environments.json" with { type: "json" };

export function inspectStagingMigrationGate(env={}) {
  const issues=[];
  if(env.GITHUB_REF!=="refs/heads/development" || env.GITHUB_REF_PROTECTED!=="true")
    issues.push("Staging migration requires a protected development branch");
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
  // Validate secrets by shape and identical DB user/name; do not print them.
  const pair=inspectHostedNeonUrlPair("staging",{
    DATABASE_URL:env.DATABASE_URL,DIRECT_URL:env.DIRECT_URL,
  });
  issues.push(...pair.issues);
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
