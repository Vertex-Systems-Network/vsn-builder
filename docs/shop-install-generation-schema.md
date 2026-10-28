# Builder shop installation-generation schema foundation — NOT DEPLOYED

An uninstall webhook can arrive after a merchant has reinstalled the app. [PR #128](https://github.com/Vertex-Systems-Network/vsn-builder/pull/128) added a fail-closed transactional session revocation guard which requires a durable `builderShopInstallation` Prisma model. This change introduces that **additive schema only**, separately for Local SQLite and hosted PostgreSQL.

## Additive lifecycle table

`BuilderShopInstallation` has one row per canonical `shop` (primary key), with `installedAt`, nullable `uninstalledAt`, nullable `lastUninstallWebhookId`, and `updatedAt`. Both `prisma/schema.prisma` and `prisma/cloud/schema.prisma` have the identical model. Dedicated migration SQL:
- `prisma/migrations/20261013_builder_shop_installation_fence/migration.sql` for Local SQLite
- `prisma/cloud/migrations/20261013_builder_shop_installation_fence/migration.sql` for Neon PostgreSQL

The migration only creates a new table; no DELETE, DROP, ALTER of existing `Session` records, or backfill. An existing merchant without an authenticated installation-generation record will **not** have permission to delete sessions through the new revoker: it returns 503 until trusted install lifecycle state is created.

## Critical blockers before enabling actual Worker uninstall cleanup

1. The real Shopify OAuth callback/session lifecycle must transactionally create or advance `BuilderShopInstallation.installedAt` **in the same transaction as fresh offline session storage**, serialized on that exact shop's row. Naively updating the timestamp separately from the session write would leave a race and invalidate the protection.
2. Validate the resulting OAuth and uninstall concurrency contract on an isolated disposable Neon branch, including transaction row locking, rollback and install-retry flows. Mocked JavaScript `$transaction` in CI is NOT equivalent to real PostgreSQL serialization.
3. Review the proposed PostgreSQL schema SQL and restore plan. Never migrate a hosted Staging database, change credentials, deploy the Worker, or release a Shopify app just because this migration is committed.
4. Pass mandatory high-severity dependency audits (#96), real signed merchant installation, and exact-source Staging acceptance. Live remains unchanged.

The Workerd read-only CI generates the new Edge Prisma model, checks Local/Cloud datamodel parity, validates the additive migration statements and tests the no-unauthorized-delete invariant. No actual Neon SQL or customer/merchant data mutation is performed.
