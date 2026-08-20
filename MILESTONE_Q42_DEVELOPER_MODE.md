# Milestone Q.4.2 — Database Convergence & Email Migration Self-Heal

Developer Mode remains the default. This hotfix does not reset SQLite data.

## Guarantees
- Prisma CLI and Prisma Client normalize to the same SQLite database target.
- `db:prepare` reports the database path before migrations run.
- The additive N.1 Email Builder migration is reconciled before and after Prisma deploy.
- A complete pre-existing `BuilderEmailTemplate` table can have missing migration history repaired.
- A failed N.1 migration with no table is marked rolled back so Prisma can retry it.
- If Prisma deploy returns successfully but the additive email table is still absent, VSN can create only that known table/index schema and then reconcile history.
- Partial existing email tables are never destructively rewritten automatically.
