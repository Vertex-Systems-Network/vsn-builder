import db from "../app/db.server.js";
import { runPrisma } from "./lib/prisma-process.mjs";
import {
  markFailedRowsRolledBackDirect,
  readMigrationRows,
  migrationRowState,
  recordMigrationAppliedDirect,
  normalizeAppliedMigrationTimestampsDirect,
  verifyAppliedMigrationRow,
} from "./lib/prisma-migration-history.mjs";

const MIGRATION = "20260808234540_milestone_n1_email_builder";
const TABLE = "BuilderEmailTemplate";
const REQUIRED_COLUMNS = [
  "id", "shop", "name", "category", "subject", "preheader", "documentJson",
  "compiledHtml", "plainText", "status", "createdAt", "updatedAt", "deletedAt",
];
const REQUIRED_INDEXES = [
  "BuilderEmailTemplate_shop_deletedAt_updatedAt_idx",
  "BuilderEmailTemplate_shop_category_status_idx",
];
const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg ? phaseArg.slice("--phase=".length) : "post";

function fail(message) {
  console.error(`VSN Email migration reconciliation FAILED.\n- ${message}`);
  console.error("- No database reset/delete was performed.");
  process.exitCode = 1;
}

async function tableExists() {
  const rows = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", TABLE);
  return Array.isArray(rows) && rows.length > 0;
}

async function columnNames() {
  const rows = await db.$queryRawUnsafe(`PRAGMA table_info("${TABLE}")`);
  return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.name || "")));
}

async function indexNames() {
  const rows = await db.$queryRawUnsafe(`PRAGMA index_list("${TABLE}")`);
  return new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.name || "")));
}

async function databaseFile() {
  try {
    const rows = await db.$queryRawUnsafe("PRAGMA database_list");
    const main = (Array.isArray(rows) ? rows : []).find((row) => String(row?.name || "") === "main");
    return String(main?.file || "unknown");
  } catch {
    return "unknown";
  }
}

async function ensureIndexes() {
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BuilderEmailTemplate_shop_deletedAt_updatedAt_idx" ON "BuilderEmailTemplate"("shop", "deletedAt", "updatedAt")',
  );
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BuilderEmailTemplate_shop_category_status_idx" ON "BuilderEmailTemplate"("shop", "category", "status")',
  );
}

async function createEmailTable() {
  await db.$executeRawUnsafe(`CREATE TABLE "${TABLE}" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Custom',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "documentJson" TEXT NOT NULL,
    "compiledHtml" TEXT NOT NULL,
    "plainText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
  )`);
  await ensureIndexes();
}

async function verifyCompleteEmailSchema() {
  if (!(await tableExists())) return { ready: false, missingColumns: REQUIRED_COLUMNS, missingIndexes: REQUIRED_INDEXES };
  const columns = await columnNames();
  const missingColumns = REQUIRED_COLUMNS.filter((name) => !columns.has(name));
  if (missingColumns.length) return { ready: false, missingColumns, missingIndexes: [] };
  await ensureIndexes();
  const indexes = await indexNames();
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !indexes.has(name));
  return { ready: missingIndexes.length === 0, missingColumns, missingIndexes };
}

async function printHistory(label) {
  const verification = await verifyAppliedMigrationRow(db, MIGRATION);
  console.log(`- migration rows (${label}): ${verification.rows.length}`);
  for (const row of verification.rows) {
    const state = row?.finished_at && !row?.rolled_back_at ? "applied" : row?.rolled_back_at ? "rolled-back" : "failed";
    const checksum = String(row?.checksum || "");
    console.log(`  · ${state} · id=${String(row?.id || "unknown")} · checksum=${checksum.slice(0, 12)}${checksum ? "…" : ""}`);
  }
  return verification;
}

