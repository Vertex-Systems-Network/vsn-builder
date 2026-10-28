# T020 — Shopify-authenticated React Router loader boundary (2026-10-14)

This is a **test-only, Staging-gated source integration**, not a public merchant application.

## What was implemented

- `app/services/worker-authenticated-router-bridge.js` wires the existing `acceptWorkerShopifyAdminRequest` official Shopify SDK admin verifier and installed-generation/persisted-session check into a generated React Router route. No untrusted `?shop` parameter becomes identity. SDK reauthorization redirects continue to be forwarded by the existing verified security gate.
- The gateway is bound to **GET `/app/__vsn-auth-smoke` only** on a correctly configured Staging environment. It rejects normal `/app/pages`, OAuth callbacks, webhooks, billing, POST and additional/duplicate query parameters. Real `workers/app.js` is not changed.
- The fixture `tests/fixtures/t020-vite-build/app/routes/auth-smoke.jsx` is compiled by the **real Vite React Router build**. It receives only `merchant.shop` and a minimal `cloudflare.env` with test flags, *never* the SDK token, session ID, database client, Shopify secret or account information.
- All responses are fully buffered with a strict 16 KiB limit and 1.5 second deadline **before the request-scoped SDK/Prisma connection closes**. Redirects, set-cookie headers and unexpected content-types from the test loader fail closed, while Shopify-SDK-thrown reauth responses retain their official cookie/redirect behavior.
- `tests/worker-authenticated-router-bridge.test.mjs` simulates the official SDK's authenticated session and persisted installation using in-memory fixtures and runs the **actual framework-generated loader**. Negative cases include expired/rotated tokens, uninstalled stores, cross-tenant shop claims, forged headers and invalid tier credentials.

## Evidence limitations

The tests use **synthetic SDK and database fixtures**, although the real security gate and real Vite-generated React Router loader execute. This verifies request-scoped identity propagation and safe cleanup, **not a real Shopify signature/ID-token verification or a live Neon query**. The separately proven SDK/PrismaNeon Wrangler import compilation does not change this limitation.

**T020 remains IN_REVIEW/PARTIAL.** Full Shopify app Cloudflare route-graph migration and real OAuth/App Bridge, independently protected Neon Staging migration, live Shopify test-store install/uninstall, webhooks, verified billing, release security issue #96 and approved deployment are still mandatory. **No Staging/Live deployment or Shopify App Store submission.**
