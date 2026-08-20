# Migrations

Use Prisma migrations only. Generate client, apply `prisma migrate deploy`, back up first, and never use destructive reset/db-push shortcuts against merchant data. Package QA must verify migration continuity.

## Engineering rules

- Keep client-safe and server-only dependencies separated.
- Reuse shared contracts instead of parallel engines.
- Enforce permissions on the server.
- Add acceptance criteria and a regression audit for meaningful platform changes.

## Database target convergence

From v2.5.86, Prisma CLI commands and Prisma Client normalize the same `DATABASE_URL`. The default developer database is `prisma/dev.sqlite`. `npm run db:prepare` prints the database target and performs a non-destructive pre/post-deploy reconciliation for the additive N.1 Email Builder migration. Never delete or reset `prisma/dev.sqlite` as a migration-repair shortcut.

## Deterministic N.1 history reconciliation (v2.5.87)
`prisma migrate resolve` is treated as a request, not as proof. VSN rereads `_prisma_migrations` and requires an applied `20260808234540_milestone_n1_email_builder` row whose checksum equals SHA-256(`migration.sql`). If the 13-column Email table and both required indexes are physically verified but Prisma does not record the row, VSN creates Prisma-compatible history metadata for this one known additive migration. Existing applied checksum conflicts are never rewritten automatically. Node 22.18+ are supported; Node 22 LTS is recommended.

## SQLite history serialization hardening (v2.5.88)
Prisma migration-history timestamp columns are read as SQLite text instead of being deserialized as Prisma `DateTime` values. This is intentional: v2.5.87 could insert a correct checksum row using SQLite `CURRENT_TIMESTAMP`, then fail to see it because the raw-query decoder rejected the timestamp shape and the old helper hid that read error. Q.4.4 surfaces non-table read errors, recognizes correct legacy rows, and normalizes their `started_at` / `finished_at` values to Prisma's SQLite migration timestamp shape before deploy continues.
