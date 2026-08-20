# VSN Milestone Q.4.4 — SQLite Migration History Serialization Fix

Version: 2.5.88

## Root cause

The deterministic Q.4.3 fallback inserted a correct `_prisma_migrations` row, but used SQLite `CURRENT_TIMESTAMP`. Prisma's SQLite raw-query DateTime decoder can reject non-Prisma timestamp text. `readMigrationRows()` caught all query errors and returned an empty array, so the reconciler reported that the just-inserted migration row was still missing.

## Resolution

1. Migration-history timestamp values are cast to text at query time.
2. Only the legitimate `_prisma_migrations`-table-missing condition becomes an empty history; other query errors are surfaced.
3. Deterministic history writes use the Prisma SQLite timestamp representation.
4. Correct-checksum legacy rows are normalized in-place.
5. Database health uses text-safe migration timestamp reads.

## Data safety

No database reset, table drop, SQLite deletion or merchant-data rewrite is part of the fix. The only mutation is to the known Prisma migration-history row for the already-verified additive Email Builder migration.
