# Shopify uninstall/reinstall transactional safety fence — CI only

Shopify explicitly warns that webhook delivery ordering is not guaranteed, and provides `X-Shopify-Triggered-At` to identify the original event time. An uninstall event might be delivered after the same merchant has **reinstalled** the Builder app. Deleting all sessions by shop on a delayed webhook would destroy valid new sessions.

The former unguarded `Session.deleteMany({where:{shop}})` callback has been removed. The code now requires a **durable installation-generation claim** and a transaction. All destructive actions fail closed (HTTP 503) unless the request-scoped Prisma client provides:

- `database.$transaction(async tx => ...)`
- `tx.builderShopInstallation.updateMany({where:{shop,installedAt:{lte:triggeredAt},uninstalledAt:null},data:{uninstalledAt:triggeredAt,lastUninstallWebhookId}})`
- `tx.builderShopInstallation.findUnique({where:{shop}})`
- `tx.session.deleteMany({where:{shop}})`

Only an atomic, one-row claim may authorize deleting sessions of that same shop, within the same transaction. A replay against an already-uninstalled record, or a stale event older than the active installation generation, returns HTTP 204 **without another delete**. Unknown/missing/invalid generation state returns HTTP 503 and no deletion; SQL errors are never exposed. The callback verifies the official Shop payload does not conflict with SDK-verified merchant identity.

The webhook gate requires a syntactically valid UTC `X-Shopify-Triggered-At` (up to nine fractional-second digits) and passes that value into the callback **only after native WebCrypto and the official Shopify SDK verify the signed webhook**. Note that Shopify's HMAC covers the **raw body**, not the extra timestamp header; a timestamp alone is not an authorization primitive. A transactional generation fence and secure webhook ingress remain necessary.

## Current incomplete integration (must not deploy)

**`BuilderShopInstallation` does not exist in the current Prisma schema or either Neon database.** No installation/OAuth handler yet writes/advances its generation with new session creation. Consequently the real future Worker currently returns HTTP 503 from this cleanup function until the database model, safe schema migration and transactional install lifecycle are implemented and certified. This is deliberately safer than silently deleting newly reinstalled merchants' sessions.

Local unit tests and the real local Workerd acceptance use **synthetic, in-memory transactional fixtures only**. They prove first uninstall, duplicate delivery, delayed delivery after simulated reinstall, tenant-only delete, malformed timestamp and missing fence all behave as specified, **not** actual Neon row-locking or merchant OAuth. In a final implementation, the install-side row update and fresh session writes MUST participate in the same database transaction and use the same per-shop row to serialize against uninstall claims. Validate concurrency/isolation and rollback on a migrated disposable Neon branch before any Staging run.

Original event headers: [Shopify webhook delivery structure](https://shopify.dev/docs/apps/build/webhooks/delivery-structure). No Staging/Live deployment, real merchant sessions, or Shopify submission. Mandatory security audit #96 is still required.
