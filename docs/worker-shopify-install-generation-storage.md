# Worker Shopify session persistence + installation generation — local acceptance only

`app/services/worker-shopify-install-session-storage.js` wraps the **official** Shopify `PrismaSessionStorage` implementation, preserving its token serialization, session loading and deletion methods. The Worker Shopify SDK receives the wrapper in `createWorkerShopifySessionContext`, so any *future authenticated SDK* `storeSession()` is subject to the same database transaction.

## Persistence contract

- Offline session IDs must be exactly `offline_<canonical-shop.myshopify.com>`, token must be present, and the request's SDK is responsible for completing Shopify OAuth authentication **before** calling this storage.
- `db.$transaction(async tx => ...)` acquires the shop's `BuilderShopInstallation` row with `upsert`, reads the prior offline access-token record, updates `installedAt` and clears `uninstalledAt` if this is a first offline token, a reinstall following uninstall or token rotation, then calls the **official** `new PrismaSessionStorage(tx)` `storeSession(session)` inside the same transaction. Identical-token refresh retains the current generation.
- Online session writes are allowed only when an active shop installation row is claimed with `updateMany` in the transaction. Missing/previously uninstalled installation rows fail closed.
- Failed session persistence must roll back the lifecycle update. All returned errors are sanitized; URLs and tokens are not logged by the wrapper.
- The Prisma lifecycle row update is intended to serialize with `uninstall` on the same shop. Real PostgreSQL row-locking and concurrent-authentication semantics are **not yet verified**. Mock transactions and single-process tests are not sufficient production evidence.
- A token replacement is treated conservatively as a new generation, including some token refreshes. The SDK/token provider remains authoritative for authenticating the session.

## Mandatory safety gap

**Important:** Shopify's webhook HMAC authenticates the raw request *body*, not `X-Shopify-Triggered-At` or `X-Shopify-Webhook-Id` headers. A previously captured genuine signed webhook body with a modified event timestamp could appear newer; the current timestamp-only uninstall generation fence cannot independently establish freshness of all headers. **Do not enable destructive webhook cleanup on real merchant sessions** until immutable event provenance/delivery verification or an independently trusted current-install state proves the event belongs to the active generation. The current uninstall service still lacks a deployed host route; the CI-only Worker deliberately returns 503 for `/app`.

## Tests and remaining work

`tests/worker-shopify-install-session-storage.test.mjs` exercises the actual Shopify Prisma adapter against fake transactional Prisma model delegates, including commit, rollback, offline refresh, changed token, reinstall, online token safety, invalid shop input and tenant isolation. `workers/ci-worker-compat.js` also exercises a synthetic offline session with the **real** Prisma adapter inside local Cloudflare Workerd. No live Neon queries.

This does not implement a Shopify OAuth callback or prove that the SDK's actual redirect sequence reaches `storeSession` in production. Both Neon target databases were found without application tables at the previous read-only inspection; no schema has been migrated there. Mandatory high-severity audit issue #96 remains a release blocker, so the stacked changes are not merge/release certified.
