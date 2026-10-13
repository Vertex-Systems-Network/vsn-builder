# Real local SQLite installation-transaction acceptance — NO NEON

The Worker Shopify SDK's generation-fenced SessionStorage was previously tested through synthetic transaction delegates. The additional `worker-shopify-install-sqlite-real.test.mjs` exercises the **actual Prisma Client with a physical, disposable SQLite database** and the official `PrismaSessionStorage` adapter, using the same Local/Cloud shared Prisma model contract.

The read-only local Cloudflare Workerd CI creates `file:./worker-install-fence-ci.sqlite` via the **full Local SQLite Prisma migration history**, then verifies:

- Offline session and shop installation-generation persist in the same transaction.
- Routine offline token rotation cannot advance `installedAt` or pretend a new OAuth installation occurred.
- Uninstall marker causes ordinary stale SDK session writes to be rejected, leaving prior installedAt, uninstalledAt and stored token unchanged.
- A forced session-write failure rolls back newly created installation rows in the **real SQLite database**, not merely a JavaScript fixture.
- Existing orphan offline sessions cannot silently create a new installation generation.
- Isolated fixture shop records are removed at the end of the tests.

The test file refuses execution unless `CI=true`, `NODE_ENV=test`, and `DATABASE_URL=file:./worker-install-fence-ci.sqlite`. It has **no hosted secrets and cannot connect to Neon**. No remote database schema migration occurs.

**Limitations:** SQLite transaction acceptance is **not** evidence of PostgreSQL row-locking, isolation level, connection pooling or true Neon concurrency behavior. Real Shopify OAuth installation/reinstallation remains unavailable and review-required. The prototype destructive uninstall callback depends on an untrusted timestamp header; it is not authorized for hosted deployment. Required development dependency audit #96 still blocks a production release.
