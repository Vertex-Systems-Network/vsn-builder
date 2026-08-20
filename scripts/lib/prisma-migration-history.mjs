import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function migrationSqlPath(migrationName, { cwd = process.cwd() } = {}) {
  return path.join(path.resolve(cwd), "prisma", "migrations", migrationName, "migration.sql");
}

export function migrationChecksum(migrationName, options = {}) {
  const file = migrationSqlPath(migrationName, options);
  if (!fs.existsSync(file)) throw new Error(`Migration SQL not found: ${file}`);
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function migrationHistoryReadError(error, migrationName) {
  const message = error instanceof Error ? error.message : String(error || "Unknown SQLite migration-history error");
  if (/no such table.*_prisma_migrations|table .*_prisma_migrations.*does not exist/i.test(message)) return null;
  return new Error(`Unable to read Prisma migration history for ${migrationName}: ${message}`);
}

export async function readMigrationRows(db, migrationName) {
  try {
    // CAST Prisma DATETIME columns to TEXT deliberately. Some SQLite rows created
    // by older/manual baseline repair paths use SQLite CURRENT_TIMESTAMP text,
    // which Prisma raw-query DateTime deserialization can reject even though the
    // row is physically valid. Migration state only needs null/non-null + ordering,
    // so text is both safer and sufficient.
    const rows = await db.$queryRawUnsafe(
      'SELECT id, checksum, migration_name, CAST(finished_at AS TEXT) AS finished_at, CAST(rolled_back_at AS TEXT) AS rolled_back_at, CAST(started_at AS TEXT) AS started_at, applied_steps_count, logs FROM "_prisma_migrations" WHERE migration_name = ? ORDER BY started_at ASC',
      migrationName,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    const wrapped = migrationHistoryReadError(error, migrationName);
    if (!wrapped) return [];
    throw wrapped;
  }
}

export function migrationRowState(rows = []) {
  const applied = rows.filter((row) => row?.finished_at && !row?.rolled_back_at);
  const failed = rows.filter((row) => !row?.finished_at && !row?.rolled_back_at);
  const rolledBack = rows.filter((row) => row?.rolled_back_at);
  return { applied, failed, rolledBack };
}

function prismaMigrationTimestamp(date = new Date()) {
  // Match the timestamp shape Prisma writes into SQLite _prisma_migrations:
  // YYYY-MM-DD HH:mm:ss.SSS000 UTC
  return date.toISOString().replace("T", " ").replace("Z", "000 UTC");
}

function isPrismaMigrationTimestamp(value) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6} UTC$/.test(String(value || ""));
}

export async function normalizeAppliedMigrationTimestampsDirect(db, migrationName) {
  const rows = await readMigrationRows(db, migrationName);
  const { applied } = migrationRowState(rows);
  let normalized = 0;
  for (const row of applied) {
    if (isPrismaMigrationTimestamp(row?.started_at) && isPrismaMigrationTimestamp(row?.finished_at)) continue;
    const timestamp = prismaMigrationTimestamp();
    await db.$executeRawUnsafe(
      'UPDATE "_prisma_migrations" SET started_at = ?, finished_at = ? WHERE id = ? AND finished_at IS NOT NULL AND rolled_back_at IS NULL',
      timestamp,
      timestamp,
      String(row.id),
    );
    normalized += 1;
  }
  return normalized;
}

export async function markFailedRowsRolledBackDirect(db, migrationName, reason = "VSN deterministic migration-history repair") {
  const rows = await readMigrationRows(db, migrationName);
  const { failed } = migrationRowState(rows);
  const timestamp = prismaMigrationTimestamp();
  for (const row of failed) {
    await db.$executeRawUnsafe(
      'UPDATE "_prisma_migrations" SET rolled_back_at = ?, logs = COALESCE(logs, ?) WHERE id = ? AND finished_at IS NULL AND rolled_back_at IS NULL',
      timestamp,
      reason,
      String(row.id),
    );
  }
  return failed.length;
}

export async function recordMigrationAppliedDirect(db, migrationName, {
  cwd = process.cwd(),
  reason = "VSN deterministic migration-history baseline after physical schema verification",
} = {}) {
  const rows = await readMigrationRows(db, migrationName);
  const { applied } = migrationRowState(rows);
  if (applied.length) {
    const normalized = await normalizeAppliedMigrationTimestampsDirect(db, migrationName);
    return { inserted: false, normalized, checksum: String(applied.at(-1)?.checksum || "") };
  }

  const checksum = migrationChecksum(migrationName, { cwd });
  const timestamp = prismaMigrationTimestamp();
  await db.$executeRawUnsafe(
    'INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES (?, ?, ?, ?, ?, NULL, ?, 1)',
    crypto.randomUUID(),
    checksum,
    timestamp,
    migrationName,
    reason,
    timestamp,
  );
  return { inserted: true, normalized: 0, checksum };
}

export async function verifyAppliedMigrationRow(db, migrationName, { cwd = process.cwd() } = {}) {
  const rows = await readMigrationRows(db, migrationName);
  const { applied, failed, rolledBack } = migrationRowState(rows);
  const expectedChecksum = migrationChecksum(migrationName, { cwd });
  const matching = applied.find((row) => String(row?.checksum || "") === expectedChecksum) || null;
  return {
    rows,
    applied,
    failed,
    rolledBack,
    matching,
    expectedChecksum,
    ready: Boolean(matching),
  };
}
