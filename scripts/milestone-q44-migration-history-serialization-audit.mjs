import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolveScriptDatabaseLocation } from "./lib/database-location.mjs";
import {
  migrationChecksum,
  readMigrationRows,
  recordMigrationAppliedDirect,
  normalizeAppliedMigrationTimestampsDirect,
  verifyAppliedMigrationRow,
} from "./lib/prisma-migration-history.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
let total = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  total += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const baseline = JSON.parse(read("BASELINE.json"));
const runtime = read("app/config/baseline.js");
const helper = read("scripts/lib/prisma-migration-history.mjs");
const reconcile = read("scripts/reconcile-email-builder-migration.mjs");
const health = read("app/services/database-health.server.js");
const migration = "20260808234540_milestone_n1_email_builder";
const expectedChecksum = crypto.createHash("sha256").update(fs.readFileSync(`prisma/migrations/${migration}/migration.sql`)).digest("hex");
const databaseLocation = resolveScriptDatabaseLocation({ cwd: process.cwd(), env: process.env });
const databaseFile = databaseLocation.file;

check("Q4.4 serialization contract retained on current Q4 baseline", lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && baseline.version === pkg.version && String(baseline.milestone || "").startsWith("Q.") && runtime.includes(`version: "${pkg.version}"`) && runtime.includes("migrationHistorySerialization: 1"));
check("Migration-history timestamps are cast to text", helper.includes("CAST(finished_at AS TEXT)") && helper.includes("CAST(rolled_back_at AS TEXT)") && helper.includes("CAST(started_at AS TEXT)"));
check("Migration-history errors are not silently swallowed", helper.includes("Unable to read Prisma migration history") && helper.includes("throw wrapped"));
check("Missing migration table remains safe empty-history case", helper.includes("no such table.*_prisma_migrations") && helper.includes("return []"));
check("Direct applied rows use explicit Prisma timestamp parameters", helper.includes("prismaMigrationTimestamp") && helper.includes("YYYY-MM-DD HH:mm:ss.SSS000 UTC") && !helper.includes('VALUES (?, ?, CURRENT_TIMESTAMP'));
check("Rollback markers use Prisma timestamp parameters", helper.includes('SET rolled_back_at = ?'));
check("Legacy timestamp normalization exists", helper.includes("normalizeAppliedMigrationTimestampsDirect") && reconcile.includes("normalized ${normalized} legacy migration-history timestamp row"));
check("Runtime database health casts migration dates to text", health.includes("CAST(finished_at AS TEXT)") && health.includes("CAST(rolled_back_at AS TEXT)"));
check("No destructive DB reset path", !helper.includes("unlinkSync") && !helper.includes("rmSync") && !reconcile.includes("DROP TABLE"));
check("Q4.4 docs packaged", fs.existsSync("MILESTONE_Q44_DEVELOPER_MODE.md") && fs.existsSync("VSN_MILESTONE_Q44_MIGRATION_HISTORY_SERIALIZATION_REPORT_v2.5.88.md"));
check("Q4.4 audit resolves SQLite target", Boolean(databaseFile), databaseLocation.url);

if (!databaseFile) throw new Error("Milestone Q4.4 audit requires a SQLite DATABASE_URL so migration history serialization can be verified locally.");
const fixture = path.join(os.tmpdir(), `vsn-q44-${process.pid}.sqlite`);
fs.copyFileSync(databaseFile, fixture);
const fixtureDb = new DatabaseSync(fixture);
fixtureDb.prepare('DELETE FROM "_prisma_migrations" WHERE migration_name = ?').run(migration);
fixtureDb.prepare('INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, NULL, CURRENT_TIMESTAMP, 1)').run(
  "q44-legacy-current-timestamp",
  expectedChecksum,
  migration,
  "Q4.4 reproduces v2.5.87 SQLite CURRENT_TIMESTAMP baseline",
);
const adapter = {
  async $queryRawUnsafe(query, ...params) { return fixtureDb.prepare(query).all(...params); },
  async $executeRawUnsafe(query, ...params) { return fixtureDb.prepare(query).run(...params).changes; },
};

const legacyBefore = await verifyAppliedMigrationRow(adapter, migration, { cwd: process.cwd() });
check("Legacy CURRENT_TIMESTAMP row is visible", legacyBefore.ready === true && legacyBefore.rows.length === 1, legacyBefore.rows[0]?.finished_at || "missing");
const normalizedCount = await normalizeAppliedMigrationTimestampsDirect(adapter, migration);
const legacyAfter = await verifyAppliedMigrationRow(adapter, migration, { cwd: process.cwd() });
check("Legacy history timestamp normalizes", normalizedCount === 1 && /\.\d{6} UTC$/.test(String(legacyAfter.matching?.finished_at || "")), legacyAfter.matching?.finished_at || "missing");

fixtureDb.prepare('DELETE FROM "_prisma_migrations" WHERE migration_name = ?').run(migration);
const inserted = await recordMigrationAppliedDirect(adapter, migration, { cwd: process.cwd(), reason: "Q4.4 fresh fixture" });
const directAfter = await verifyAppliedMigrationRow(adapter, migration, { cwd: process.cwd() });
check("Fresh deterministic row inserts", inserted.inserted === true);
check("Fresh deterministic row checksum verifies", directAfter.ready === true && String(directAfter.matching?.checksum || "") === migrationChecksum(migration));
check("Fresh deterministic row has Prisma timestamp shape", /\.\d{6} UTC$/.test(String(directAfter.matching?.finished_at || "")) && /\.\d{6} UTC$/.test(String(directAfter.matching?.started_at || "")));

let surfaced = false;
try {
  await readMigrationRows({ async $queryRawUnsafe() { throw new Error("synthetic driver parse failure"); } }, migration);
} catch (error) {
  surfaced = /synthetic driver parse failure/.test(String(error?.message || ""));
}
check("Non-table migration-history read errors surface", surfaced === true);

fixtureDb.close();
fs.rmSync(fixture, { force: true });

console.log(`\nMilestone Q.4.4 migration-history serialization audit: ${total - failed}/${total} PASS`);
if (failed) process.exit(1);
