import db from "../app/db.server.js";
import { runPrisma } from "./lib/prisma-process.mjs";

const LEGACY = [
  { name:"20260806090000_page_template_trash_assets", table:"BuilderPage", columns:["deletedAt","trashedAssetsJson"] },
  { name:"20260806143000_library_template_metadata", table:"BuilderLibraryItem", columns:["templateType","isFavorite"] },
];

async function appliedNames() {
  try {
    const rows = await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    return new Set((Array.isArray(rows) ? rows : []).map((row)=>String(row.migration_name)));
  } catch { return new Set(); }
}

async function columns(table) {
  const safe = String(table).replace(/[^A-Za-z0-9_]/g, "");
  const rows = await db.$queryRawUnsafe(`PRAGMA table_info("${safe}")`);
  return new Set((Array.isArray(rows) ? rows : []).map((row)=>String(row.name)));
}

const applied = await appliedNames();
for (const item of LEGACY) {
  if (applied.has(item.name)) continue;
  let present = false;
  try {
    const current = await columns(item.table);
    present = item.columns.every((column)=>current.has(column));
  } catch {}
  if (!present) continue;
  console.log(`VSN migration-history repair: schema for ${item.name} already exists; marking migration applied without changing data.`);
  await db.$disconnect();
  try {
    runPrisma(["migrate", "resolve", "--applied", item.name]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown Prisma resolve error");
    console.error(`VSN migration-history repair FAILED for ${item.name}: ${message}`);
    process.exit(1);
  }
  process.exitCode = 0;
  // Prisma client can reconnect on the next process; this script is intentionally one-shot per repair.
  process.exit(0);
}
await db.$disconnect();
console.log("VSN migration-history repair: no legacy drift requiring repair in this pass.");
