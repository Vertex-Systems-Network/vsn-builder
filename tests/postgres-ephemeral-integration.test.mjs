// Never point this real-PostgreSQL integration suite at any hosted database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { VSN_HEALTH_TABLES } from "../app/services/database-feature-contract.js";
import { inspectPostgresSchemaHealth } from "../app/services/postgres-schema-health.js";

const allowed="postgresql://builder_ci:local_ephemeral_only@127.0.0.1:5432/builder_ci?schema=public";
assert.equal(process.env.DATABASE_URL,allowed,"This suite requires the disposable CI database");
assert.equal(process.env.DIRECT_URL,allowed,"Never connect migrations to an external DB");
assert.equal(process.env.NODE_ENV,"test","CI isolation required");
const require=createRequire(import.meta.url);
const { PrismaClient }=require("../generated/prisma-cloud/index.js");
const name="20261013_builder_cloud_baseline";
const checksum=crypto.createHash("sha256")
  .update(fs.readFileSync("prisma/cloud/migrations/"+name+"/migration.sql")).digest("hex");
const healthConfig={
  expectedDatabaseName:"builder_ci",expectedSchemaName:"public",
  expectedMigrationName:name,expectedMigrationChecksum:checksum
};
test("real PostgreSQL migrations, checksum, at least 52 application tables, and feature tables are healthy",async()=>{
 const db=new PrismaClient();
 try{
  const check=await inspectPostgresSchemaHealth(db,healthConfig);
  assert.equal(check.ready,true,JSON.stringify(check));
  assert.deepEqual(check.missingTables,[]);
  assert.equal(check.migrationApplied,true);
  assert.equal(check.migrationChecksumMatches,true);
  for(const feature of Object.values(check.features))assert.equal(feature.ready,true);
  const count=await db.$queryRaw`SELECT COUNT(*)::int AS "count" FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name != '_prisma_migrations'`;
  assert(count[0].count>=52,"Real PostgreSQL must contain the verified 52-table application baseline");
  assert(VSN_HEALTH_TABLES.length>10);
 }finally{await db.$disconnect()}
});
test("wrong database identity is rejected by actual PostgreSQL queries",async()=>{
 const db=new PrismaClient();
 try{
  const check=await inspectPostgresSchemaHealth(db,{...healthConfig,expectedDatabaseName:"some_other_database"});
  assert.equal(check.ready,false);
  assert(check.problems.includes("Database identity mismatch"));
 }finally{await db.$disconnect()}
});
test("wrong baseline checksum is rejected by actual PostgreSQL queries",async()=>{
 const db=new PrismaClient();
 try{
  const check=await inspectPostgresSchemaHealth(db,{...healthConfig,expectedMigrationChecksum:"f".repeat(64)});
  assert.equal(check.ready,false);
  assert(check.problems.includes("PostgreSQL migration checksum mismatch"));
 }finally{await db.$disconnect()}
});
test("isolated Prisma session can be created, read and deleted",async()=>{
 const db=new PrismaClient();
 const id="vsn-ci-ephemeral-session";
 try{
  await db.session.create({data:{id,shop:"ci-only.myshopify.com",state:"ci-test",accessToken:"non-real-ci-placeholder"}});
  const row=await db.session.findUnique({where:{id}});
  assert.equal(row?.shop,"ci-only.myshopify.com");
  assert.equal(row?.isOnline,false);
 }finally{
  await db.session.deleteMany({where:{id}});
  await db.$disconnect();
 }
});
