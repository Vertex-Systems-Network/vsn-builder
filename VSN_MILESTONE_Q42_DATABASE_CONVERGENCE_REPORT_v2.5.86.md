# VSN Builder v2.5.86 — Milestone Q.4.2 Database Convergence & Email Migration Self-Heal

## Root cause class
v2.5.85 fixed Prisma CLI executable resolution. The remaining failure occurred after `migrate deploy`: runtime schema verification still reported the N.1 Email Builder migration missing. The package did not prove that CLI/runtime database targets converged, nor did it reconcile all safe states of the additive N.1 migration.

## Fix
- Prisma datasource now consumes `DATABASE_URL`.
- VSN normalizes the default development database to the package's `prisma/dev.sqlite` and Prisma Client uses the normalized URL explicitly.
- Prisma child processes receive the same normalized database URL.
- `db:prepare` now runs pre-deploy and post-deploy Email Builder migration reconciliation.
- Reconciliation checks the physical table, 13 required columns, both required indexes, and `_prisma_migrations` state.
- No database reset/delete behavior is introduced.
