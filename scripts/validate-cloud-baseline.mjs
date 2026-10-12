import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root=process.cwd();
const folder=path.join(root,"prisma/cloud/migrations");
const lock=fs.readFileSync(path.join(folder,"migration_lock.toml"),"utf8");
const schema=fs.readFileSync(path.join(root,"prisma/cloud/schema.prisma"),"utf8");
const expectedMigration="20261013_builder_cloud_baseline";
const migration=path.join(folder,expectedMigration,"migration.sql");
const errors=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg)};
check(/provider\s*=\s*"postgresql"/.test(lock),"Migration lock must use PostgreSQL provider");
check(fs.existsSync(migration),"Proposed baseline SQL is absent; generate it offline");
const modelNames=[...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m=>m[1]);
check(modelNames.length===51,"Unexpected cloud schema model count");
if(fs.existsSync(migration)) {
 const sql=fs.readFileSync(migration,"utf8");
 check(!/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\s+\S+\s+DROP\b/i.test(sql),"Baseline must never contain destructive SQL");
 for(const name of modelNames)check(sql.includes('CREATE TABLE "'+name+'"'),"Baseline does not create model "+name);
 check(sql.includes('CREATE TABLE "_prisma_migrations"')===false,"Prisma owns migration history; do not create it inside the baseline SQL");
 const hash=crypto.createHash("sha256").update(sql).digest("hex");
 console.log("Cloud PostgreSQL proposed baseline: "+modelNames.length+" models, sha256="+hash);
}
const candidate=path.join(root,"artifacts/cloud-schema/proposed-initial-schema.sql");
if(fs.existsSync(candidate)&&fs.existsSync(migration))check(
 fs.readFileSync(candidate,"utf8")===fs.readFileSync(migration,"utf8"),
 "Prisma empty-to-schema SQL proposal differs from checked-in baseline; regenerate or reconcile");
for(const err of errors)console.error("FAIL "+err);
if(errors.length)process.exitCode=1;
else console.log("Offline hosted PostgreSQL baseline integrity PASS (not executed against a database).");
