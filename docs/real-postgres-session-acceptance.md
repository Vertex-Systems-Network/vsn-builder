# Disposable PostgreSQL 16 transactional acceptance (GitHub Actions only)

This test is the **first actual PostgreSQL database acceptance** of the Builder Shopify session-generation logic. Previous real SQL verification used only local SQLite; fake JS transactions do not prove PostgreSQL row locks.

A GitHub Actions local Workerd job provisions a temporary `postgres:16-alpine` service on the ephemeral GitHub runner. It runs the repository's **separate hosted PostgreSQL** `prisma/cloud/migrations` history against `127.0.0.1:5432/vsn_builder_ci`, never against connected Neon Staging or Production. The service's only credential is a fixed, synthetic **CI-only** password. The tests assert the *exact* localhost connection URL, `CI=true`, `NODE_ENV=test`, and `APP_ENV=development` before constructing a PrismaClient; any remote URL, alternate port, hostname, database, password, or SSL endpoint is rejected.

The test `tests/worker-shopify-install-postgres-real.test.mjs` uses the generated `prisma-cloud` Client and Shopify's official `PrismaSessionStorage` with transactionally fenced offline session writes. It exercises:

- Full real PostgreSQL schema migration against a clean disposable DB.
- Atomic installation-generation + session persistence for two isolated synthetic merchants.
- Token rotation without incorrectly advancing the installation generation.
- **Actual PostgreSQL row-lock blocking:** an independent transaction holds a shop row while a signed-webhook-shaped synthetic cleanup request attempts to claim it; no cleanup should resolve before the lock releases.
- Tenant-scoped uninstall session deletion, idempotent replay, and blocked stale session restoration.
- Failed official adapter write rolling back the entire newly created generation.
- Concurrent offline session refresh versus uninstall on distinct transaction connections, with the invariant that no session may survive a committed uninstall.

Prisma ORM v6 documents interactive `$transaction(fn)` and PostgreSQL's default `ReadCommitted` semantics: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions . The test uses a short held lock for deterministic verification. This is **CI-local PostgreSQL**, not a live Neon pooled/direct connection and not proof of Neon-specific transaction semantics.

**Security limit:** the synthetic uninstall test supplies a timestamp accepted by the current prototype. Shopify's HMAC covers the webhook raw body; the header timestamp is not independently authenticated. Therefore passing this test **does not authorize destructive webhook cleanup on hosted merchant sessions**. A separate change must fail closed for missing trusted event-generation proof, and real Shopify OAuth installation/reinstall delivery is not yet certified.

No connected Neon writes/migrations, Cloudflare deployment, real Shopify request, PR merge or Shopify app submission are made. Mandatory dependency security audit #96 remains a release blocker.
