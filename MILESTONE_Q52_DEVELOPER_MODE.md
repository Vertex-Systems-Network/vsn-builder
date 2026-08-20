# Milestone Q.5.2 — Developer Mode

VSN Builder v2.5.94 keeps Developer Mode as the default local/testing posture while adding the production subscription-verification path.

- Local development does **not** call the Shopify Partner API unless `VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT=true` is explicitly set.
- Existing local Core / Pro / CRO / Agency simulation remains available for development stores.
- Production entitlements no longer trust local plan rows. A paid tier is authoritative only when the local mirror was verified from Shopify App Pricing and is within the configured stale window.
- `plan_handle` redirect parameters remain a trigger for forced verification only; they never grant an entitlement directly.
- Partner API access tokens remain server-side and are never returned to the browser.
- This milestone adds one additive Prisma migration for subscription mirror metadata. It does not delete or reset merchant data.
- Do not enable production commercialization until the Partner API client has the required Shopify Partner permissions and the production environment variables are configured.
