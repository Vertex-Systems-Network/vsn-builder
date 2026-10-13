// Run on a protected GitHub Environment, never in ordinary PR CI.
// Pure policy check; does not connect, migrate, back up, or print secrets.
import { inspectHostedNeonUrlPair } from "../app/services/neon-target-policy.js";

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
  const backup=String(env.VSN_STAGING_BACKUP_EVIDENCE||"");
  if(!/^br-[a-z0-9-]{8,90}$/.test(backup) ||
     backup==="br-wandering-queen-b3mmztjy")
    issues.push("Independent, tested Staging backup/restore branch evidence missing");
  // Validate secrets by shape and identical DB user/name; do not print them.
  const pair=inspectHostedNeonUrlPair("staging",{
    DATABASE_URL:env.DATABASE_URL,DIRECT_URL:env.DIRECT_URL,
  });
  issues.push(...pair.issues);
  return {ready:issues.length===0,issues};
}
if(process.argv[1]?.endsWith("/phase3-staging-migration-preflight.mjs")){
  const result=inspectStagingMigrationGate(process.env);
  if(!result.ready){
    for(const issue of result.issues)console.error("BLOCKED "+issue);
    process.exitCode=1;
  }else console.log("Staging-only protected migration policy PASS (no SQL executed)");
}
