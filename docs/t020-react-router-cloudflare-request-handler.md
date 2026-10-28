# T020 — Cloudflare React Router Fetch gateway (CI-only)

**2026-10-14.** This is the next isolated development slice after [edge Web Streams HTML SSR](t020-cloudflare-edge-ssr-compatibility.md). It does **not** install or activate a Shopify application.

## Implemented

- `app/services/worker-react-router-request-gate.js` adapts a `Request`, a Worker environment and an execution context into React Router's documented `createRequestHandler(loadServerBuild, "production")` signature, then `handler(request,{cloudflare:{env,ctx}})`.
- The gateway **only** accepts `APP_ENV=test`, `VSN_BUILD_INTENT=react-router-ci`, no third key/secret, a loopback or exact `vsn-edge.test` hostname, GET `/__vsn/react-router-smoke` with no query, cookies, Shopify headers or Authorization. All `/app`, `/auth`, `/webhooks`, billing and production traffic is locked; no caller can promote a merchant route via an environment flag.
- A synthetic React Router handler contract is unit-tested with strict response/cookie/header sanitization, 64 KiB maximum response, read deadline, error suppression, and no Worker secrets passed to the framework. A separate real React Router resource-loader fixture gives positive route dispatch evidence.
- `workers/edge-react-router-ci-probe.js` imports **the real React Router `createRequestHandler` package** so Wrangler dry-run compiles the runtime dependency, and loads **one synthetic resource route** from `workers/edge-react-router-ci-build.js`. CI verifies the real React Router handler dispatches its loader and generates a sanitized HTML response. It has no merchant routes and is **not a Cloudflare Vite-built full Builder application**.
- The CI-only `wrangler.edge-router-ci.jsonc` is explicitly named `vsn-builder-react-router-ci`, has no secrets, `workers_dev:false`, no preview URL, and can only be compiled using `wrangler deploy --dry-run`.
- `tests/worker-react-router-request-gate.test.mjs` and `tests/worker-react-router-ci-probe.test.mjs` exercise the adapter, production/Shopify denial, secret rejection, route/host isolation, short-response limits and real synthetic resource loader execution under the official React Router handler.

## Explicit remaining work

1. Replace the **CI-only, manually constructed one-route ServerBuild** with a **Vite-generated complete React Router server build** using the Cloudflare plugin; run Staging-safe loader/action E2E with real platform bindings and authentication.
2. Certify the exact pinned Shopify React Router SDK on Cloudflare Workers, including OAuth / App Bridge ID token and durable Neon session storage.
3. Adapt every merchant route's `../shopify.server` and `../db.server.js` imports away from Node/SQLite or isolate them behind a reviewed request-scoped Worker context. A Web Fetch handler on its own does **not** make those transitive imports edge-safe.
4. Preserve signed webhook verification, paid-only authorization, tenant-row transactional locks and reviewed store/app ownership.
5. Require real Staging Neon Prisma migrations, protected GitHub branch/environments, Cloudflare secret names, HTTPS callback and real store install/authorization tests. Live release and Shopify submission must remain gated.

Cloudflare's official [React Router integration](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) documents `createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE)`, `handler(request,{cloudflare:{env,ctx}})` and Vite plugin bundling. The CI probe uses that **contract**, but intentionally does not include the virtual build module.

**Release impact:** NONE. Do not claim T020 complete or merchant runtime live based on these CI-only tests; task remains IN_REVIEW.
