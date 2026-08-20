# Milestone Q.4.4 — Developer Mode

Version: 2.5.88

## Goal

Repair the SQLite migration-history verification defect exposed after the Q.4.3 deterministic Email Builder baseline path. A migration row could be physically inserted with SQLite `CURRENT_TIMESTAMP`, but Prisma raw-query DateTime deserialization could reject that timestamp shape. The old reader swallowed the query error and returned an empty history, making a valid row appear missing.

## Changes

- `_prisma_migrations` timestamp columns are read through `CAST(... AS TEXT)` because migration state only needs null/non-null state and ordering.
- Non-table migration-history query failures are no longer silently converted to `[]`.
- Direct applied/rolled-back migration-history writes use Prisma's SQLite timestamp shape (`YYYY-MM-DD HH:mm:ss.SSS000 UTC`).
- Existing matching applied rows with legacy timestamp text are normalized in-place before Prisma deploy continues.
- Runtime database health uses the same text-safe migration-history read contract.
- No merchant/application table is dropped, reset or deleted.

## Recovery expectation

A database left by v2.5.87 with a correct Email Builder checksum row but SQLite `CURRENT_TIMESTAMP` values should be recognized on the next `npm run db:prepare`, normalized, and allowed through final schema verification without recreating `BuilderEmailTemplate`.
