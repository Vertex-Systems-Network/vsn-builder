# Local Cloudflare Workerd React SSR acceptance (CI only)

This stacked change builds on [PR #120](https://github.com/Vertex-Systems-Network/vsn-builder/pull/120) and uses only the existing loopback-restricted `wrangler dev --local` probe. A real Cloudflare workerd now calls the existing `renderWorkerDocument` React Web Streams renderer, consumes rendered HTML, and checks CSP, HTML content type, nosniff and no-store headers. Two negative runtime probes verify that an omitted Shopify security-header callback and a CSP without `frame-ancestors` are rejected before rendering.

The authorization/CSP callback is **synthetic test data**. It does not authenticate a Shopify merchant or prove actual Shopify SDK security headers were wired into deployed routes. Local runtime still returns HTTP 503 on `/app`. Neither production source nor environment credentials are used, and no Worker is deployed. Cloudflare Staging and Production already have separately named placeholder scripts and Neon projects, but this test does not check live connection, migrations, merchant OAuth, billing or real Worker routing.

## Acceptance

- `VSN Cloudflare Workerd Local SDK Compatibility (No Deploy)` must be successful on this exact branch head and verify `reactWebStreamRendered`, `missingShopifyCspCallbackBlocked`, and `missingFrameAncestorsBlocked`.
- Real `/app` must remain blocked with HTTP 503; no secret, hosted database or Cloudflare API must be used during CI.
- Full Production Confidence remains gated by [issue #96](https://github.com/Vertex-Systems-Network/vsn-builder/issues/96) and must not be relabeled green while the full dev dependency audit fails.

## Next unverified integration

Create a **nondeployable** real React Router request-handler smoke test in local workerd with synthetic route data and security-header injection. Do not deploy to Staging until Shopify authentication, app installation, actual PostgreSQL connectivity, schema migration, secret isolation, and release/rollback gates have real evidence.
