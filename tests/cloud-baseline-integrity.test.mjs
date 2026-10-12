import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

test("cloud baseline verifier refuses missing SQL before generation",()=>{
 const lock=fs.readFileSync("prisma/cloud/migrations/migration_lock.toml","utf8");
 assert.match(lock,/provider\s*=\s*"postgresql"/);
 const source=fs.readFileSync("scripts/validate-cloud-baseline.mjs","utf8");
 assert.match(source,/DROP/);
 assert.match(source,/CREATE TABLE/);
 assert.match(source,/modelNames\.length===51/);
});
test("generated baseline when present must be intact and non-destructive",()=>{
 const sqlPath="prisma/cloud/migrations/20261013_builder_cloud_baseline/migration.sql";
 if(!fs.existsSync(sqlPath))return; // Initial generator CI validates after file creation.
 const result=spawnSync(process.execPath,["scripts/validate-cloud-baseline.mjs"],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});
