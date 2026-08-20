import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getNodeRuntimeCompatibility } from "./lib/runtime-compat.mjs";
import { recordMigrationAppliedDirect, verifyAppliedMigrationRow } from "./lib/prisma-migration-history.mjs";

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
const runtimeBaseline = read("app/config/baseline.js");
const prepare = read("scripts/prepare-database.mjs");
const reconcile = read("scripts/reconcile-email-builder-migration.mjs");
const historyHelper = read("scripts/lib/prisma-migration-history.mjs");
const runtimeCompat = read("scripts/lib/runtime-compat.mjs");
const schemaHealth = read("app/services/database-health.server.js");
const schemaCheck = read("scripts/database-schema-check.mjs");
const migrationName = "20260808234540_milestone_n1_email_builder";
const migrationSql = fs.readFileSync(`prisma/migrations/${migrationName}/migration.sql`);
const expectedChecksum = crypto.createHash("sha256").update(migrationSql).digest("hex");

check("Q4.3+ version lineage", baseline.version === pkg.version && runtimeBaseline.includes(`version: "${pkg.version}"`) && runtimeBaseline.includes('milestone: "Q.'));
check("Node engines pin 22.18 LTS line", String(pkg.engines?.node || "") === ">=22.18 <23");
check("Lockfile runtime contract matches", lock.packages?.[""]?.version === pkg.version && String(lock.packages?.[""]?.engines?.node || "") === ">=22.18 <23");
check("Node 22.18 runtime accepted", getNodeRuntimeCompatibility("22.18.0").supported === true);
check("Node 22.16 runtime rejected by dependency floor", getNodeRuntimeCompatibility("22.16.0").supported === false);
check("Node 20 runtime rejected by project contract", getNodeRuntimeCompatibility("20.19.0").supported === false);
check("Node 25 runtime rejected", getNodeRuntimeCompatibility("25.0.0").supported === false);
check("Runtime verify command packaged", String(pkg.scripts?.["runtime:verify"] || "").includes("runtime-compat-check.mjs"));
check("db:prepare asserts supported runtime", prepare.includes("assertSupportedNodeRuntime") && prepare.includes("Node runtime:"));
check("Migration checksum uses SHA-256", historyHelper.includes('createHash("sha256")') && historyHelper.includes("migration.sql"));
check("Direct applied history record uses UUID", historyHelper.includes("crypto.randomUUID()") && historyHelper.includes('INSERT INTO "_prisma_migrations"'));
check("Direct history record sets one applied step", historyHelper.includes("applied_steps_count") && historyHelper.includes("?, 1)"));
check("Failed history direct rollback is bounded", historyHelper.includes('finished_at IS NULL AND rolled_back_at IS NULL') && historyHelper.includes("markFailedRowsRolledBackDirect"));
check("Reconciler verifies prisma resolve postcondition", reconcile.includes("verifyAppliedMigrationRow") && reconcile.includes("Prisma recorded the applied migration successfully"));
check("Reconciler has deterministic baseline fallback", reconcile.includes("recordMigrationAppliedDirect") && reconcile.includes("deterministic history baseline"));
check("Applied checksum drift is refused", reconcile.includes("checksum does not match the packaged migration.sql") && reconcile.includes("Refusing to rewrite an applied migration record"));
check("Reconciler prints migration rows before/after", reconcile.includes('printHistory("before")') && reconcile.includes('printHistory("after")'));
check("Runtime schema health verifies checksum", schemaHealth.includes("expectedMigrationChecksumMatches") && schemaHealth.includes("expectedMigrationChecksum"));
check("Schema check prints history details", schemaCheck.includes("Matching migration rows:") && schemaCheck.includes("checksum="));
check("Database diagnostics command packaged", String(pkg.scripts?.["db:diagnose"] || "").includes("database-diagnose.mjs") && fs.existsSync("scripts/database-diagnose.mjs"));
check("No reset/delete in migration fallback", !historyHelper.includes("unlinkSync") && !historyHelper.includes("rmSync") && !reconcile.includes("DROP TABLE"));

const database = new DatabaseSync("prisma/dev.sqlite", { readOnly: true });
const row = database.prepare('SELECT checksum, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" WHERE migration_name = ? AND finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1').get(migrationName);
const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='BuilderEmailTemplate'").get();
database.close();
check("Packaged Email table exists", Boolean(table?.name));
check("Packaged migration row exists", Boolean(row?.finished_at));
check("Packaged migration checksum matches SQL", String(row?.checksum || "") === expectedChecksum, String(row?.checksum || "missing"));
check("Packaged migration applied_steps_count is 1", Number(row?.applied_steps_count || 0) === 1);

const fixture = path.join(os.tmpdir(), `vsn-q43-${process.pid}.sqlite`);
fs.copyFileSync("prisma/dev.sqlite", fixture);
const fixtureDb = new DatabaseSync(fixture);
fixtureDb.prepare('DELETE FROM "_prisma_migrations" WHERE migration_name = ?').run(migrationName);
const adapter = {
  async $queryRawUnsafe(query, ...params) { return fixtureDb.prepare(query).all(...params); },
  async $executeRawUnsafe(query, ...params) { return fixtureDb.prepare(query).run(...params).changes; },
};
const beforeFixture = await verifyAppliedMigrationRow(adapter, migrationName, { cwd: process.cwd() });
const fixtureInsert = await recordMigrationAppliedDirect(adapter, migrationName, { cwd: process.cwd(), reason: "Q4.3 fixture" });
const afterFixture = await verifyAppliedMigrationRow(adapter, migrationName, { cwd: process.cwd() });
fixtureDb.close();
fs.rmSync(fixture, { force: true });
check("Synthetic missing-history fixture starts missing", beforeFixture.ready === false && beforeFixture.rows.length === 0);
check("Synthetic deterministic baseline inserts row", fixtureInsert.inserted === true);
check("Synthetic repaired history checksum verifies", afterFixture.ready === true && afterFixture.matching?.applied_steps_count === 1);
check("Q4.3 docs packaged", fs.existsSync("MILESTONE_Q43_DEVELOPER_MODE.md") && fs.existsSync("VSN_MILESTONE_Q43_MIGRATION_HISTORY_RUNTIME_REPORT_v2.5.87.md"));

console.log(`\nMilestone Q.4.3 migration-history/runtime audit: ${total - failed}/${total} PASS`);
if (failed) process.exit(1);
