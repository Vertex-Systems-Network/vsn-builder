# T020 — Cloudflare React Router Fetch gateway (CI-only)

**2026-10-14.** This is the next isolated development slice after [edge Web Streams HTML SSR](t020-cloudflare-edge-ssr-compatibility.md). It does **not** install or activate a Shopify application.

## Implemented

- `app/services/worker-react-router-request-gate.js` adapts a `Request`, a Worker environment and an execution context into React Router's documented `createRequestHandler(loadServerBuild, "production")` signature, then `handler(request,{cloudflare:{env,ctx}})`.
- The gateway **only** accepts `APP_ENV=test`, `VSN_BUILD_INTENT=react-router-ci`, no third key/secret, a loopback or exact `vsn-edge.test` hostname, GET `/__vsn/react-router-smoke` with no query, cookies, Shopify headers or Authorization. All `/app`, `/auth`, `/webhooks`, billing and production traffic is locked; no caller can promote a merchant route via an environment flag.
- A synthetic React Router handler contract is unit-tested with strict separate response/cookie/header sanitization, 64 KiB maximum response, read deadline, error suppression, and no Worker secrets passed to the framework.
- `workers/edge-react-router-ci-probe.js` imports **the real React Router `createRequestHandler` package** so Wrangler dry-run compiles the runtime dependency, but its server build is intentionally **empty/incomplete**. Even a correct CI probe GET must respond 503. This proves the import/build compatibility and an isolated request-handler boundary, **not** a functional React Router server build.
- The CI-only `wrangler.edge-router-ci.jsonc` is explicitly named `vsn-builder-react-router-ci`, has no secrets, `workers_dev:false`, no preview URL, and can only be compiled using `wrangler deploy --dry-run`.
- `tests/worker-react-router-request-gate.test.mjs` and `tests/worker-react-router-ci-probe.test.mjs` exercise the adapter, production/Shopify denial, secret rejection, route/host isolation, short-response limits and intentionally incomplete real package probe.

## Explicit remaining work

1. Replace the **CI-only incomplete test build** with a **real React Router server build** from the Cloudflare Vite plugin and run a staging-safe synthetic loader/action E2E.
2. Certify the exact pinned Shopify React Router SDK on Cloudflare Workers, including OAuth / App Bridge ID token and durable Neon session storage.
3. Adapt every merchant route's `../shopify.server` and `../db.server.js` imports away from Node/SQLite or isolate them behind a reviewed request-scoped Worker context. A Web Fetch handler on its own does **not** make those transitive imports edge-safe.
4. Preserve signed webhook verification, paid-only authorization, tenant-row transactional locks and reviewed store/app ownership.
5. Require real Staging Neon Prisma migrations, protected GitHub branch/environments, Cloudflare secret names, HTTPS callback and real store install/authorization tests. Live release and Shopify submission must remain gated.

Cloudflare's official [React Router integration](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) documents `createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE)`, `handler(request,{cloudflare:{env,ctx}})` and Vite plugin bundling. The CI probe uses that **contract**, but intentionally does not include the virtual build module.

**Release impact:** NONE. Do not claim T020 complete or merchant runtime live based on these CI-only tests; task remains IN_REVIEW.
