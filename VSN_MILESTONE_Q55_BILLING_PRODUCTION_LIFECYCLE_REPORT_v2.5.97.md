# VSN Builder v2.5.97 — Milestone Q.5.5 Billing Production Lifecycle QA

## Scope

Q5.5 completes the planned Shopify billing lifecycle hardening after Q5.1 App Pricing, Q5.2 verified subscription sync, Q5.3 Entitlement Engine 2.0 and Q5.4 merchant-facing lifecycle UX.

## Exact Shopify plan contract

- Free → internal `core` → Shopify handle `free`
- Silver → internal `pro` → Shopify handle `sliver`
- Gold → internal `cro` → Shopify handle `gold`
- Platinum → internal `agency` → Shopify handle `platenium`

The `sliver` and `platenium` spellings are intentionally preserved because they are merchant-configured Shopify keys.

## Authority hardening

`activeSubscription(appId, shopId)` is now the canonical current-plan source. Historical Partner API subscription events are used for lifecycle context such as scheduled cancellation, canceled, frozen and unfrozen states. A historical plan handle can no longer override an active subscription item into a paid entitlement.

Unknown or ambiguous active handles fail closed to Free.

## Partner API recovery

Q5.5 adds bounded retries for temporary failures:

- HTTP 429
- HTTP 500 / 502 / 503 / 504
- retryable GraphQL throttling/service errors
- transient network failures

HTTP 401 and non-retryable authorization errors are not retried. Retry count and backoff are configurable and capped.

## Lifecycle QA matrix

The dedicated Q5.5 audit covers:

- first install without a contract
- verified Free
- Silver
- Gold
- Platinum
- immediate paid upgrade with stale historical event data
- pending upgrade
- pending downgrade
- billing-period-only update
- scheduled cancellation
- effective cancellation
- paid cancellation followed by active Free contract
- frozen paid contract
- unfrozen paid contract
- trial
- unknown/ambiguous active handles
- shop identity mismatch
- Partner API retry/recovery
- uninstall mirror deletion
- reinstall bootstrap from Shopify with no local mirror

## Database

No Prisma migration is added. Q5.5 reuses the Q5.2 subscription mirror schema and preserves the packaged SQLite baseline.

## Security

- Pricing return parameters remain untrusted.
- Partner API credentials remain server-only.
- Production paid access remains fail-closed without a trusted verified mirror.
- Q5.3 remains the server-side feature/quota authorization authority.
- No legacy Billing API subscription create/cancel mutation was added.

## Final QA

- Q5.5 Billing Production Lifecycle: **59/59 PASS**
- Q5.4 Billing Lifecycle UX: **66/66 PASS**
- Q5.3 Entitlement Engine 2.0: **50/50 PASS**
- Q5.2 Verified Subscription Sync: **44/44 PASS**
- Q5.1 Shopify App Pricing Foundation: **42/42 PASS**
- Full historical `npm run qa:release`: **EXIT 0**
- JS/JSX parser: **305 files / 0 blocking syntax errors**
- Capability coverage: **112/112**
- Package integrity: **PASS (166 required files)**
- Codebase health: **0 failures / 0 warnings**
- Shopify production readiness smoke: **20/20 PASS**
- Production runtime configuration smoke: **PASS**
- Q5.4 → Q5.5 packaged SQLite SHA-256 unchanged: `437185d6e6d2df6f4caf778ee3d49e9609d590ba2efbd10c6e79d63983a2ba6a`

The parser continues to report the pre-existing non-blocking remote-image warning in `PropertiesPanel.jsx`. Q5.5 introduces no new blocking parser warning.
