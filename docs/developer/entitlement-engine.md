# Entitlement Engine 2.0

## Purpose
All commercial feature and capacity decisions must use the Q5.3 entitlement service. Do not add new route-local `plan.key`, `planAtLeast`, or `quotaAllows` enforcement for paid functionality.

## Definitions
Features live in `app/config/entitlements.js` under `ENTITLEMENT_FEATURES`. Capacity limits live under `ENTITLEMENT_QUOTAS`. Each definition maps to a field in `COMMERCIAL_PLANS` and declares its minimum plan.

## Server API
- `resolveEntitlementPlan(db, shop)` — authoritative current plan.
- `getFeatureDecision(db, shop, key)` — included/not-included feature decision.
- `getQuotaDecision(db, shop, key, options)` — current usage, limit, remaining and reset information.
- `getMinimumPlanDecision(db, shop, requiredPlan)` — tier requirement for catalog items or variable-plan resources.
- `requireEntitlementFeature` / `requireEntitlementQuota` — throwing mutation guards.
- `getEntitlementSnapshot` / `serializeEntitlementSnapshot` — shared server/UI state.

Every decision includes a stable code, allowed flag, plan/source/verification metadata and a user-facing message when denied.

## Paid-only storefront subscription contract (2026-10-14)

There are four merchant-visible IDs: `starter`, `sliver`, `gold`, `platinum`. `Sliver` is the owner's spelling. The previous `core`, `pro`, `cro`, `agency` strings are read aliases for migration; they must never be written to new merchant subscriptions. The old Shopify `free` handle is **not** a paid Starter contract. Unknown or canceled/frozen/unverified subscriptions produce `UNSUBSCRIBED_PLAN` (`inactive`) with no features and zero quotas; a verified Shopify trial enables the purchased plan only. All server-side mutation routes must continue enforcing entitlement checks; a display-only lock does not secure a mutation endpoint. No live merchant acceptance has been performed.

## Production rule
In production, only the trusted Shopify App Pricing mirror from Q5.2 may grant a paid plan. `VSN_DEFAULT_PLAN` is development-only. If verification is absent or no longer trusted, authority fails closed to the no-access `inactive` sentinel. Starter must never be granted without an active, verified Shopify contract.

## Usage counters
Usage must be stable commercial state, not transient UI/runtime activity. Collaboration seats therefore count the owner plus persisted role assignments, not browser presence rows. Monthly AI usage uses a UTC month boundary.

## Route enforcement
A disabled button is not authorization. The action/loader that changes or exposes a paid resource must independently call the entitlement service after Shopify authentication and any applicable role permission check.

## Adding a new paid capability
1. Add a plan field if one does not exist.
2. Add a named feature or quota definition.
3. Add stable usage counting for a quota.
4. Enforce it server-side at every mutation/exposure boundary.
5. Expose the decision through the shared entitlement snapshot when UI state needs it.
6. Add Q5.3-style regression coverage.
