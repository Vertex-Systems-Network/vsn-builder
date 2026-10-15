import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspectStagingCloudClient } from "../scripts/staging-cloud-client-verify.mjs";
const schema = readFileSync("prisma/cloud/schema.prisma","utf8");
const sqliteSchema = readFileSync("prisma/schema.prisma","utf8");
const ignoreFile = readFileSync(".gitignore","utf8");
const inspect=(overrides={})=>inspectStagingCloudClient({schema,sqliteSchema,ignoreFile,...overrides});
test("isolated PostgreSQL Workerd generators are configured and ignored",()=>{
  const r=inspect();
  assert.equal(r.ready,true,JSON.stringify(r.checks));
  assert.equal(r.cloudModels,52);
  assert.equal(r.localModels,51);
});
test("unexpected local SQLite rewrite fails closed",()=>assert.equal(inspect({sqliteSchema:sqliteSchema.replace('provider = "sqlite"','provider = "postgresql"')}).ready,false));
test("native Rust engine in Workerd Prisma fails closed",()=>assert.equal(inspect({schema:schema.replace(/(generator workerEdge \{[^}]*?)engineType\s*=\s*"client"/s,'$1engineType = "library"')}).ready,false));
test("generated edge clients must be excluded from Git index",()=>assert.equal(inspect({ignoreFile:ignoreFile.replace("/generated/prisma-edge/","")}).ready,false));
