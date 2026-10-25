import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureFeatureSchema,getRuntimeSchemaHealth,isMissingDatabaseTableError,
  schemaRecoveryMessage,VsnSchemaNotReadyError,VSN_FEATURE_TABLES,
} from "../app/services/worker-database-health.server.js";
import {BUILDER_WORKER_MIGRATIONS} from "../app/services/worker-schema-metadata-health.js";
import {VSN_HEALTH_TABLES} from "../app/services/database-feature-contract.js";

const started=new Date("2026-10-13T00:00:00.000Z");
function database({missing=[],badLedger=false}={}){
  return {$queryRawUnsafe:async sql=>{
    if(sql.includes("information_schema.tables")&&sql.includes("table_name AS name"))
      return VSN_HEALTH_TABLES.filter(name=>!missing.includes(name)).map(name=>({name}));
    if(sql.includes("current_database()"))return [{database:"neondb",tables:54,essential_tables:4}];
    if(sql.includes("_prisma_migrations"))return BUILDER_WORKER_MIGRATIONS.map((migration_name,index)=>({
      migration_name,checksum:badLedger&&index===0?"bad":"a".repeat(64),
      started_at:started,finished_at:new Date(started.getTime()+1000),rolled_back_at:null,
    }));
    throw new Error("unexpected SQL");
  }};
}

test("hosted schema health validates Staging Neon and all accepted Worker migrations",async()=>{
  const health=await getRuntimeSchemaHealth(database());
  assert.equal(health.ready,true);
  assert.equal(health.databaseTargetMatches,true);
  assert.equal(health.sourceChecksumAttested,false);
  assert.equal(health.expectedMigrationApplied,true);
  assert.deepEqual(health.appliedMigrations,BUILDER_WORKER_MIGRATIONS);
  assert.equal(health.features.emailBuilder.ready,true);
  assert.deepEqual(Object.keys(health.features).sort(),Object.keys(VSN_FEATURE_TABLES).sort());
  assert.equal((await ensureFeatureSchema(database(),"emailBuilder")).ready,true);
});

test("missing tables or forged migration metadata fail closed with safe messages",async()=>{
  const missing=await getRuntimeSchemaHealth(database({missing:["BuilderEmailTemplate"]}));
  assert.equal(missing.ready,false);
  assert.equal(missing.features.emailBuilder.ready,false);
  await assert.rejects(ensureFeatureSchema(database({missing:["BuilderEmailTemplate"]}),"emailBuilder"),error=>{
    assert(error instanceof VsnSchemaNotReadyError);
    assert.match(schemaRecoveryMessage(error,"Email Builder"),/hosted database schema/);
    assert.doesNotMatch(schemaRecoveryMessage(error),/postgresql:|password|token/i);
    return true;
  });
  const invalid=await getRuntimeSchemaHealth(database({badLedger:true}));
  assert.equal(invalid.ready,false);
  assert.equal(invalid.features.core.ready,false);
});

test("PostgreSQL missing-table errors are recognized without exposing details",()=>{
  assert.equal(isMissingDatabaseTableError({code:"P2021"}),true);
  assert.equal(isMissingDatabaseTableError(new Error('relation "BuilderEmailTemplate" does not exist')),true);
  assert.equal(isMissingDatabaseTableError(new Error("connection secret redacted")),false);
});
