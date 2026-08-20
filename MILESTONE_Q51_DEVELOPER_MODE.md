# Milestone Q5.1 — Developer Mode

Version: 2.5.93

Q5.1 introduces the Shopify App Pricing boundary without activating real charges from local development code.

- Developer Mode keeps local Core/Pro/CRO/Agency simulation.
- Production plan changes never mutate `BuilderSubscription` directly.
- Production opens Shopify's hosted App Pricing page.
- `plan_handle` is parsed only as an unverified return signal.
- No Billing API subscription mutation is introduced.
- No Prisma migration is required.
- Q5.2 is responsible for live Partner API verification before production entitlements change.