async function ensureAppliedHistory(reason) {
  let verification = await verifyAppliedMigrationRow(db, MIGRATION);
  if (verification.ready) {
    const normalized = await normalizeAppliedMigrationTimestampsDirect(db, MIGRATION);
    if (normalized) {
      console.log(`VSN Email migration reconciliation: normalized ${normalized} legacy migration-history timestamp row(s) to Prisma SQLite format.`);
      verification = await verifyAppliedMigrationRow(db, MIGRATION);
    }
    return verification;
  }

  // Never paper over a changed migration. If an applied row exists with a
  // different checksum, the migration history itself has drifted and requires
  // explicit developer review.
  if (verification.applied.length && !verification.matching) {
    throw new Error(
      `${MIGRATION} has an applied history row whose checksum does not match the packaged migration.sql. ` +
      `Expected ${verification.expectedChecksum}. Refusing to rewrite an applied migration record.`,
    );
  }

  console.log(`VSN Email migration reconciliation: ${reason}; asking Prisma to record ${MIGRATION} as applied.`);
  await db.$disconnect();
  runPrisma(["migrate", "resolve", "--applied", MIGRATION]);

  // Prisma migrate resolve is the preferred path, but verify its postcondition.
  // Some unsupported/current Node runtimes have returned success without the
  // expected history row. A verified additive schema can be safely baselined
  // deterministically in _prisma_migrations using Prisma's own checksum format.
  verification = await verifyAppliedMigrationRow(db, MIGRATION);
  if (verification.ready) {
    console.log("VSN Email migration reconciliation: Prisma recorded the applied migration successfully.");
    return verification;
  }

  if (verification.applied.length && !verification.matching) {
    throw new Error(`${MIGRATION} was recorded with an unexpected checksum after prisma migrate resolve.`);
  }

  const rolled = await markFailedRowsRolledBackDirect(
    db,
    MIGRATION,
    "VSN rolled back stale failed Email Builder history after complete schema verification",
  );
  if (rolled) console.log(`VSN Email migration reconciliation: marked ${rolled} stale failed history row(s) rolled back.`);

  const direct = await recordMigrationAppliedDirect(db, MIGRATION, {
    reason: "VSN deterministic baseline: complete Email Builder schema verified after prisma migrate resolve produced no applied row",
  });
  console.log(
    `VSN Email migration reconciliation: deterministic history baseline ${direct.inserted ? "inserted" : "already present"}${direct.normalized ? ` · normalized ${direct.normalized} timestamp row(s)` : ""} · checksum ${direct.checksum}.`,
  );

  verification = await verifyAppliedMigrationRow(db, MIGRATION);
  if (!verification.ready) {
    throw new Error(`${MIGRATION} still has no valid applied history row after deterministic baseline repair.`);
  }
  return verification;
}

async function ensureFailedHistoryRolledBack(reason) {
  let rows = await readMigrationRows(db, MIGRATION);
  let state = migrationRowState(rows);
  if (!state.failed.length) return;

  console.log(`VSN Email migration reconciliation: ${reason}; asking Prisma to mark the failed migration rolled back.`);
  await db.$disconnect();
  runPrisma(["migrate", "resolve", "--rolled-back", MIGRATION]);

  rows = await readMigrationRows(db, MIGRATION);
  state = migrationRowState(rows);
  if (!state.failed.length) return;

  const count = await markFailedRowsRolledBackDirect(
    db,
    MIGRATION,
    "VSN deterministic rollback marker after prisma migrate resolve left failed row unresolved",
  );
  console.log(`VSN Email migration reconciliation: deterministic rollback marked ${count} failed row(s) rolled back.`);

  rows = await readMigrationRows(db, MIGRATION);
  state = migrationRowState(rows);
  if (state.failed.length) throw new Error(`${MIGRATION} still contains unresolved failed migration history rows.`);
}

try {
  const file = await databaseFile();
  const initialRows = await readMigrationRows(db, MIGRATION);
  const initialState = migrationRowState(initialRows);
  const applied = initialState.applied.length > 0;
  const failed = initialState.failed.length > 0;
  const exists = await tableExists();

  console.log(`VSN Email migration reconciliation (${phase}) · DB ${file}`);
  console.log(`- history: ${applied ? "applied" : failed ? "failed" : initialRows.length ? "rolled-back" : "missing"}`);
  console.log(`- ${TABLE}: ${exists ? "present" : "missing"}`);
  await printHistory("before");

  if (exists) {
    const schema = await verifyCompleteEmailSchema();
    if (!schema.ready) {
      const details = [
        schema.missingColumns.length ? `missing columns: ${schema.missingColumns.join(", ")}` : "",
        schema.missingIndexes.length ? `missing indexes: ${schema.missingIndexes.join(", ")}` : "",
      ].filter(Boolean).join("; ");
      fail(`${TABLE} exists but is partial (${details}). Refusing destructive auto-repair.`);
    } else {
      await ensureAppliedHistory("the complete Email Builder schema exists but migration history is missing/incomplete");
      await printHistory("after");
      console.log("VSN Email migration reconciliation: physical schema and checksum-verified migration history agree.");
    }
  } else if (phase === "pre") {
    if (failed) await ensureFailedHistoryRolledBack("a failed Email Builder migration record exists and the table was not created");
    else if (applied) {
      console.log("VSN Email migration reconciliation: migration history says applied but table is missing; recreating this additive table without touching other data.");
      await createEmailTable();
    } else {
      console.log("VSN Email migration reconciliation: migration is pending; Prisma migrate deploy will apply it.");
    }
  } else {
    console.log("VSN Email migration reconciliation: deploy finished but Email Builder schema is still missing; applying the known additive N.1 schema directly.");
    await createEmailTable();
    await ensureAppliedHistory("the additive N.1 schema was restored after deploy");
    await printHistory("after fallback");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error || "Unknown reconciliation error"));
} finally {
  try { await db.$disconnect(); } catch {}
}

if (process.exitCode) process.exit(process.exitCode);
