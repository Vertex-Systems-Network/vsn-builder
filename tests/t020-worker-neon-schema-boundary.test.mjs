import test from "node:test";
import assert from "node:assert/strict";
import {
  getRuntimeSchemaHealth,ensureFeatureSchema,VsnSchemaNotReadyError,
  VSN_EXPECTED_MIGRATION,isMissingDatabaseTableError,
} from "../workers/full-merchant-ci-database-health.js";
import {
  resolveVsnDatabaseLocation,normalizeSqliteFilePath,sqliteUrlFromFile,
} from "../workers/full-merchant-ci-database-location.js";
import { VSN_HEALTH_TABLES } from "../app/services/database-feature-contract.js";

test("all PostgreSQL tables cannot grant merchant access without migration checksum attestation",async()=>{
  let calls=0;
  const db={$queryRaw:async()=>{
    calls++;
    if(calls%2===1)return VSN_HEALTH_TABLES.map(name=>({name}));
    return [{
      migration_name:VSN_EXPECTED_MIGRATION,
      finished_at:new Date(),
      rolled_back_at:null,
    }];
  }};
  const status=await getRuntimeSchemaHealth(db);
  assert.equal(status.ready,false);
  assert.equal(status.databaseTargetMatches,false);
  assert.equal(status.expectedMigrationApplied,true);
  assert.equal(status.expectedMigrationChecksumMatches,false);
  assert.deepEqual(status.missingTables,[]);
  assert.ok(Object.values(status.features).every(feature=>feature.ready===false));
  await assert.rejects(ensureFeatureSchema(db,"core"),
    error=>error instanceof VsnSchemaNotReadyError&&error.code==="VSN_SCHEMA_NOT_READY");
});

test("database failure returns safe blocked health without driver errors",async()=>{
  const db={$queryRaw:async()=>{throw Error("postgresql://secret:credential@host/db");}};
  const status=await getRuntimeSchemaHealth(db);
  assert.equal(status.ready,false);
  assert.equal(status.migrationHistoryAvailable,false);
  assert.ok(status.missingTables.length>0);
  assert.doesNotMatch(JSON.stringify(status),/secret|credential|postgresql:\/\//);
  assert.equal(isMissingDatabaseTableError({code:"42P01"}),true);
});

test("Node SQLite paths cannot initialize or disclose a fake Worker database",()=>{
  const target=resolveVsnDatabaseLocation({DATABASE_URL:"file:dev.sqlite"});
  assert.equal(target.url,null);
  assert.equal(target.file,null);
  assert.match(target.source,/Worker request-scoped Neon/);
  for(const fn of [
    ()=>normalizeSqliteFilePath("../dev.sqlite"),
    ()=>sqliteUrlFromFile("/tmp/dev.sqlite"),
  ])assert.throws(fn,error=>error.code==="VSN_WORKER_SQLITE_UNSUPPORTED");
});
