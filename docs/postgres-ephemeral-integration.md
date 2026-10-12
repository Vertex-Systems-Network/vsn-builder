# PostgreSQL 18 ephemeral integration

This GitHub Actions job launches a **throwaway Postgres 18 container** on localhost, with static non-production CI credentials and no GitHub Environment secrets. It actually applies the checked-in 51-table Cloud Prisma migration, validates `prisma migrate status`, creates the isolated Prisma Client, checks the database identity and migration checksum, checks all essential tables, executes disposable Shopify session CRUD, and reapplies the migration to verify idempotence. Tests reject *any* DATABASE_URL/DIRECT_URL other than the exact localhost CI URL.

This is a **genuine migration/Prisma integration test in GitHub CI**, not an app deployment, Neon Staging/Live migration, data restore drill, Worker runtime port, Shopify install, or release certification. The PostgreSQL container and its data are deleted with the runner. The full development dependency audit remains a separate blocking release gate.
