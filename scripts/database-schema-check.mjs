import db from "../app/db.server.js";
import { getRuntimeSchemaHealth } from "../app/services/database-health.server.js";
import { verifyAppliedMigrationRow } from "./lib/prisma-migration-history.mjs";

const health = await getRuntimeSchemaHealth(db, { fresh: true });
const email = health.features?.emailBuilder;
let history = null;
try { history = await verifyAppliedMigrationRow(db, health.expectedMigration); } catch {}

if (!health.ready || !health.expectedMigrationApplied || !health.expectedMigrationChecksumMatches) {
  console.error("VSN database schema check FAILED.");
  if (health.databaseFile) console.error(`- Runtime database: ${health.databaseFile}`);
  if (health.expectedDatabaseFile) console.error(`- Expected database: ${health.expectedDatabaseFile}`);
  if (!health.databaseTargetMatches) console.error("- Prisma Client and migration target do not point to the same SQLite file.");
  if (health.databaseError) console.error(`- Database: ${health.databaseError}`);
  if (health.missingTables.length) console.error(`- Missing tables: ${health.missingTables.join(", ")}`);
  if (email && !email.ready) console.error(`- Email Builder schema missing: ${email.missingTables.join(", ") || "required table"}`);
  if (!health.expectedMigrationApplied) console.error(`- Expected migration not applied: ${health.expectedMigration}`);
  if (health.expectedMigrationApplied && !health.expectedMigrationChecksumMatches) {
    console.error(`- Expected migration checksum mismatch: ${health.expectedMigration}`);
    if (health.expectedMigrationChecksum) console.error(`- Packaged checksum: ${health.expectedMigrationChecksum}`);
  }
  if (history) {
    console.error(`- Matching migration rows: ${history.rows.length}`);
    for (const row of history.rows) {
      const state = row?.finished_at && !row?.rolled_back_at ? "applied" : row?.rolled_back_at ? "rolled-back" : "failed";
      console.error(`  · ${state} · id=${String(row?.id || "unknown")} · checksum=${String(row?.checksum || "unknown")}`);
    }
  }
  console.error("Run `npm run db:prepare` from this package, then restart the app. Do not reset merchant data.");
  await db.$disconnect();
  process.exit(1);
}
console.log(
  `VSN database schema PASS · DB ${health.databaseFile || "unknown"} · latest ${health.latestMigration || "unknown"} · ` +
  `${health.appliedMigrations.length} applied migration(s) · expected checksum verified.`,
);
await db.$disconnect();
