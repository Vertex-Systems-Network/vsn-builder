# Signed Shopify uninstall webhook acceptance in local workerd — no deploy

This checkpoint extends [PR #123](https://github.com/Vertex-Systems-Network/vsn-builder/pull/123) and invokes the actual pinned Shopify React Router SDK's `authenticate.webhook` inside local Cloudflare **workerd** (not Node). The request body is signed with synthetic HMAC-SHA256 test data using WebCrypto.

The Workerd CI-only Worker feeds that signed request through the existing application `acceptWorkerShopifyUninstallWebhook` gate, which independently verifies WebCrypto HMAC before opening the synthetic request-scoped Shopify SDK context, then relies on the **official SDK to verify the same signed webhook**. An injected non-network `onVerified` callback checks the topic, merchant and webhook ID. Session-context initialization and closure are counted.

The negative case sends a tampered body with the original signature and asserts HTTP 401, **zero additional storage initializations** and no callback invocation. This proves the authentication boundary under real local Worker APIs but does **not** prove production webhook delivery, a genuine merchant installation, a Neon database, a deployed app, actual customer-data cleanup, or durable webhook idempotency.

All credentials are synthetic. No secrets or network calls. The workerd probe only responds to loopback CI GET; `/app` is still HTTP 503; no hosted Worker is deployed. Full Production Confidence remains blocked by dependency audit issue #96, so this narrower CI does not justify merge or production promotion.