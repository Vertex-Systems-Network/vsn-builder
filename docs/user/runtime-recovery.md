# Runtime recovery and database readiness

VSN now treats a partially migrated database as a setup problem instead of a generic screen failure.

## Before development starts

`npm run dev` runs the Shopify web `predev` command, which executes `npm run db:prepare`. The database prepare pipeline generates Prisma Client, repairs two known legacy migration-history gaps only when their schema changes already exist, deploys all pending migrations, and verifies the feature tables required by the running package.

If this step fails, do not reset the database. Read the first migration error, keep a backup, and repair or deploy the packaged migrations.

## Email Builder says a migration is required

Run:

```bash
npm run db:prepare
npm run dev
```

Email Builder checks `BuilderEmailTemplate` before loading or writing. If the table is missing, the screen returns an actionable migration message instead of a Prisma stack trace.

## A screen stops rendering

The app-level runtime boundary isolates React render failures and provides Retry, Reload app, and System Health actions. Window errors and unhandled promise rejections are also reported to VSN diagnostics with bounded/sanitized details.

## System Health

System Health reports the expected migration, latest applied migration and missing required tables. A green database connection alone is not enough; migration/schema readiness must also pass.

## Node runtime and migration history
For the Prisma 6 development toolchain use Node 22 LTS (Node 22.18 or newer). Node 25/current odd-numbered releases are intentionally rejected because they are outside the tested runtime contract. Run `npm run runtime:verify` before database recovery. If Email Builder history is the only remaining issue, `npm run db:prepare` now verifies the physical schema and migration checksum and can repair the known additive N.1 history without deleting `prisma/dev.sqlite`. Use `npm run db:diagnose` to print the exact database path and migration rows.
