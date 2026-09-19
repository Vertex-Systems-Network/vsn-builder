# Production data topology

P0.5 separates what this repository **implements** from what is **actually deployed**. The two must not be conflated.

## Current implementation

VSN Builder is currently a SQLite application.

- Prisma datasource provider: `sqlite`.
- Migration lock provider: `sqlite`.
- Runtime database-health inspection uses `sqlite_master` and `PRAGMA database_list`.
- Migration repair/verification tooling uses SQLite semantics and, in several audits, Node's `node:sqlite`.
- The default development target is `prisma/dev.sqlite`.
- The Dockerfile does not declare a persistent volume.

Although the database-location helper can parse a non-`file:` `DATABASE_URL`, the current Prisma schema and SQLite-specific runtime services do **not** implement Postgres/MySQL production support. A non-file URL must therefore not be treated as a supported external-database deployment.

## Supported production mode today

Until a deliberate Prisma/provider migration is implemented, the only supported production persistence shape is:

1. explicit `DATABASE_URL=file:...`;
2. one application instance writing the database;
3. the SQLite file located on durable persistent storage;
4. infrastructure-level snapshots/backups independent of the app;
5. a tested restore procedure.

Ephemeral container filesystems and multi-replica SQLite deployments are unsupported.

This does not mean those five conditions are currently true in production. It defines the requirements a production deployment must prove.

## Actual deployed topology status

**Status: NOT VERIFIED.**

Repository inspection found no committed Railway, Vercel, Fly.io or Render deployment configuration. Connected Railway/Vercel project discovery on 2026-09-19 did not identify a `vsn-builder` project association. That is evidence of absence from the checked integrations, not proof that no production deployment exists elsewhere.

The following remain unverified:

- hosting provider/project identity;
- production database file target;
- durable volume/mount;
- replica count / single-instance enforcement;
- infrastructure snapshot schedule/retention;
- successful restore drill.

The machine-readable status is stored in `.ai/PRODUCTION_DATA_TOPOLOGY.json`.

## Production release evidence

`npm run data-topology:production` requires explicit operator-supplied evidence:

- `DATABASE_URL` using the implemented `file:` SQLite provider;
- `VSN_PRODUCTION_HOSTING_PROVIDER`;
- `VSN_SQLITE_VOLUME_MOUNT`;
- `VSN_SQLITE_INSTANCE_MODE=single-instance`;
- `VSN_SQLITE_DURABILITY=durable-volume`;
- `VSN_SQLITE_BACKUP_MODE=infrastructure-snapshot`;
- `VSN_SQLITE_RESTORE_TESTED_AT=<ISO-8601 timestamp>`.

Passing this check means the deployment is **ATTESTED** by its release configuration. It is not an independent cloud-provider audit. When connected infrastructure evidence is available, compare the attestation against the real service configuration.

`npm run release:production:check` includes this topology check, so a production deploy cannot silently rely on the development SQLite fallback.

## Backup and restore boundaries

The Backups screen is a merchant/product-state portability feature, not a full database disaster-recovery mechanism.

Its JSON export intentionally excludes:

- form submissions;
- integration secrets;
- GraphQL history.

It also does not capture every operational/telemetry row in the SQLite database. Infrastructure snapshots remain required even when application backups are enabled.

## Concurrency and future agents/jobs

SQLite is suitable only under the documented single-instance assumption for the current architecture. Do not introduce horizontally scaled workers, independent agent runners or multi-instance job consumers that write this database until P0.5 deployment evidence is complete or the persistence layer is deliberately migrated.

For future external-database work, changing only `DATABASE_URL` is insufficient. The Prisma datasource provider, migrations, runtime health checks, migration repair tooling, deployment procedures and regression suite must migrate together.

## Commands

- Repository contract: `npm run qa:p05`
- Production evidence: `npm run data-topology:production`
- Full production release readiness: `npm run release:production:check`

P0.5 remains blocked on real deployment evidence; the repository now fails closed instead of converting unknown infrastructure into an assumed production architecture.
