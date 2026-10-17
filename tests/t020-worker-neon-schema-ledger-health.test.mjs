import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  isVerifiedWorkerSchemaMetadata,BUILDER_WORKER_MIGRATIONS,
} from "../app/services/worker-schema-metadata-health.js";
import {EXPECTED_STAGING_MIGRATIONS} from "../scripts/t018-staging-migration-ledger.mjs";

const began=new Date("2026-10-17T00:00:00Z"),ended=new Date("2026-10-17T00:00:09Z");
function fixture(){
 return {
  summary:{database:"neondb",tables:54,essential_tables:4},
  records:BUILDER_WORKER_MIGRATIONS.map(migration_name=>({
   migration_name,checksum:"a".repeat(64),started_at:began,
   finished_at:ended,rolled_back_at:null,
  })),
 };
}
test("Worker metadata is aligned with the exact approved T018 migration identities",()=>{
 assert.deepEqual(BUILDER_WORKER_MIGRATIONS,EXPECTED_STAGING_MIGRATIONS);
 assert.equal(isVerifiedWorkerSchemaMetadata(fixture()),true);
 assert.equal(isVerifiedWorkerSchemaMetadata({...fixture(),records:fixture().records.reverse()}),true);
});
test("empty, wrong, incomplete and arbitrary-count schema states cannot look healthy",()=>{
 const mutations=[
  x=>x.summary.database="brovexa",
  x=>x.summary.database="builder_ci",
  x=>x.summary.tables=52,
  x=>x.summary.tables="54",
  x=>x.summary.tables=NaN,
  x=>x.summary.essential_tables=3,
  x=>x.summary.essential_tables=5,
  x=>x.summary.essential_tables="4",
  x=>x.summary=null,
  x=>x.records=[],
  x=>x.records.pop(),
  x=>x.records.push({...x.records[0]}),
  x=>x.records[1].migration_name=x.records[0].migration_name,
  x=>x.records[1].migration_name="20261013_some_other_migration",
  x=>x.records[0].checksum="broken",
  x=>x.records[1].checksum="F".repeat(64),
  x=>x.records[0].checksum=null,
  x=>x.records[0].started_at=null,
  x=>x.records[1].finished_at=null,
  x=>x.records[1].finished_at=new Date(0),
  x=>x.records[1].rolled_back_at=ended,
 ];
 for(const mutate of mutations){
  const state=fixture();mutate(state);
  assert.equal(isVerifiedWorkerSchemaMetadata(state),false);
 }
 assert.equal(isVerifiedWorkerSchemaMetadata(),false);
});
test("hosted Worker uses read-only canonical ledger metadata and never claims merchant readiness",()=>{
 const source=readFileSync("workers/app.js","utf8");
 assert.match(source,/isVerifiedWorkerSchemaMetadata\(\{summary:metrics\?\.\[0\],records\}\)/);
 assert.match(source,/SELECT migration_name, checksum, started_at, finished_at, rolled_back_at/);
 assert.match(source,/current_database\(\)/);
 assert.match(source,/BuilderShopInstallation/);
 assert.match(source,/sourceChecksumAttested:false,merchantAppReady:false/);
 assert.match(source,/if\(url\.pathname==="\/readyz"/);
 const method=source.slice(source.indexOf("async function databaseHealth"),source.indexOf("\nexport default"));
 assert.doesNotMatch(method,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
 assert.doesNotMatch(method,/console\.|\.accessToken\b|\.session\.findMany/);
});
