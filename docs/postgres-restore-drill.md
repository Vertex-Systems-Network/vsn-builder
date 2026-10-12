# Disposable PostgreSQL 18 backup/restore drill

The PostgreSQL 18 CI job now runs a **real** logical backup and restore after completing the proposed Builder 51-model migration in its throwaway container. It seeds a non-sensitive synthetic Shopify session in `builder_ci`, dumps that database using PostgreSQL 18 `pg_dump --format=custom`, creates a **different empty** `builder_restore` database in the *same disposable GitHub runner*, and restores using PostgreSQL 18 `pg_restore --exit-on-error`.

Independent Node tests use the generated Cloud Prisma Client against the restored database to validate all 51 tables, migration ledger hash, critical feature tables, synthetic session data persistence and post-restore updates. They also confirm wrong DB identity fails closed. Both original and restored databases are destroyed with the runner. The dump is **not** uploaded as an artifact. No Cloudflare, Shopify, Neon or production credentials are available.

This is a useful local recovery rehearsal, **not** actual Neon snapshots, Neon Staging recovery, production RPO/RTO verification, merchant data preservation, or deployment certification. The real staging and live migration/runbooks stay gated.
