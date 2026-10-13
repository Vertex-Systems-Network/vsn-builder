# Shopify Admin POST mutation serialization — CI-only implementation

`app/services/worker-shopify-admin-gate.js` separates **GET/read** and **POST/mutation** routes. Both call the official Shopify React Router SDK `authenticate.admin(request)` and validate the same shop, persisted session token and active `BuilderShopInstallation` record.

## Mandatory POST authorization

`acceptWorkerShopifyAdminMutation(request, env, {createSdkContext, onAuthenticated})` refuses any method other than POST. It checks the SDK session against the live stored session, then enters a **single Prisma `$transaction`** and:

1. Executes `BuilderShopInstallation.updateMany({where:{shop,uninstalledAt:null},data:{updatedAt:new Date()}})`. PostgreSQL takes a row lock on this shop's installation record. This is the same row modified by the uninstall transaction before deleting sessions.
2. **Re-reads the matching Session row inside that lock**, rejecting a rotated/revoked token or mismatched merchant/online mode with 403.
3. Only then invokes the merchant mutation callback with the **transactional Prisma handle**, verified `shop` and session; the external request-scoped database client is NOT provided. The callback must perform all DB reads/writes through `transaction`, and complete before returning a `Response`.
4. Commits after the callback resolves. On a thrown error, Prisma rolls back and returns sanitized 503. Shopify SDK-owned reauthentication `Response` redirects are propagated unchanged. `finally` always disconnects the request-scoped client.

The previous `acceptWorkerShopifyAdminRequest` function is now **GET-only**. A POST sent there returns 405 without opening the database; a GET sent to the mutation helper also returns 405. This prevents the common mistake of routing write requests through a read-only session-check path.

## Failed HTTP responses must roll back

A Prisma interactive transaction **commits on ordinary callback return**, even if the callback returns an HTTP 409 Conflict, 422 validation failure or 500 server-error `Response` after writing merchant data. Shopify authentication does not prevent that consistency failure.

The mutation gateway now **awaits** the callback within the transaction and throws a private `RollbackResponse` for all HTTP `>=400` results. This makes Prisma roll back both merchant data changes and the installation-row lock/update. Expected 4xx business responses can be returned unchanged after rollback, with `no-store` and `nosniff` headers; 5xx responses are sanitized to a bodyless 503 to avoid leaking database error details. A callback returning a non-`Response` value also triggers rollback + generic 503. Stale/revoked generation or token checks use the same rollback path. The official SDK's thrown reauthentication redirects are still propagated unchanged, after rollback when necessary.

The local PostgreSQL acceptance explicitly verifies that **actual Session fields and BuilderShopInstallation.updatedAt remain unmodified** following a callback that writes through Prisma but returns a 409, 422 or 500. In-memory unit tests and the local Cloudflare Workerd smoke test independently enforce the rule. Successful 2xx and intentional redirect responses remain valid commits where appropriate.

## Response finalization must precede PostgreSQL COMMIT

Earlier versions finalized `response.headers` **after** `$transaction` returned successfully. Built-in `Response.redirect()`, `fetch()` Responses and other immutable-header Responses can throw when headers are mutated. This allowed merchant changes to COMMIT successfully, followed by HTTP 503, falsely reporting failure and encouraging duplicate retries.

The gateway now builds a **new Response** with copied headers and mandatory `cache-control: no-store` / `x-content-type-options: nosniff` *inside the still-open interactive transaction*. Any malformed or unconstructible response fails before commit and rolls back every staged session/installation write. Returned 4xx/5xx statuses continue to throw the rollback sentinel; 5xx replies are sanitized. Returned 3xx redirects and status-0 responses are rejected and rolled back rather than ambiguously committing writes on a redirect. **Shopify SDK-thrown reauthentication redirects remain a distinct case:** they abort the transaction and are forwarded unchanged with their original location/cookie headers. GET responses are secured without a write transaction.

New unit and actual disposable PostgreSQL tests cover `Response.redirect(303)` after a staged write (must rollback), an immutable successful `fetch("data:...")` Response (must be normalized and committed with headers intact), and `Response.error()` (must rollback). The real Cloudflare Workerd synthetic test asserts returned POST redirect does not commit.

