# Billing Production Lifecycle QA — Q5.5

Q5.5 is the production-lifecycle hardening layer for Shopify App Pricing. It keeps the merchant-facing plan names **Free / Silver / Gold / Platinum** while preserving the exact Shopify handles `free`, `sliver`, `gold`, and `platenium`.

## Authority rules

1. `activeSubscription(appId, shopId)` is the canonical current contract.
2. Historical subscription events provide lifecycle context such as scheduled cancellation, frozen, canceled, and unfrozen.
3. A historical plan handle never overrides an active contract handle.
4. Unknown or ambiguous active handles fail closed to Free.
5. Shopify pricing-return query parameters remain untrusted until Partner API verification succeeds.

## Lifecycle matrix locked by Q5.5

The dedicated `qa:q55` suite exercises:

- first install with no active contract → Free / inactive
- verified Free contract (`free`)
- Silver (`sliver`)
- immediate Silver → Gold upgrade
- Platinum (`platenium`)
- pending Platinum → Gold downgrade
- billing-period-only pending update
- scheduled cancellation while paid access remains active
- cancellation effective → Free
- paid contract canceled followed by active Free contract
- frozen paid subscription → Free fail-closed
- unfrozen paid subscription → paid entitlement restored
- trial subscription
- unknown and ambiguous active plan handles → Free fail-closed
- store identity mismatch rejection
- temporary Partner API `429` retry and recovery
- retryable GraphQL throttling recovery
- non-retryable `401` failure
- reinstall bootstrap after the local subscription mirror was deleted

## Reinstall behavior

The app-uninstalled lifecycle deletes VSN-owned merchant data, including the local `BuilderSubscription` mirror and stored sessions. On reinstall, the authenticated app shell has no local billing row, so subscription sync cannot use a fresh-cache shortcut and must rebuild the mirror from Shopify's Partner API. The local mirror is therefore disposable; it is never the commercial source of truth.

## Retry controls

```env
SHOPIFY_PARTNER_API_TIMEOUT_MS=8000
SHOPIFY_PARTNER_API_RETRY_COUNT=2
SHOPIFY_PARTNER_API_RETRY_BASE_MS=250
```

Retries are bounded to protect request latency. `Retry-After` is honored for HTTP 429 when available (with a short safety cap). Partner credentials remain server-only.

## Production gate

Q5.5 does not create or cancel Shopify billing contracts. Merchant plan management stays on Shopify App Pricing. The release gate validates the lifecycle matrix with deterministic mocked Partner API responses; a real Partner API smoke still requires the deployment's own Partner organization token and an eligible test/development store.
