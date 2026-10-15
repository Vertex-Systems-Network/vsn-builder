// T020 CI-only Workerd-safe schema inspection for the actual Builder route graph.
// PostgreSQL/Neon read-only introspection, never the Node SQLite PRAGMA path.
// A healthy table inventory ALONE is not an approved migration checksum.
// Hosted rollout requires independent protected migration attestation.
import {
  VSN_FEATURE_TABLES, VSN_HEALTH_TABLES,
} from "../app/services/database-feature-contract.js";
export { VSN_FEATURE_TABLES } from "../app/services/database-feature-contract.js";
export const VSN_EXPECTED_MIGRATION = "20260808234540_milestone_n1_email_builder";

const errorText = "Hosted Neon schema and checksum have not been verified";
const names = Object.freeze([...VSN_HEALTH_TABLES]);
const serializeDate = () => new Date().toISOString();

export async function getRuntimeSchemaHealth(db) {
  let found = new Set(), applied = [], latest = null;
  let tableQuerySucceeded = false, migrationHistoryAvailable = false;
  try {
    // Fixed query, no SQL assembled from untrusted shop/user parameters.
    const rows = await db.$queryRaw`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`;
    found = new Set((Array.isArray(rows) ? rows : [])
      .map(row=>String(row?.name || "")).filter(Boolean));
    tableQuerySucceeded = true;
  } catch { /* fail closed; never expose a Neon error or URL */ }
  try {
    const rows = await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at ASC`;
    applied = (Array.isArray(rows) ? rows : [])
      .filter(row=>row?.finished_at && !row?.rolled_back_at)
      .map(row=>String(row.migration_name));
    latest = [...applied].sort().at(-1) || null;
    migrationHistoryAvailable = true;
  } catch { /* fail closed */ }
  const missingTables = names.filter(table=>!found.has(table));
  const features = Object.fromEntries(Object.entries(VSN_FEATURE_TABLES)
    .map(([feature,tables])=>{
      const missing = tables.filter(table=>!found.has(table));
      return [feature,{
        ready:false,
        requiredTables:tables,
        missingTables:missing,
      }];
    }));
  return {
    // No independently authenticated migration checksum or Worker request
    // context is available in this isolated compatibility build.
    ready:false,
    databaseError:tableQuerySucceeded?errorText:"Neon schema introspection unavailable",
    databaseFile:null,
    expectedDatabaseFile:null,
    databaseTargetMatches:false,
    expectedMigration:VSN_EXPECTED_MIGRATION,
    expectedMigrationChecksum:null,
    expectedMigrationApplied:applied.includes(VSN_EXPECTED_MIGRATION),
    expectedMigrationChecksumMatches:false,
    migrationHistoryAvailable,
    appliedMigrations:applied,
    latestMigration:latest,
    missingTables,
    features,
    checkedAt:serializeDate(),
  };
}
export class VsnSchemaNotReadyError extends Error {
  constructor(feature,health) {
    super("Neon schema is not attested for "+String(feature||"requested feature"));
    this.name="VsnSchemaNotReadyError";
    this.code="VSN_SCHEMA_NOT_READY";
    this.feature=feature;
    this.health=health;
  }
}
export async function ensureFeatureSchema(db,feature) {
  const health=await getRuntimeSchemaHealth(db);
  throw new VsnSchemaNotReadyError(feature,health);
}
export function isMissingDatabaseTableError(error) {
  return Boolean(error &&
    (error.code==="P2021"||error.code==="42P01"||
      /relation .* does not exist/i.test(String(error.message||""))));
}
export function schemaRecoveryMessage() {
  return "Hosted Neon database requires reviewed migration attestation before enabling merchant features.";
}
