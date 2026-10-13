# Shopify Admin POST mutation serialization — CI-only implementation

`app/services/worker-shopify-admin-gate.js` separates **GET/read** and **POST/mutation** routes. Both call the official Shopify React Router SDK `authenticate.admin(request)` and validate the same shop, persisted session token and active `BuilderShopInstallation` record.

## Mandatory POST authorization

`acceptWorkerShopifyAdminMutation(request, env, {createSdkContext, onAuthenticated})` refuses any method other than POST. It checks the SDK session against the live stored session, then enters a **single Prisma `$transaction`** and:

1. Executes `BuilderShopInstallation.updateMany({where:{shop,uninstalledAt:null},data:{updatedAt:new Date()}})`. PostgreSQL takes a row lock on this shop's installation record. This is the same row modified by the uninstall transaction before deleting sessions.
2. **Re-reads the matching Session row inside that lock**, rejecting a rotated/revoked token or mismatched merchant/online mode with 403.
3. Only then invokes the merchant mutation callback with the **transactional Prisma handle**, verified `shop` and session; the external request-scoped database client is NOT provided. The callback must perform all DB reads/writes through `transaction`, and complete before returning a `Response`.
4. Commits after the callback resolves. On a thrown error, Prisma rolls back and returns sanitized 503. Shopify SDK-owned reauthentication `Response` redirects are propagated unchanged. `finally` always disconnects the request-scoped client.

The previous `acceptWorkerShopifyAdminRequest` function is now **GET-only**. A POST sent there returns 405 without opening the database; a GET sent to the mutation helper also returns 405. This prevents the common mistake of routing write requests through a read-only session-check path.

## Tests

- `tests/worker-shopify-admin-mutation.test.mjs`: synthetic SDK and fake Prisma transactions, verifies required row lock and session recheck, token rotated after initial read, uninstall between initial read/transaction, missing transaction and sanitized errors, no cross-merchant writes.
- `tests/worker-shopify-install-postgres-real.test.mjs`: real, disposable **PostgreSQL 16** through the separate Prisma cloud Client. Valid authenticated-session-shaped synthetic context writes a tenant row inside the locked transaction; a failing write is rolled back. An actual concurrent independent transaction locks/marks the shop uninstalled and deletes sessions while an authenticated POST attempts to enter; callback must not run after the uninstall commits.
- `workers/ci-worker-compat.js`: confirms equivalent synthetic authorization behavior inside real local Cloudflare Workerd.

**Scope limits:** these are *database* authorization guarantees only for callbacks using the provided transaction. Unwrapped business routes or callbacks writing through external clients are not protected. Shopify Admin GraphQL operations run over a different network transaction and are not atomic with PostgreSQL; revalidate scopes and token correctness for those operations independently. No actual Shopify merchant ID token/login or production Worker route has been certified. Connected Neon databases remain untouched. The uninstall webhook handler stays default non-destructive without genuine event-generation proof. Required development dependency security audit #96 still blocks hosted release.

Official Shopify Admin authentication reference: https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin .
