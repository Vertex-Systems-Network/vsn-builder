import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveVsnDatabaseLocation } from "../utils/database-location.server.js";
export const VSN_EXPECTED_MIGRATION = "20260808234540_milestone_n1_email_builder";

function expectedMigrationChecksum() {
  try {
    const file = path.resolve(process.cwd(), "prisma", "migrations", VSN_EXPECTED_MIGRATION, "migration.sql");
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return null;
  }
}

export const VSN_FEATURE_TABLES = Object.freeze({
  core: ["Session", "BuilderPage", "BuilderShopSetting"],
  developerStudio: ["BuilderGraphqlSavedQuery", "BuilderGraphqlHistory", "BuilderGlobalCode", "BuilderGlobalCodeRevision"],
  wishlist: ["BuilderWishlist"],
  emailBuilder: ["BuilderEmailTemplate"],
  motion: ["BuilderMotionPreset"],
  widgetPlatform: ["BuilderWidgetTemplate", "BuilderCustomWidget"],
});

const HEALTH_TABLES = Object.freeze([...new Set(Object.values(VSN_FEATURE_TABLES).flat())]);
const CACHE_TTL_MS = 15_000;
let cached = null;

function quoteSqliteString(value) {
  return `'${String(value || "").replaceAll("'", "''")}'`;
}

async function existingTableNames(db, names = HEALTH_TABLES) {
  const wanted = [...new Set(names.map(String).filter(Boolean))];
  if (!wanted.length) return new Set();
  const list = wanted.map(quoteSqliteString).join(",");
  const rows = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${list})`);
  return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.name || "")).filter(Boolean));
}

async function sqliteDatabaseLocation(db) {
  try {
    const rows = await db.$queryRawUnsafe("PRAGMA database_list");
    const main = (Array.isArray(rows) ? rows : []).find((row) => String(row?.name || "") === "main");
    return { available: true, file: String(main?.file || "") || null };
  } catch (error) {
    return { available: false, file: null, error: error instanceof Error ? error.message : "Database file location unavailable." };
  }
}

function normalizedFile(value) {
  if (!value) return null;
  try { return path.normalize(String(value)).toLowerCase(); } catch { return String(value).toLowerCase(); }
}

async function migrationHistory(db) {
  try {
    const rows = await db.$queryRawUnsafe('SELECT migration_name, checksum, CAST(finished_at AS TEXT) AS finished_at, CAST(rolled_back_at AS TEXT) AS rolled_back_at FROM "_prisma_migrations" ORDER BY started_at ASC');
    const appliedRows = (Array.isArray(rows) ? rows : []).filter((row) => row?.finished_at && !row?.rolled_back_at);
    const applied = appliedRows.map((row) => String(row.migration_name));
    return { available: true, rows: Array.isArray(rows) ? rows : [], appliedRows, applied, latest: [...applied].sort().at(-1) || null };
  } catch (error) {
    return { available: false, rows: [], appliedRows: [], applied: [], latest: null, error: error instanceof Error ? error.message : "Migration history unavailable." };
  }
}

export async function getRuntimeSchemaHealth(db, { fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  let tables = new Set();
  let databaseError = null;
  try { tables = await existingTableNames(db, HEALTH_TABLES); }
  catch (error) { databaseError = error instanceof Error ? error.message : "Database schema inspection failed."; }
  const migrations = await migrationHistory(db);
  const database = await sqliteDatabaseLocation(db);
  const expectedDatabase = resolveVsnDatabaseLocation(process.env);
  const databaseTargetMatches = !expectedDatabase.file || !database.file
    ? true
    : normalizedFile(database.file) === normalizedFile(expectedDatabase.file);
  const missingTables = HEALTH_TABLES.filter((name) => !tables.has(name));
  const features = Object.fromEntries(Object.entries(VSN_FEATURE_TABLES).map(([key, names]) => {
    const missing = names.filter((name) => !tables.has(name));
    return [key, { ready: missing.length === 0, requiredTables: names, missingTables: missing }];
  }));
  const expectedChecksum = expectedMigrationChecksum();
  const expectedAppliedRows = (migrations.appliedRows || []).filter((row) => String(row?.migration_name || "") === VSN_EXPECTED_MIGRATION);
  const expectedMigrationApplied = expectedAppliedRows.length > 0;
  const expectedMigrationChecksumMatches = !expectedChecksum
    ? expectedMigrationApplied
    : expectedAppliedRows.some((row) => String(row?.checksum || "") === expectedChecksum);
  const value = {
    ready: !databaseError && databaseTargetMatches && missingTables.length === 0 && expectedMigrationApplied && expectedMigrationChecksumMatches,
    databaseError,
    databaseFile: database.file,
    expectedDatabaseFile: expectedDatabase.file,
    databaseTargetMatches,
    expectedMigration: VSN_EXPECTED_MIGRATION,
    expectedMigrationChecksum: expectedChecksum,
    expectedMigrationApplied,
    expectedMigrationChecksumMatches,
    migrationHistoryAvailable: migrations.available,
    appliedMigrations: migrations.applied,
    latestMigration: migrations.latest,
    missingTables,
    features,
    checkedAt: new Date().toISOString(),
  };
  cached = { at: Date.now(), value };
  return value;
}

export class VsnSchemaNotReadyError extends Error {
  constructor(feature, health) {
    const missing = health?.features?.[feature]?.missingTables || health?.missingTables || [];
    super(`Database schema is not ready for ${feature}. Missing: ${missing.join(", ") || "required migration"}.`);
    this.name = "VsnSchemaNotReadyError";
    this.code = "VSN_SCHEMA_NOT_READY";
    this.feature = feature;
    this.health = health;
  }
}

export async function ensureFeatureSchema(db, feature) {
  const required = VSN_FEATURE_TABLES[feature];
  if (!required) return getRuntimeSchemaHealth(db);
  const health = await getRuntimeSchemaHealth(db, { fresh: true });
  if (!health.features?.[feature]?.ready) throw new VsnSchemaNotReadyError(feature, health);
  return health;
}

export function isMissingDatabaseTableError(error) {
  return Boolean(error && (error.code === "P2021" || /table .* does not exist|no such table/i.test(String(error.message || ""))));
}

export function schemaRecoveryMessage(error, feature = "this feature") {
  const missing = error?.health?.features?.[error?.feature]?.missingTables || [];
  const suffix = missing.length ? ` Missing table${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` : "";
  return `${feature} needs the packaged database migrations before it can run.${suffix} Run npm run setup (or npm run db:prepare), then restart npm run dev.`;
}
