import test from "node:test";
import {readFileSync} from "node:fs";
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
    VSN_STAGING_BACKUP_EVIDENCE:"snap-green-bar-b3m1btfb",
    DATABASE_URL:`postgresql://synthetic:ci-only@${pooled}/neondb?sslmode=require`,
    DIRECT_URL:`postgresql://synthetic:ci-only@${hosted}/neondb?sslmode=require`,
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
    {VSN_STAGING_BACKUP_EVIDENCE:"snap-synthetic-reviewed-backup"},
  ])assert.equal(inspectStagingMigrationGate(fake(overrides)).ready,false,JSON.stringify(overrides));
});
test("Migration fails closed if both credentials target a different same-project database",()=>{
  const changed=fake({
    DATABASE_URL:fake().DATABASE_URL.replace("/neondb?","/brovexa?"),
    DIRECT_URL:fake().DIRECT_URL.replace("/neondb?","/brovexa?"),
  });
  assert.equal(inspectStagingMigrationGate(changed).ready,false);
  assert.equal(inspectStagingMigrationGate(fake({
    DIRECT_URL:fake().DIRECT_URL.replace("/neondb?","/otherdb?"),
  })).ready,false);
});
test("Migration cannot target production compute, weak TLS or pooled direct URL",()=>{
  const prod="ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech";
  for(const overrides of [
    {DIRECT_URL:`postgresql://synthetic:ci-only@${prod}/neondb?sslmode=require`},
    {DIRECT_URL:`postgresql://synthetic:ci-only@${pooled}/neondb?sslmode=require`},
    {DATABASE_URL:`postgresql://synthetic:ci-only@${pooled}/disposable?sslmode=disable`},
    {DATABASE_URL:fake().DIRECT_URL},
  ])assert.equal(inspectStagingMigrationGate(fake(overrides)).ready,false);
});

test("real Staging migration is manual-only; R2 is optional and cannot gate empty baseline",()=>{
  const migration=readFileSync(".github/workflows/phase3-staging-neon-migration.yml","utf8");
  const optionalR2=readFileSync(".github/workflows/t018-staging-private-r2-backup.yml","utf8");
  assert.match(migration,/workflow_dispatch:/);
  assert.doesNotMatch(migration,/^  push:/m);
  assert.match(migration,/APPLY_EMPTY_BUILDER_STAGING_ONLY/);
  assert.match(migration,/secrets\.DATABASE_URL/);
  assert.match(migration,/secrets\.DIRECT_URL/);
  assert.match(migration,/t018-staging-migration-readiness\.py/);
  assert.match(migration,/phase3-staging-neon-live-proof\.mjs/);
  assert.doesNotMatch(migration,/CLOUDFLARE_R2_/);
  assert.match(optionalR2,/workflow_dispatch:/);
  assert.doesNotMatch(optionalR2,/^  push:/m);
  assert.match(optionalR2,/github\.event_name == 'workflow_dispatch'/);
});
