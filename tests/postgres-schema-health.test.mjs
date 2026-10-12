import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { VSN_HEALTH_TABLES } from "../app/services/database-feature-contract.js";
import { inspectPostgresSchemaHealth } from "../app/services/postgres-schema-health.js";

const CHECKSUM="a".repeat(64);
const CONF={ expectedDatabaseName:"builder_staging", expectedSchemaName:"public",
  expectedMigrationName:"builder_cloud_baseline", expectedMigrationChecksum:CHECKSUM };
const makeDb=({tables=VSN_HEALTH_TABLES, rows=true, identity=true, checksum=CHECKSUM, throwOn=null, migrated=true}={})=>{
  const executed=[];
  return {
    executed,
    async $queryRaw(parts) {
      const sql=parts.join("");
      executed.push(sql);
      if (sql.includes("current_database")) {
        if (throwOn==="identity") throw new Error("connection secret must not be logged");
        return identity ? [{databaseName:"builder_staging",schemaName:"public"}] : [];
      }
      if (sql.includes("information_schema.tables")) {
        if (throwOn==="tables") throw new Error("connection secret must not be logged");
        return tables.map(tableName=>({tableName}));
      }
      if (sql.includes('"_prisma_migrations"')) {
        if (throwOn==="migrations") throw new Error("connection secret must not be logged");
        return migrated ? [{migrationName:"builder_cloud_baseline",checksum,finishedAt:new Date(),rolledBackAt:null}] : [];
      }
      throw new Error("Unexpected query " + sql);
    },
  };
};
test("complete PostgreSQL health requires exact database, tables, baseline and checksum",async()=>{
 const db=makeDb();
 const result=await inspectPostgresSchemaHealth(db,CONF);
 assert.equal(result.ready,true);
 assert.deepEqual(result.problems,[]);
 assert.equal(db.executed.length,3);
 assert(db.executed.every(sql=>!sql.includes("sqlite_master")&&!sql.includes("PRAGMA")&&!sql.includes("builder_staging")));
});
test("missing cloud migrations remain fail-closed even when tables exist",async()=>{
 const result=await inspectPostgresSchemaHealth(makeDb({migrated:false}),CONF);
 assert.equal(result.ready,false);
 assert.equal(result.migrationApplied,false);
 assert(result.problems.includes("PostgreSQL baseline migration not applied"));
});
test("checksum mismatch cannot be reported as ready",async()=>{
 const result=await inspectPostgresSchemaHealth(makeDb({checksum:"b".repeat(64)}),CONF);
 assert.equal(result.ready,false);
 assert.equal(result.migrationChecksumMatches,false);
});
test("missing table invalidates only affected feature and full readiness",async()=>{
 const missing="BuilderWishlist";
 const result=await inspectPostgresSchemaHealth(makeDb({tables:VSN_HEALTH_TABLES.filter(t=>t!==missing)}),CONF);
 assert.equal(result.ready,false);
 assert.deepEqual(result.missingTables,[missing]);
 assert.equal(result.features.wishlist.ready,false);
 assert.equal(result.features.core.ready,true);
});
test("unverified database name and baseline evidence fail closed",async()=>{
 const result=await inspectPostgresSchemaHealth(makeDb(),{});
 assert.equal(result.ready,false);
 assert(result.problems.includes("Expected database identity is missing"));
 assert(result.problems.includes("Expected PostgreSQL baseline migration is missing"));
});
test("cloud health does not leak database errors or secrets",async()=>{
 const result=await inspectPostgresSchemaHealth(makeDb({throwOn:"tables"}),CONF);
 assert.equal(result.ready,false);
 assert.equal(JSON.stringify(result).includes("connection secret"),false);
});
test("nonconfigured client cannot report readiness",async()=>{
 const result=await inspectPostgresSchemaHealth(null,CONF);
 assert.equal(result.ready,false);
});
test("Local SQLite health shares the exact source-of-truth feature contract",()=>{
 const legacy=fs.readFileSync("app/services/database-health.server.js","utf8");
 assert.match(legacy,/from "\.\/database-feature-contract\.js"/);
 assert.match(legacy,/const HEALTH_TABLES = VSN_HEALTH_TABLES;/);
});
