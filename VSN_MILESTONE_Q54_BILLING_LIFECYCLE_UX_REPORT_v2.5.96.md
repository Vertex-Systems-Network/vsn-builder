# VSN Builder v2.5.96 — Milestone Q.5.4 Billing Lifecycle UX

## Scope
Q5.4 completes the merchant-facing Plans & License lifecycle on top of Shopify App Pricing, verified Partner API subscription sync and Entitlement Engine 2.0.

## Shopify plan mapping
The store's four Shopify plans are now the default billing contract:

- Free → internal `core` → Shopify handle `free`
- Silver → internal `pro` → Shopify handle `sliver`
- Gold → internal `cro` → Shopify handle `gold`
- Platinum → internal `agency` → Shopify handle `platenium`

The external handle spellings are preserved exactly. Stable internal IDs are intentionally retained for backward compatibility.

## Billing lifecycle UX
Plans & License now presents active/trial/canceling/frozen/canceled/inactive/developer states, billing period, current cycle, trial remaining time, pending upgrade/downgrade, pending billing-period changes, cancellation effective date, verification timestamp and verification warnings.

## Recovery & permissions
A server-backed `billing-refresh` action is available from the dashboard and Plans route. It requires billing-view permission and forces Partner API verification. Billing changes remain restricted to billing-manage permission and Shopify's hosted pricing page.

## Cache migration safety
Fresh Q5.2 cache rows are reused only when their stored Shopify handle maps to their stored internal plan using the current handle configuration. Older `core/pro/cro/agency` cached handles therefore trigger re-verification under the new Free/Silver/Gold/Platinum mapping instead of persisting a false Free fallback.

## Compatibility
Public environment variables were added for Free/Silver/Gold/Platinum plan handles while the old CORE/PRO/CRO/AGENCY environment names remain accepted. Public variables take precedence.

## Database
No Prisma migration. The Q5.2 BuilderSubscription mirror schema is reused unchanged.

## Security
Q5.4 does not trust redirect parameters, does not expose Partner API secrets, does not create Shopify Billing API subscriptions and does not weaken Q5.3 server-side entitlement enforcement.

## Final QA

- Q5.4 Billing Lifecycle UX audit: 66/66 PASS
- Q5.3 Entitlement Engine regression: 50/50 PASS
- Q5.2 Verified Subscription Sync regression: 44/44 PASS
- Q5.1 Shopify App Pricing regression: 42/42 PASS
- Phase 16 Commercialization regression: 69/69 PASS
- Full `npm run qa:release`: EXIT 0
- JS/JSX parser: 305 files, 0 blocking syntax errors
- Capability coverage: 112/112
- Codebase health: 0 failures / 0 warnings
- Package integrity: PASS
- Production runtime configuration smoke: PASS
- Generated Shopify production configuration readiness: 20/20 PASS
- Packaged SQLite baseline unchanged from v2.5.95

The parser continues to report the pre-existing non-blocking remote-image warning in `PropertiesPanel.jsx`; Q5.4 introduces no new blocking warning.