## Bounded response-stream completion before commit

A merchant POST can return HTTP 200 with a `ReadableStream` that only emits an error when the browser starts reading the body. Merely cloning the Response/headers inside Prisma does not make its body safe: PostgreSQL could commit first, and then the client would see a broken 200 while the write has persisted.

The mutation gateway now **fully reads and materializes the POST Response body while the PostgreSQL row-lock transaction is still open**, with an explicit **256 KiB maximum**. A failed stream read, oversized stream, malformed chunk or nonconstructible final Response throws *inside* Prisma, forcing rollback of all staged merchant writes and installation-row changes; the public response becomes an empty sanitized 503. Small successful JSON/text bodies get rebuilt with copied mutable headers, corrected `Content-Length` handling, `no-store` and `nosniff` before COMMIT. Merchant GET loaders may stream normally; large exports must use authenticated GET, not a streamed POST result. The 12-second interactive transaction timeout remains a separate resource bound.

Both a real disposable PostgreSQL 16 session row and in-memory Prisma fixtures are checked for **no write on failed/oversized body** and for **successful small body commit**. The actual local Cloudflare Workerd acceptance exercises failed and successful synthetic body streams, never contacting Shopify or Neon.

## Bounded response streams are resolved before COMMIT

Normal `Response` construction does not guarantee the body will complete. A callback can write merchant data inside Prisma, return HTTP 200 backed by an asynchronous `ReadableStream`, and then fail **after** the database transaction commits when the client reads the stream. That is a misleading success/failure boundary and may cause merchant retries.

The POST path now fully reads the response body **within the interactive transaction**, with a strict 256 KiB maximum. The byte counter rejects oversized responses before allocating a final buffer, cancels failed or oversized streams, and only creates a new byte-backed `Response` with `cache-control: no-store` and `x-content-type-options: nosniff` before commit. Untrusted `content-length` is discarded and recomputed by the HTTP runtime. If the response body stream fails, is locked, returns a non-byte chunk or exceeds its byte limit, the transaction throws and rolls back all writes, returning a sanitized empty 503. Empty 204 responses remain valid. Large document data must use authenticated GET rather than being streamed from a mutation.

Unit tests cover stream read failures after partial output, a 256 KiB + 1 oversized stream, and a two-chunk successful JSON payload. **Actual local disposable PostgreSQL** tests verify failed/oversized streams cannot persist Session changes and a small successful stream does commit. An actual local Cloudflare Workerd test checks both failed and successful synthetic streamed responses. These tests do not use Neon, Shopify merchant credentials or deployed Workers.

## Tests

- `tests/worker-shopify-admin-mutation.test.mjs`: synthetic SDK and fake Prisma transactions, verifies required row lock and session recheck, token rotated after initial read, uninstall between initial read/transaction, missing transaction and sanitized errors, no cross-merchant writes.
- `tests/worker-shopify-install-postgres-real.test.mjs`: real, disposable **PostgreSQL 16** through the separate Prisma cloud Client. Valid authenticated-session-shaped synthetic context writes a tenant row inside the locked transaction; a failing write is rolled back. An actual concurrent independent transaction locks/marks the shop uninstalled and deletes sessions while an authenticated POST attempts to enter; callback must not run after the uninstall commits.
- `workers/ci-worker-compat.js`: confirms equivalent synthetic authorization behavior inside real local Cloudflare Workerd.

**Scope limits:** these are *database* authorization guarantees only for callbacks using the provided transaction. Unwrapped business routes or callbacks writing through external clients are not protected. Shopify Admin GraphQL operations run over a different network transaction and are not atomic with PostgreSQL; revalidate scopes and token correctness for those operations independently. No actual Shopify merchant ID token/login or production Worker route has been certified. Connected Neon databases remain untouched. The uninstall webhook handler stays default non-destructive without genuine event-generation proof. Required development dependency security audit #96 still blocks hosted release.

Official Shopify Admin authentication reference: https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin .
