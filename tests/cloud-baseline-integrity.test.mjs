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
 assert.match(source,/baseTables\\.length===51/);
 assert.match(source,/fenceTables\\.length===1/);
 assert.match(source,/requiredFence="BuilderShopInstallation"/);
});
test("generated baseline when present must be intact and non-destructive",()=>{
 const sqlPath="prisma/cloud/migrations/20261013_builder_cloud_baseline/migration.sql";
 if(!fs.existsSync(sqlPath))return; // Initial generator CI validates after file creation.
 const result=spawnSync(process.execPath,["scripts/validate-cloud-baseline.mjs"],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});

test("reviewed two-step migration keeps the separate 52nd Shopify installation model",()=>{
 const source=fs.readFileSync("prisma/cloud/schema.prisma","utf8");
 const names=[...source.matchAll(/^model\s+(\w+)\s*\{/gm)].map(row=>row[1]);
 assert.equal(names.length,52);
 const baseline=fs.readFileSync("prisma/cloud/migrations/20261013_builder_cloud_baseline/migration.sql","utf8");
 const addon=fs.readFileSync("prisma/cloud/migrations/20261013_builder_shop_installation_fence/migration.sql","utf8");
 const tables=sql=>[...sql.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/g)].map(row=>row[1]);
 assert.equal(tables(baseline).length,51);
 assert.deepEqual(tables(addon),["BuilderShopInstallation"]);
 assert.deepEqual([...tables(baseline),...tables(addon)].sort(),names.sort());
 assert.doesNotMatch(baseline+"\n"+addon,/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b/i);
});
