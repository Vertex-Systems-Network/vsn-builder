import { VSN_FEATURE_TABLES, VSN_HEALTH_TABLES } from "./database-feature-contract.js";

// This module has no node: imports and no SQLite or cloud credentials.
// Runtime must inject a validated PostgreSQL Prisma Client; this module
// intentionally does not create a connection or apply migrations.
const rows = (value) => Array.isArray(value) ? value : [];
const issue = (name) => "PostgreSQL " + name + " unavailable";

export async function inspectPostgresSchemaHealth(db, config = {}) {
  const expectedDatabaseName = String(config.expectedDatabaseName || "").trim();
  const expectedSchemaName = String(config.expectedSchemaName || "public").trim();
  const expectedMigrationName = String(config.expectedMigrationName || "").trim();
  const expectedMigrationChecksum = String(config.expectedMigrationChecksum || "").trim().toLowerCase();
  const problems = [];
  if (!db || typeof db.$queryRaw !== "function") {
    return { ready: false, problems: ["PostgreSQL Prisma Client not configured"], missingTables: VSN_HEALTH_TABLES.slice() };
  }
  if (!expectedDatabaseName) problems.push("Expected database identity is missing");
  if (!expectedSchemaName) problems.push("Expected schema identity is missing");
  if (!expectedMigrationName) problems.push("Expected PostgreSQL baseline migration is missing");
  if (!/^[a-f0-9]{64}$/.test(expectedMigrationChecksum)) problems.push("Expected baseline checksum is missing or invalid");

  let identity = null;
  try {
    // Literal tagged queries: no interpolated identifiers or user values.
    const result = rows(await db.$queryRaw`SELECT current_database() AS "databaseName", current_schema() AS "schemaName"`);
    identity = result[0] || null;
  } catch {
    problems.push(issue("database identity"));
  }
  if (!identity) {
    if (!problems.includes(issue("database identity"))) problems.push(issue("database identity"));
  } else {
    if (String(identity.databaseName || "") !== expectedDatabaseName) problems.push("Database identity mismatch");
    if (String(identity.schemaName || "") !== expectedSchemaName) problems.push("Database schema mismatch");
  }

  let present = new Set();
  try {
    const result = rows(await db.$queryRaw`SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`);
    present = new Set(result.map((r) => String(r?.tableName || "")));
  } catch {
    problems.push(issue("table inspection"));
  }
  const missingTables = VSN_HEALTH_TABLES.filter((name) => !present.has(name));
  if (missingTables.length) problems.push("Required PostgreSQL tables missing");

  let migrationApplied = false;
  let migrationChecksumMatches = false;
  try {
    const result = rows(await db.$queryRaw`SELECT migration_name AS "migrationName", checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt" FROM "_prisma_migrations"`);
    const applied = result.filter((m) => String(m?.migrationName || "") === expectedMigrationName && m?.finishedAt && !m?.rolledBackAt);
    migrationApplied = applied.length > 0;
    migrationChecksumMatches = applied.some((m) => String(m?.checksum || "").toLowerCase() === expectedMigrationChecksum);
  } catch {
    problems.push(issue("migration ledger"));
  }
  if (!migrationApplied) problems.push("PostgreSQL baseline migration not applied");
  if (!migrationChecksumMatches) problems.push("PostgreSQL migration checksum mismatch");

  const features = Object.fromEntries(Object.entries(VSN_FEATURE_TABLES).map(([name, requiredTables]) => [
    name,
    { ready: requiredTables.every((table) => present.has(table)),
      missingTables: requiredTables.filter((table) => !present.has(table)) },
  ]));
  return {
    ready: problems.length === 0,
    problems,
    databaseNameMatches: Boolean(identity && identity.databaseName === expectedDatabaseName),
    schemaNameMatches: Boolean(identity && identity.schemaName === expectedSchemaName),
    migrationApplied,
    migrationChecksumMatches,
    missingTables,
    features,
  };
}
