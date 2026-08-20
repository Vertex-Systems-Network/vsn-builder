# VSN Milestone Q.5.2 — Verified Shopify Subscription Sync

**Version:** 2.5.94  
**Date:** 2026-08-09  
**Baseline:** v2.5.93 / Q.5.1 Shopify App Pricing Foundation

## Delivered

- Added a server-only Shopify Partner API subscription verification service.
- Resolves the authenticated app/shop GIDs before every uncached Partner verification.
- Combines `activeSubscription` and subscription lifecycle historical events in one Partner API request.
- Maps Shopify App Pricing item/plan handles to Core, Pro, CRO and Agency.
- Handles active, trialing, cancellation scheduled, canceled, frozen, unfrozen and inactive/no-contract states.
- Mirrors billing period, current cycle, pending update, cancellation date, legacy subscription ID and verification diagnostics into `BuilderSubscription`.
- Treats redirect `plan_handle` only as a forced-sync signal, never as entitlement authority.
- Fails closed to Core for inactive, canceled, frozen, unknown-plan and over-stale mirrors.
- Keeps a bounded stale grace window for a previously verified paid contract during temporary Partner API failures.
- Deduplicates concurrent per-shop syncs and caches successful verification for a short TTL.
- Keeps Partner credentials server-only and sends a redacted sync configuration to UI routes.
- Adds one additive Prisma migration; the packaged development database was migrated without resetting existing data.
- Preserves Developer Mode plan simulation and disables live Partner API sync in development unless explicitly opted in.

## Production configuration

Required when commercialization is enabled:

- `SHOPIFY_PARTNER_ORGANIZATION_ID`
- `SHOPIFY_PARTNER_API_TOKEN`
- `SHOPIFY_PARTNER_API_VERSION` (default `2026-07`)
- Shopify App Pricing app/plan handles from Q.5.1

The Partner API client must be allowed to read the app's subscription data.

## Security posture

- No `appSubscriptionCreate` mutation was added.
- The Partner API token is never serialized to the browser.
- Authenticated-shop identity is checked against Admin API and Partner API shop data.
- Unknown handles cannot elevate a merchant to a paid VSN tier.
- Frozen/canceled/no-contract states cannot retain a paid entitlement after successful verification.

## QA snapshot

- Q5.2 subscription sync audit: **42/42 PASS**
- Q5.1 App Pricing regression: **41/41 PASS**
- Phase 16 commercialization regression: **69/69 PASS**
- Milestone O ecosystem/documentation audit: **41/41 PASS**
- Full `npm run qa:release`: **exit 0**
- JS/JSX parser: **301 files, 0 blocking syntax errors**
- Codebase health: **0 failures / 0 warnings**
- Package integrity: **PASS**
- Production runtime configuration smoke: **PASS**
- Production Shopify TOML generation smoke: **PASS**
- Q5.2 SQLite migration baseline/checksum/index verification: **PASS**

The existing non-blocking remote-image warning in `PropertiesPanel.jsx` remains unrelated to billing.
