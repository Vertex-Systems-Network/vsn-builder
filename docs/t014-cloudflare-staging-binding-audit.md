# T014/T019 — Cloudflare Staging binding audit (not deploy-ready)

2026-10-15 — Verified with Cloudflare read-only control-plane APIs:

- Intended Worker: vsn-builder-staging (exists).
- Actual bound secrets: **zero**. Actual Worker settings bindings: **zero**.
- workers.dev and Worker preview URLs are both **disabled**. One earlier deployment exists but it does not establish hosted merchant readiness.
- Source development branch still unprotected; protected GitHub Environment reviewers and secret configuration are not independently verified.
- Default Neon Staging database still has **zero application tables** and **zero Prisma migration tables**.

## Required Staging-only binding contract

| Binding | Secure type and requirement |
| --- | --- |
| DATABASE_URL | Encrypted secret; actual isolated Staging Neon target and TLS validated by runtime |
| SHOPIFY_API_KEY | Encrypted secret; dedicated Staging Partner app ownership independently required |
| SHOPIFY_API_SECRET | Encrypted secret, never printed |
| APP_ENV | Plain-text staging |
| VSN_WORKER_NAME | Plain-text vsn-builder-staging |
| NEON_PROJECT_ID | Plain-text shiny-violet-61219572 |
| SHOPIFY_BILLING_TEST_MODE | Plain-text true |
| SHOPIFY_APP_URL | Stable verified HTTPS origin; no temporary host |
| SCOPES | Exact approved Shopify scopes declared in source config |

Never expose DIRECT_URL, Cloudflare API management tokens, or development-only identities as Worker bindings. Production and Staging Shopify app client IDs must be distinct.

## Verification and remaining actions

The committed script scripts/t014-staging-worker-bindings.mjs audits BOTH Cloudflare Worker settings and Worker secrets metadata using **GET requests only**. It prints names/status codes, never secret values. Tests/t014-staging-worker-bindings.test.mjs contains 8 adversarial tests including actual observed zero-binding failure, plaintext secret rejection and cross-environment safeguards.

PR CI runs token-free tests. A separate manually invoked workflow may read Cloudflare configuration only after GitHub confirms protected development source and selects cloudflare-staging Environment. Manual protected run is currently blocked because development is unprotected.

Remaining before T014 or T019 can be Final Closed: protect development, configure GitHub Environment required reviewers and isolated variables/secrets; attest dedicated Shopify Staging client; configure Cloudflare encrypted secrets and Worker variables through an approved protected change; perform Neon protected migrations with recovery evidence; verify actual HTTPS callback, SDK and merchant E2E.

Nothing in this audit writes Cloudflare settings, enables public URLs, deploys, mutates Shopify/Neon or submits the app.
