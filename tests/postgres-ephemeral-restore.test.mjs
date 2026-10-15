import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {createRequire} from "node:module";
import {inspectPostgresSchemaHealth} from "../app/services/postgres-schema-health.js";

const source="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
const restored="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_restore?schema=public";
assert.equal(process.env.DATABASE_URL,source,"Restore drill may only connect to disposable source");
assert.equal(process.env.DIRECT_URL,source,"Restore drill direct URL must stay in CI");
assert.equal(process.env.RESTORE_DATABASE_URL,restored,"Restore target must be isolated CI database");
assert.equal(process.env.NODE_ENV,"test");
const require=createRequire(import.meta.url);
const {PrismaClient}=require("../generated/prisma-cloud/index.js");
const name="20261013_builder_cloud_baseline";
const checksum=crypto.createHash("sha256")
 .update(fs.readFileSync("prisma/cloud/migrations/"+name+"/migration.sql")).digest("hex");

test("restored PostgreSQL database passes all schema and migration health gates",async()=>{
 const db=new PrismaClient({datasources:{db:{url:restored}}});
 try{
  const health=await inspectPostgresSchemaHealth(db,{
    expectedDatabaseName:"builder_restore",expectedSchemaName:"public",
    expectedMigrationName:name,expectedMigrationChecksum:checksum
  });
  assert.equal(health.ready,true,JSON.stringify(health));
  assert.deepEqual(health.missingTables,[]);
  const count=await db.$queryRaw`SELECT COUNT(*)::int AS "count" FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name!='_prisma_migrations'`;
  assert(count[0].count>=52,"Restored PostgreSQL must retain the full 52-table application baseline");
 }finally{await db.$disconnect()}
});

test("database restore preserves a real Prisma session row and it remains editable",async()=>{
 const db=new PrismaClient({datasources:{db:{url:restored}}});
 const id="vsn-restore-ci-sentinel";
 try{
  const row=await db.session.findUnique({where:{id}});
  assert.equal(row?.shop,"restore-ci.myshopify.invalid");
  assert.equal(row?.state,"ci-backup-source");
  await db.session.update({where:{id},data:{state:"verified-after-restore"}});
  const updated=await db.session.findUnique({where:{id}});
  assert.equal(updated?.state,"verified-after-restore");
 }finally{await db.$disconnect()}
});

test("restore database identity mismatches are correctly blocked",async()=>{
 const db=new PrismaClient({datasources:{db:{url:restored}}});
 try{
  const health=await inspectPostgresSchemaHealth(db,{
    expectedDatabaseName:"builder_ci",expectedSchemaName:"public",
    expectedMigrationName:name,expectedMigrationChecksum:checksum
  });
  assert.equal(health.ready,false);
  assert(health.problems.includes("Database identity mismatch"));
 }finally{await db.$disconnect()}
});
