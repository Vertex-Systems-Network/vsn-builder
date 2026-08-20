import db from "../app/db.server.js";
import { getRuntimeSchemaHealth } from "../app/services/database-health.server.js";
import { verifyAppliedMigrationRow } from "./lib/prisma-migration-history.mjs";

const health = await getRuntimeSchemaHealth(db, { fresh: true });
const history = await verifyAppliedMigrationRow(db, health.expectedMigration);
console.log("VSN database diagnostics:");
console.log(`- Runtime DB: ${health.databaseFile || "unknown"}`);
console.log(`- Expected DB: ${health.expectedDatabaseFile || "unknown"}`);
console.log(`- Target matches: ${health.databaseTargetMatches ? "yes" : "NO"}`);
console.log(`- Required tables ready: ${health.missingTables.length ? `NO (${health.missingTables.join(", ")})` : "yes"}`);
console.log(`- Expected migration: ${health.expectedMigration}`);
console.log(`- Expected checksum: ${history.expectedChecksum}`);
console.log(`- History rows: ${history.rows.length}`);
for (const row of history.rows) {
  const state = row?.finished_at && !row?.rolled_back_at ? "applied" : row?.rolled_back_at ? "rolled-back" : "failed";
  console.log(`  · ${state} · id=${String(row?.id || "unknown")} · checksum=${String(row?.checksum || "unknown")} · steps=${String(row?.applied_steps_count ?? "?")}`);
}
console.log(`- Checksum-verified expected migration: ${history.ready ? "yes" : "NO"}`);
console.log(`- Overall runtime schema ready: ${health.ready ? "yes" : "NO"}`);
await db.$disconnect();
if (!health.ready) process.exitCode = 1;
