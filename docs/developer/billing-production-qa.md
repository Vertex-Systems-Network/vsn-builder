# Billing Production Lifecycle QA — Paid-only Q5.5 contract

The current eight-tier catalog is **Starter ($30), Solo ($60), Silver ($100), Gold ($150), Business ($250), Platinum ($350 or $3,000/year), Agency ($600), and Scale ($1,000) per month**. Each has a **10-day Shopify-managed trial**. Handles match the lowercase plan names. The retired `sliver` handle remains a Silver compatibility alias. No Free plan is offered. Confirm all eight offers in Shopify Partner before live billing.

## Authority rules

1. Only the Shopify Partner API `activeSubscription(appId, shopId)`, verified for the authenticated store, can grant a paid entitlement or trial.
2. Historical subscription events never override the current active plan item.
3. Unknown, ambiguous, Free (retired handle), canceled, frozen and expired/untrusted states fail closed to `inactive` with zero entitlement quota.
4. Pending cancellation retains the paid tier until the verified effective end, then transitions to `inactive`.
5. Shopify pricing-return URL parameters remain untrusted.
6. Historical local `core/pro/cro/agency` rows are migration aliases; remap and verify real Partner handles before using them.
7. Silver and Platinum use canonical keys/handles `silver` and `platinum`; retired `sliver` and `platenium` Shopify handles normalize to Silver and Platinum respectively during verified subscription migration.

## Acceptance matrix

QA covers first install with no contract, each verified paid tier, 10-day trial, Platinum yearly billing, upgrade/downgrade, cancellation scheduling/effective date, frozen/unfrozen, stale/unknown handles, Shopify shop identity mismatch, retryable 429/5xx errors, bounded retries and reinstall after session cleanup.

The app-uninstalled lifecycle deletes VSN-owned merchant data and its local `BuilderSubscription` mirror. On reinstall it must re-query Shopify; a cached row is never commercial authority.

**Reinstall verification:** Treat `BuilderSubscription` as a non-authoritative mirror. After any uninstall and reinstall, authenticate a fresh official Shopify session, query the current `activeSubscription` for the same verified Shopify shop/app identity, and persist new authority only after successful Partner verification. Never revive paid access from the prior deleted mirror or a historical webhook. Test canceled, trialing, mismatched shop/app identity and changed `plan_handle` cases before acceptance.

```env
SHOPIFY_PARTNER_API_TIMEOUT_MS=8000
SHOPIFY_PARTNER_API_RETRY_COUNT=2
SHOPIFY_PARTNER_API_RETRY_BASE_MS=250
```

A green synthetic QA result does not certify real billing. Live release requires a working hosted app, Shopify Partner API access, actual protected billing/merchant E2E, all mandatory security audits and reviewed promotion from Staging. Only the single **VSN | Builder** Live application will be offered for App Store review; Development/Staging are internal.
