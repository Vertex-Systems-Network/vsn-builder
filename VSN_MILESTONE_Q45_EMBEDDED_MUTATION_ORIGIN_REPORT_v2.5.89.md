# VSN Milestone Q.4.5 Embedded Mutation Origin Report

Version: 2.5.89

## Root cause

The Q.2 mutation hardening required `Origin === request.url.origin`. This is not a reliable invariant for an embedded Shopify Admin application running behind Shopify CLI/Cloudflare or another reverse proxy. The guard executed before `authenticate.admin`, so valid merchant actions such as Email Template Create, Page Create and other dashboard mutations were rejected with HTTP 403.

## Fix

`app/utils/request-security.server.js` now derives effective app origins from the public app URL and reverse-proxy headers, recognizes Shopify-controlled Admin origins, and retains hostile cross-site rejection. All modules using the guard were audited and continue to call `authenticate.admin`.

## Regression matrix

The Q.4.5 audit validates same-origin, configured tunnel origin, X-Forwarded origin, standard Forwarded origin, Shopify Admin origin, merchant myshopify origin, malformed/lookalike/hostile origins, Origin-omitted behavior and guarded-action authentication coverage.

No database migration is required.
