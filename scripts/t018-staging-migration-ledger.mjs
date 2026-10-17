// T018: exact, read-only Staging Prisma migration ledger acceptance.
// The file checksums are computed from the reviewed repository SQL, NEVER
// sourced from GitHub dispatch input or from a caller-controlled database row.
// Exports pure helpers so source-only PR CI has no Neon secrets or Prisma client.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

export const EXPECTED_STAGING_MIGRATIONS=Object.freeze([
  "20261013_builder_cloud_baseline",
  "20261013_builder_shop_installation_fence",
]);
const ERROR="T018_STAGING_MIGRATION_LEDGER_UNVERIFIED";
const blocked=()=>{throw new Error(ERROR)};
const safeDate=value=>value instanceof Date&&Number.isFinite(value.getTime());
const integer=value=>Number.isSafeInteger(value)&&value>=0;
// No ambiguous status coercions: PostgreSQL raw integer counts and exact
// Prisma migration checksums must match on their original data types.
export function expectedStagingMigrationChecksums(readFile=(name)=>
  readFileSync(new URL("../prisma/cloud/migrations/"+name+"/migration.sql",import.meta.url))
){
  const hashes=new Map();
  for(const name of EXPECTED_STAGING_MIGRATIONS){
    const bytes=readFile(name);
    if(!Buffer.isBuffer(bytes)||bytes.byteLength<50)blocked();
    hashes.set(name,createHash("sha256").update(bytes).digest("hex"));
  }
  return hashes;
}

export function attestStagingMigrationLedger({summary,records,hashes}={}){
  if(!summary||!Array.isArray(records)||records.length!==EXPECTED_STAGING_MIGRATIONS.length ||
     !(hashes instanceof Map)||hashes.size!==EXPECTED_STAGING_MIGRATIONS.length ||
     !integer(summary.tables)||summary.tables<53 ||
     !integer(summary.essential_tables)||summary.essential_tables!==4 ||
     summary.database!=="neondb")
    blocked();
  const seen=new Set();
  for(const row of records){
    if(!row||typeof row.migration_name!=="string"||
       !EXPECTED_STAGING_MIGRATIONS.includes(row.migration_name)||
       seen.has(row.migration_name)||
       typeof row.checksum!=="string" ||
       !/^[0-9a-f]{64}$/.test(row.checksum)||
       row.checksum!==hashes.get(row.migration_name)||
       !safeDate(row.started_at)||!safeDate(row.finished_at)||
       row.finished_at.getTime()<row.started_at.getTime()||
       row.rolled_back_at!==null)
      blocked();
    seen.add(row.migration_name);
  }
  if(seen.size!==EXPECTED_STAGING_MIGRATIONS.length ||
     EXPECTED_STAGING_MIGRATIONS.some(name=>!seen.has(name) || !hashes.has(name)))
    blocked();
  return {ready:true,migrations:records.length,essential_tables:4,
    zero_merchant_rows_inspected:true,production_touched:false};
}
