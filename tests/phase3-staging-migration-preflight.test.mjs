import test from "node:test";
import assert from "node:assert/strict";
import {inspectStagingMigrationGate} from "../scripts/phase3-staging-migration-preflight.mjs";

const hosted="ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech";
const pooled=hosted.replace("ep-little-dream-b3g6puj2.","ep-little-dream-b3g6puj2-pooler.");
function fake(overrides={}) {
  return {
    GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true",
    GITHUB_EVENT_NAME:"workflow_dispatch",APP_ENV:"staging",
    NEON_PROJECT_ID:"shiny-violet-61219572",
    SHOPIFY_BILLING_TEST_MODE:"true",STAGING_MIGRATION_APPROVED:"true",
    VSN_STAGING_BACKUP_EVIDENCE:"br-synthetic-reviewed-backup-124",
    DATABASE_URL:`postgresql://synthetic:ci-only@${pooled}/disposable?sslmode=require`,
    DIRECT_URL:`postgresql://synthetic:ci-only@${hosted}/disposable?sslmode=require`,
    ...overrides,
  };
}
test("Staging-only direct and pooled migration gate accepts isolated synthetic shape",()=>{
  assert.equal(inspectStagingMigrationGate(fake()).ready,true);
});
test("Migration cannot run from unprotected development or production branches",()=>{
  for(const overrides of [
    {GITHUB_REF_PROTECTED:"false"},
    {GITHUB_REF:"refs/heads/main"},
    {GITHUB_EVENT_NAME:"pull_request"},
    {APP_ENV:"production"},
    {NEON_PROJECT_ID:"nameless-violet-68750490"},
    {SHOPIFY_BILLING_TEST_MODE:"false"},
    {STAGING_MIGRATION_APPROVED:""},
    {VSN_STAGING_BACKUP_EVIDENCE:""},
    {VSN_STAGING_BACKUP_EVIDENCE:"br-square-mountain-b3ij6q2s"},
  ])assert.equal(inspectStagingMigrationGate(fake(overrides)).ready,false,JSON.stringify(overrides));
});
test("Migration cannot target production compute, weak TLS or pooled direct URL",()=>{
  const prod="ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech";
  for(const overrides of [
    {DIRECT_URL:`postgresql://synthetic:ci-only@${prod}/disposable?sslmode=require`},
    {DIRECT_URL:`postgresql://synthetic:ci-only@${pooled}/disposable?sslmode=require`},
    {DATABASE_URL:`postgresql://synthetic:ci-only@${pooled}/disposable?sslmode=disable`},
    {DATABASE_URL:fake().DIRECT_URL},
  ])assert.equal(inspectStagingMigrationGate(fake(overrides)).ready,false);
});
