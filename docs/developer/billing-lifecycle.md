# Billing Lifecycle UX — Paid-only Shopify App Pricing contract

This document supersedes the historical Free / Silver / Gold / Platinum mapping in pre-October-2026 milestones.

## Public plans and exact Shopify IDs

| Public plan | Canonical ID and Shopify handle | USD monthly | USD yearly | Trial |
| --- | --- | ---: | ---: | --- |
| Starter | `starter` | $30 | — | 10 days |
| Sliver | `sliver` | $100 | — | 10 days |
| Gold | `gold` | $150 | — | 10 days |
| Platinum | `platinum` | $350 | $3,000 | 10 days |

The spelling **Sliver** is an explicit product-owner choice. All four plans are paid; there is no Free public plan. Their public plan IDs and display names match. Historical DB `core/pro/cro/agency` keys are read aliases for `starter/sliver/gold/platinum`; historical Shopify `free` never maps to paid Starter.

## Environment configuration

- `SHOPIFY_APP_PRICING_PLAN_STARTER_HANDLE=starter`
- `SHOPIFY_APP_PRICING_PLAN_SLIVER_HANDLE=sliver`
- `SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE=gold`
- `SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE=platinum`

Older SILVER, CORE, PRO, CRO and AGENCY environment overrides can still be read during migration, but **do not create an extra public plan**. Verify that Live Partner Dashboard uses the canonical handles before publication.

## Subscription lifecycle

Shopify App Pricing is the source of billing authority; the Partner API `activeSubscription` response and shop identity must be verified. Production plan changes occur only on Shopify's hosted plan selection page. URL `plan_handle` query parameters cannot grant access.

Active, trialing, and canceling contracts retain the verified tier until Shopify says otherwise. A trial is valid only when associated with an approved Shopify trial subscription, not merely because the store has been installed for fewer than 10 days. Shopify enforces trial eligibility/reinstallation proration. The UI may display the verified end date and remaining days.

Absent, canceled, frozen, unverifiable, stale, unknown or ambiguous subscriptions fall back to **`inactive`**, a sentinel that grants **zero widgets, zero pages and no paid features**; the merchant can still navigate to Plans & License to subscribe. Existing content must not be deleted on downgrade/cancellation.

Manual `Refresh Shopify status` uses an authenticated server call; it does not create or cancel subscription contracts. `SHOPIFY_PARTNER_API_TOKEN` stays server-only. Staging and Live billing must undergo real acceptance before any App Store submission.

Developer Mode plan simulation is not an authorization mechanism in production. No Live plan configuration, billing smoke or Shopify review submission is certified by this document.
