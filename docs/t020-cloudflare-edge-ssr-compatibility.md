# T020 — Cloudflare Edge Streaming SSR Compatibility (2026-10-14)

This engineering batch is **only the first slice of T020**: a native **Web Streams React HTML rendering adapter** and an isolated Cloudflare Worker compile test, not a functional Shopify Builder merchant application.

## Architecture evidence

The existing Local/Node server uses `app/entry.server.jsx` (`PassThrough`, `renderToPipeableStream`, `@react-router/node`) and `app/shopify.server.js` (Shopify's Node adapter and Node/SQLite Prisma storage). It cannot be moved unchanged into Cloudflare and called production-ready.

Cloudflare's 2026 [React Router guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) documents the Cloudflare Vite plugin, `createRequestHandler`, the `virtual:react-router/server-build` module and `context.cloudflare` bindings. VSN Builder still has no edge-ready full React Router build, scoped Shopify SDK app context, persistent Neon-backed React Router route services, or authenticated OAuth callback runtime.

- `app/services/worker-edge-html.server.js`: independently testable Web Streams React renderer, no Node PassThrough; requires pre-existing Shopify SDK `frame-ancestors` CSP for any merchant `/app` document, retains that CSP, removes stale content-length, disables caching and fails closed on renderer exceptions. This renderer **does not authenticate merchants**.
- `app/entry.worker.js`: isolated `ServerRouter` Web Streams entry candidate. It is **not wired to the Worker route graph** and has no standalone merchant privileges.
- `workers/edge-ssr-probe.js`: deliberately CI-only Worker; renders one static test document under `/__vsn/edge-ssr-smoke` only with `APP_ENV=test` and `VSN_BUILD_INTENT=edge-ssr-ci`, **not** any `/app`, `/auth` or billing request.
- `wrangler.edge-ssr-ci.jsonc`: no secrets, no public Worker subdomain, distinct CI-only Worker name; Wrangler is run with `--dry-run` and never deploys.
- `tests/worker-edge-html.test.mjs`, `tests/worker-edge-ssr-probe.test.mjs`: React HTML, CSP denial, missing/invalid requests, bot `allReady`, stream failure response and exact test-only Worker gates.

## Shopify framework limitation

An April 2026 upstream Shopify request documents that `@shopify/shopify-app-react-router` was shipping a Node wrapper rather than a first-party Cloudflare wrapper at the time: [Shopify shopify-app-js #3161](https://github.com/Shopify/shopify-app-js/issues/3161). The lower Shopify API package already has an edge adapter, but this is **not evidence** that our deployed application has been tested for Shopify OAuth/App Bridge/Prisma. Before activation, verify the actual pinned installed SDK's edge adapter behavior and package compatibility against official documentation, without inventing an import path.

## Remaining acceptance for T020

1. Adopt a reviewed Cloudflare-supported Vite/React Router Worker build that bundles the **complete merchant route graph**, and prove compilation without Node SSR/SQLite imports.
2. Integrate **official Shopify Admin request/ID token and OAuth** verification in that Cloudflare runtime, and safe persistent `PrismaNeon` session storage; no query-string shop trust or unverified plan.
3. Propagate an authenticated app context to loaders/actions; every merchant mutation must preserve paid subscription guard, tenant isolation and rollback.
4. Verify the browser/client asset build, Shopify CSP/iframe behavior, and exact Staging origin/secret bindings with real test-store E2E.
5. Keep both existing production/staging merchant endpoints **HTTP 503** until those steps are proven. **No Live deployment, billing, or Shopify submission.**

Passing the CI-only SSR module and Wrangler dry-run may be reported as a **T020 subtask**, never T020 completion.
