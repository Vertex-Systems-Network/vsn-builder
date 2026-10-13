# Verified Shopify uninstall: narrow session revocation only (not deployed)

The future Cloudflare Worker `/webhooks/app/uninstalled` path must invoke `acceptWorkerShopifyUninstallWebhook` and inject `revokeVerifiedWorkerShopifySessions` as its `onVerified` callback. **There is no production Worker router yet.** The gate validates the HMAC with native WebCrypto **before** initializing the SDK/database. The official Shopify React Router SDK independently verifies the HMAC, merchant, topic, webhook ID and payload before the revocation callback can run. The SDK owns the request-scoped Neon Prisma client and closes it in a `finally` block.

The revocation module checks `event.shop` is a canonical `*.myshopify.com` domain, `event.topic` is `APP_UNINSTALLED`, `event.payload.shop_domain` matches `event.shop`, and the SDK request-scoped `context.database.session.deleteMany` exists. Its **only** database operation is:

```js
await context.database.session.deleteMany({where: {shop: event.shop}})
```

The Prisma query is tenant-scoped and atomic. Successful first cleanup and repeated Shopify deliveries return HTTP 204, without exposing affected session counts. Missing database/model, unexpected write results and driver errors fail closed with HTTP 503, so Shopify can retry. No connection string, access token or driver error is sent in the response. Callback is never called by the gate before **both** webhook signature validations pass.

**Scope explicitly excludes deletion of merchant-authored Builder pages/templates/assets, subscriptions, billing records, backups, audit logs and customer data.** Retention and deletion compliance needs a separate reviewed workflow; uninstall alone must not silently erase merchant content. This session revocation is not itself proof of a complete GDPR/CCPA data deletion implementation.

Acceptance: `tests/worker-uninstall-session-revoke.test.mjs` covers target-only deletion with two synthetic tenants, idempotent replay, malformed signed payload, unavailable storage and safe errors. The CI-only real Cloudflare Workerd probe additionally signs a synthetic Shopify uninstall body with WebCrypto, authenticates it through the official SDK, invokes request-scoped in-memory Prisma-like `deleteMany`, replays the webhook, verifies another merchant retains its sessions, and rejects a tampered body **before** any more session storage opens or deletes occur. Local loopback GET probe only; `/app` stays 503.

## Connected infrastructure inspection — 2026-10-13

Read-only Neon inspection of the two actual isolated Builder projects found both default `neondb` databases present, with **zero user application tables** in each at inspection time. The stored migration SQL was **not** applied and no write-enabled SQL was executed. Staging and Production continue to be blocked on hosted schema migration and genuine Shopify merchant acceptance. Never treat the existence of empty Neon databases as evidence of deployed app readiness.

## Security and release

No real Shopify credentials, shop installations, Shopify API request, Cloudflare deployment, Neon live migration, customer data deletion or PR merge is involved in this work. The isolated Workerd test **cannot replace** the existing mandatory full development dependency audit. Advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) currently lists no upstream patched `braces` version; issue #96 remains release-blocking. No audit bypass is authorized.
