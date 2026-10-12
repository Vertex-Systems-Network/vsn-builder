# Worker SSR bridge — first Web Streams contract (no deployment)

Cloudflare's React Router workflow needs Web Fetch `Request`/`Response` and Web Streams, not Node's `stream.PassThrough` and `renderToPipeableStream`. A separate `renderWorkerDocument` uses React 18's `renderToReadableStream`, sets basic security headers, and preserves Shopify's embedding CSP **only through an explicitly required `addShopifyHeaders` callback**; missing/incorrect CSP is a hard failure.

`workers/worker-ssr-bridge.js` constructs React Router's `ServerRouter` for a later Cloudflare-compiled route bundle, but intentionally does not replace `app/entry.server.jsx`, import the existing Node Shopify adapter, create a Worker fetch handler, or enable any app release. The Node/SQLite Local runtime remains identical.

**Unresolved:** Cloudflare Vite plugin and framework bundle, Worker `fetch` adapter, Shopify's Node-to-Cloudflare platform adapter and signed session, per-request Cloudflare environment binding, Workers-compatible R2/file integrations, production-appropriate CSP, actual Worker bundle/routing and runtime tests. The existing `scripts/environment-contract.mjs` rightly blocks hosted promotion until these are complete.

This PR is independently tested with actual React 18 browser-style streaming in Node 22, using synthetic markup only and no Cloudflare/Neon/Shopify network or secrets.
