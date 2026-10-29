// T020 Worker-safe, read-only PostgreSQL migration metadata acceptance.
// This is *not* source SQL SHA256 attestation. T018's protected manual
// post-migrate checker separately validates exact reviewed SQL checksums.
// Neither a table count alone nor arbitrary finished Prisma ledger rows can
// tell the hosted Worker that the Builder schema is healthy.
export const BUILDER_WORKER_MIGRATIONS=Object.freeze([
  "20261013_builder_cloud_baseline",
  "20261013_builder_shop_installation_fence",
]);
const validCount=n=>Number.isSafeInteger(n)&&n>=0;
// Driver adapters may return timestamps as ISO strings instead of Date objects.
const asDate=n=>n instanceof Date?n:typeof n==="string"&&n?new Date(n):null;
const validDate=n=>{const d=asDate(n);return Boolean(d)&&Number.isFinite(d.getTime());};
export function isVerifiedWorkerSchemaMetadata({summary,records}={}) {
  if(!summary||summary.database!=="neondb" ||
     !validCount(summary.tables)||summary.tables<53 ||
     !validCount(summary.essential_tables)||summary.essential_tables!==4 ||
     !Array.isArray(records)||records.length!==BUILDER_WORKER_MIGRATIONS.length)
    return false;
  const names=new Set();
  for(const row of records){
    if(!row||typeof row.migration_name!=="string"||
       !BUILDER_WORKER_MIGRATIONS.includes(row.migration_name)||
       names.has(row.migration_name) ||
       typeof row.checksum!=="string" ||
       !/^[a-f0-9]{64}$/.test(row.checksum) ||
       !validDate(row.started_at)||!validDate(row.finished_at)||
       asDate(row.finished_at).getTime()<asDate(row.started_at).getTime()||
       (row.rolled_back_at!==null&&row.rolled_back_at!==undefined))
      return false;
    names.add(row.migration_name);
  }
  return names.size===BUILDER_WORKER_MIGRATIONS.length;
}
