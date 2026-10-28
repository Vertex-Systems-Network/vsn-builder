# Real Shopify SDK CSP inside local Cloudflare workerd (no deploy)

## Test scope

This stacked test builds on [PR #122](https://github.com/Vertex-Systems-Network/vsn-builder/pull/122). The CI-only loopback Worker now calls `createWorkerShopifySdkContext` with synthetic Staging credentials, an injected in-memory Shopify session storage interface, and a `Request` bearing a synthetic `ci-merchant.myshopify.com` shop query. Unlike the earlier synthetic CSP callback, it passes **the real pinned Shopify React Router SDK's `addDocumentResponseHeaders` callback** to the existing React Web Streams SSR bridge inside real local Cloudflare workerd. It checks the streamed HTML and that the actual SDK's `frame-ancestors` includes both the synthetic merchant and Shopify Admin.

The test verifies the fake storage context is closed, and that a mismatched Production Neon URL is rejected **before** invoking any session-storage factory even when the other Staging identity variables are correct.

## Explicit boundaries

- This is a **test-only** Worker: the only accessible route is a CI loopback probe; `/app` still returns HTTP 503.
- No real Shopify credentials, OAuth, merchant session, Shopify API request, Neon query, cloud secret or hosted Worker deployment are used. All Shopify session callbacks are synthetic and storage-independent.
- Using the real Shopify SDK's response-header routine is not evidence of signed merchant authentication, billing, real webhook delivery or a deployed app. Those must be tested separately.
- Full Production Confidence remains release-blocked by issue #96's development dependency audit. The isolated Workerd test must not bypass or replace the existing release gate.

## Required evidence

The exact PR head's read-only `VSN Cloudflare Workerd Local SDK Compatibility (No Deploy)` run must PASS including `realShopifySdkCspRendered`, `shopifySdkSessionClosed` and `wrongProjectUrlDeniedBeforeSdkStorage`. If these fail, keep the PR open until the real runtime issue is repaired. No Staging or Live deployment is authorized by this test.
