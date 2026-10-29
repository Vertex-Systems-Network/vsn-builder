// Read-only PostgreSQL schema health for the full hosted Worker route graph.
// It validates known T018 migration metadata and required feature tables but
// deliberately does not claim source-SQL checksum attestation.
import { VSN_FEATURE_TABLES, VSN_HEALTH_TABLES } from "./database-feature-contract.js";
import { BUILDER_WORKER_MIGRATIONS, isVerifiedWorkerSchemaMetadata } from "./worker-schema-metadata-health.js";

export { VSN_FEATURE_TABLES };
export const VSN_EXPECTED_MIGRATION=BUILDER_WORKER_MIGRATIONS.at(-1);

export class VsnSchemaNotReadyError extends Error {
  constructor(feature,health){
    const missing=health?.features?.[feature]?.missingTables||health?.missingTables||[];
    super(`Hosted database schema is not ready for ${feature}. Missing: ${missing.join(", ")||"required approved migration"}.`);
    this.name="VsnSchemaNotReadyError";
    this.code="VSN_SCHEMA_NOT_READY";
    this.feature=feature;
    this.health=health;
  }
}

export async function getRuntimeSchemaHealth(db){
  let tableNames=new Set();
  let records=[];
  let summary=null;
  let databaseError=null;
  let metadataAvailable=false;
  let rawError="";
  try{
    // Sequential on purpose: inside an interactive Neon transaction (POST
    // health re-checks) concurrent queries on one client are rejected.
    const tables=await db.$queryRaw`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'`;
    const summaryRows=await db.$queryRaw`SELECT current_database()::text AS database,(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Session','BuilderPage','BuilderSubscription','BuilderShopInstallation')) AS essential_tables`;
    const migrationRows=await db.$queryRaw`SELECT migration_name,checksum,started_at,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    tableNames=new Set((Array.isArray(tables)?tables:[]).map(row=>String(row?.name||"")));
    summary=Array.isArray(summaryRows)?summaryRows[0]:null;
    records=Array.isArray(migrationRows)?migrationRows:[];
    metadataAvailable=true;
  }catch(error){
    rawError=String(error instanceof Error?error.message:error).slice(0,300);
    console.error("VSN schema health query failed:",rawError);
  }
  // Raw catalog queries can be refused by the request-scoped client; fall back to
  // probing each feature table through its Prisma model so features keep working.
  let probed=false;
  if(rawError){
    tableNames=await probeTables(db);
    probed=true;
    if(tableNames.size!==VSN_HEALTH_TABLES.length)databaseError="Hosted database schema metadata is unavailable.";
  }
  const schemaVerified=probed?tableNames.size===VSN_HEALTH_TABLES.length:isVerifiedWorkerSchemaMetadata({summary,records});
  const appliedRows=records.filter(row=>row?.finished_at&&!row?.rolled_back_at);
  const applied=appliedRows.map(row=>String(row.migration_name));
  const missingTables=VSN_HEALTH_TABLES.filter(name=>!tableNames.has(name));
  const features=Object.fromEntries(Object.entries(VSN_FEATURE_TABLES).map(([feature,requiredTables])=>{
    const missing=requiredTables.filter(name=>!tableNames.has(name));
    return [feature,{ready:schemaVerified&&missing.length===0,requiredTables,missingTables:missing}];
  }));
  const expectedApplied=probed?schemaVerified:BUILDER_WORKER_MIGRATIONS.every(name=>applied.includes(name));
  return {
    ready:schemaVerified&&expectedApplied&&missingTables.length===0&&!databaseError,
    databaseError,
    databaseErrorDetail:rawError||null,
    verifiedBy:probed?"model-probe":"catalog",
    databaseFile:null,
    expectedDatabaseFile:"neondb (Staging Neon)",
    databaseTargetMatches:summary?.database==="neondb",
    expectedMigration:VSN_EXPECTED_MIGRATION,
    expectedMigrationChecksum:null,
    expectedMigrationApplied:expectedApplied,
    expectedMigrationChecksumMatches:schemaVerified,
    sourceChecksumAttested:false,
    migrationHistoryAvailable:metadataAvailable,
    appliedMigrations:applied,
    latestMigration:[...applied].sort().at(-1)||null,
    missingTables,
    features,
    checkedAt:new Date().toISOString(),
  };
}

const delegateName=(table)=>table.charAt(0).toLowerCase()+table.slice(1);
async function probeTables(db){
  const present=new Set();
  for(const table of VSN_HEALTH_TABLES){
    try{
      const delegate=db?.[delegateName(table)];
      if(typeof delegate?.count!=="function")continue;
      await delegate.count({take:1});
      present.add(table);
    }catch{ /* table unreachable */ }
  }
  return present;
}

export async function ensureFeatureSchema(db,feature){
  const health=await getRuntimeSchemaHealth(db);
  if(!health.features?.[feature]?.ready)throw new VsnSchemaNotReadyError(feature,health);
  return health;
}

export function isMissingDatabaseTableError(error){
  return Boolean(error&&(error.code==="P2021"||/table .* does not exist|relation .* does not exist|no such table/i.test(String(error.message||""))));
}

export function schemaRecoveryMessage(error,feature="this feature"){
  const missing=error?.health?.features?.[error?.feature]?.missingTables||[];
  const suffix=missing.length?` Missing table${missing.length===1?"":"s"}: ${missing.join(", ")}.`:"";
  return `${feature} is temporarily unavailable because the hosted database schema has not passed its readiness check.${suffix} Contact VSN support if this continues.`;
}
