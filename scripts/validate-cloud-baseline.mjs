import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

// Review the actual two-step migration history, rather than assuming the
// separately fenced BuilderShopInstallation model existed in the first 51
// tables. NEVER rewrite an already-reviewed migration to silence a drift.
const root=process.cwd();
const folder=path.join(root,"prisma/cloud/migrations");
const schema=fs.readFileSync(path.join(root,"prisma/cloud/schema.prisma"),"utf8");
const lock=fs.readFileSync(path.join(folder,"migration_lock.toml"),"utf8");
const baseline=path.join(folder,"20261013_builder_cloud_baseline","migration.sql");
const fence=path.join(folder,"20261013_builder_shop_installation_fence","migration.sql");
const errors=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg)};
const modelNames=[...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m=>m[1]);
const expectedModelSet=new Set(modelNames);
const requiredFence="BuilderShopInstallation";
check(/provider\s*=\s*"postgresql"/.test(lock),"Cloud migration lock must use PostgreSQL");
check(modelNames.length>=52 && expectedModelSet.has(requiredFence),
  "Required Shopify installation fence missing from PostgreSQL schema");
check(fs.existsSync(baseline),"Initial 51-table migration missing");
check(fs.existsSync(fence),"Durable installation fence migration missing");

const noDestructive=/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\s+\S+\s+DROP\b/i;
function ddlStatements(sql) {
  return sql.replace(/^\s*--[^\r\n]*$/gm,"").split(";")
    .map(part=>part.replace(/\s+/g," ").trim()).filter(Boolean).map(part=>part+";");
}
const sort=(items)=>[...items].sort();
const createdTables=(sql)=>[...sql.matchAll(/\bCREATE\s+TABLE\s+"([^"]+)"/gi)].map(m=>m[1]);
if(fs.existsSync(baseline)&&fs.existsSync(fence)){
  const baseSql=fs.readFileSync(baseline,"utf8");
  const fenceSql=fs.readFileSync(fence,"utf8");
  for(const [label,sql] of [["baseline",baseSql],["fence",fenceSql]]){
    check(!noDestructive.test(sql),label+" contains destructive SQL");
    check(!/CREATE\s+TABLE\s+"_prisma_migrations"/i.test(sql),
      label+" must leave Prisma migration-history tables to Prisma");
  }
  const baseTables=createdTables(baseSql), fenceTables=createdTables(fenceSql);
  check(baseTables.length===51 && !baseTables.includes(requiredFence),
    "Original 51-table baseline was unexpectedly changed");
  check(fenceTables.length===1 && fenceTables[0]===requiredFence,
    "Separate Shopify installation fence migration is not additive/isolated");
  const allTables=[...baseTables,...fenceTables];
  check(allTables.length===expectedModelSet.size &&
    new Set(allTables).size===allTables.length &&
    allTables.every(t=>expectedModelSet.has(t)),
    "Reviewed migration chain tables differ from canonical cloud schema");
  const candidate=path.join(root,"artifacts/cloud-schema/proposed-initial-schema.sql");
  if(fs.existsSync(candidate)){
    const proposed=fs.readFileSync(candidate,"utf8");
    check(!noDestructive.test(proposed),"Prisma from-empty proposal contains destructive SQL");
    check(JSON.stringify(sort(createdTables(proposed)))===JSON.stringify(sort(modelNames)),
      "Prisma generated table inventory differs from canonical PostgreSQL models");
    // Compare ALL DDL statements (tables, indexes, foreign keys), allowing
    // the second additive migration to place the fence at the end rather than
    // in the model declaration's original order. No structural drift waiver.
    check(JSON.stringify(sort(ddlStatements(baseSql+"\n"+fenceSql)))===
      JSON.stringify(sort(ddlStatements(proposed))),
      "Combined approved migrations are not DDL-equivalent to Prisma's fresh-schema proposal");
  }
  const digest=crypto.createHash("sha256").update(baseSql+"\n"+fenceSql).digest("hex");
  console.log("Cloud PostgreSQL reviewed chain: "+allTables.length+
    " models in two additive migrations, sha256="+digest);
}
for(const err of errors)console.error("FAIL "+err);
if(errors.length)process.exitCode=1;
else console.log("Offline cloud PostgreSQL migration-chain integrity PASS (no SQL executed).");
