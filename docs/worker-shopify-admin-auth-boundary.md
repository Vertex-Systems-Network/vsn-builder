# Shopify Admin SDK request boundary — CI-only integration

`acceptWorkerShopifyAdminRequest(request, env, { createSdkContext, onAuthenticated })` is a **future Cloudflare Worker integration helper**, NOT a deployed Shopify auth route. It supports GET/POST requests to `/app` and `/app/*`, and rejects unrelated URLs, invalid method, cross-tier Worker identity, invalid URL origin, mismatch with Neon project or invalid Shopify configuration **before** a database factory is called.

## Authorization flow

1. Initialize `createWorkerShopifySdkContext` with the tier-bound environment, official `shopifyApp` factory and request-scoped shop session storage. This context already validates that both Prisma `Session` and `BuilderShopInstallation` database tables exist and the official Shopify `PrismaSessionStorage` is ready.
2. Call **the official** `shopify.authenticate.admin(request)`; Shopify's SDK handles embedded session JWT validation, token exchange, reauth and cookies. **Never** infer a merchant from raw `?shop`, Authorization header, host or a browser cookie.
3. Verify the returned SDK session has canonical `*.myshopify.com` shop, nonempty session ID/token and explicit `isOnline` flag. An optional URL `?shop` is only a consistency check against the SDK-authenticated shop; it is never an authorization source.
4. Resolve exactly this shop's active `BuilderShopInstallation` row and exact SDK session ID from the same request-scoped Prisma database. Require a valid installedAt, null uninstalledAt, matching shop, online/offline mode and identical persisted token before `onAuthenticated` is allowed.
5. Return only a real `Response`, with no-store/nosniff response headers. The callback must finish its DB work before returning: session/Prisma context is **always closed** in `finally`. Return Shopify-SDK-thrown reauth `Response` unchanged, preserving redirect and Set-Cookie headers. Unexpected SDK/Prisma errors return empty sanitized HTTP 503 without URLs or tokens.

## Verification

`tests/worker-shopify-admin-gate.test.mjs` covers real Shopify SDK rejection of unauthenticated requests, synthetic authenticated-context acceptance, SDK-owned redirect preservation, forged shop query/bearer denial, wrong database tier, inactive installation and invalid/stale token, missing DB table, generic error sanitization and cleanup.

`tests/worker-shopify-install-postgres-real.test.mjs` exercises this auth boundary **against actual disposable PostgreSQL rows** written by the official Shopify Prisma adapter. Its `authenticate.admin` return is a synthetic CI stand-in used solely to exercise persisted-session checks; it is **not** a real Shopify-issued JWT/merchant login. `workers/ci-worker-compat.js` validates the package and tenant-gate contract inside actual local Cloudflare Workerd.

## Remaining release blockers

There is **no hosted `/app` route**, real Shopify frontend App Bridge token, actual Shopify-issued merchant ID token, token exchange acceptance with Shopify, signed installation/reinstallation ceremony or hosted Cloudflare Worker. This does not show production merchant authorization, nor guarantee that a concurrent uninstall between the session check and callback cannot race; sensitive mutation paths need separate transaction/authorization enforcement. The existing uninstall endpoint remains default **non-destructive** without independent authenticated generation attestation. The full mandatory `braces` high-severity development dependency audit (#96) remains a release blocker. No Neon migration, production secrets, Shopify merchant data, deployment or submission is involved.

Official Shopify reference: https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin .
