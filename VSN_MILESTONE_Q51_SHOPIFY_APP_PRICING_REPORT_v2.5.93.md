# VSN Builder v2.5.93 — Milestone Q5.1 Shopify App Pricing Foundation

## Scope

Q5.1 replaces VSN's legacy managed-pricing handoff assumptions with Shopify App Pricing foundations while preserving the existing entitlement model and Developer Mode.

## Implemented

1. Shopify-hosted pricing URL generation from authenticated `*.myshopify.com` store handle + app handle.
2. Optional HTTPS pricing URL override and transitional legacy env fallback.
3. Configurable Shopify plan handles for Core, Pro, CRO and Agency.
4. `plan_handle` return parsing, handle normalization and internal-plan mapping.
5. Authenticated-shop comparison when Shopify returns a `shop` query parameter.
6. Explicit `trustedForEntitlements: false` / pending-verification state.
7. Production local plan changes blocked for every tier, including Core downgrades.
8. Dashboard and legacy Plans UI now open the same Shopify-hosted pricing page without invented `plan` or `interval` query parameters.
9. Production config generator can write the app handle; runtime validation checks App Pricing setup when commercialization is enabled.
10. Developer plan simulation remains intact.

## Deliberately not implemented in Q5.1

- Partner API authentication.
- `activeSubscription` query.
- Live trial/current billing cycle/pending update synchronization.
- Subscription history/events.
- Usage-based App Events.

Those belong to Q5.2+ because a redirect query parameter must never become the production source of truth.

## Database

No Prisma migration.
