# Billing Lifecycle UX — Q5.4

Q5.4 is the merchant-facing billing lifecycle layer on top of Q5.1 Shopify App Pricing, Q5.2 verified Partner API subscription sync, and Q5.3 Entitlement Engine 2.0.

## Public plans and exact Shopify handles

Merchant-facing plan names are:

| Public plan | Stable internal ID | Default Shopify plan handle |
| --- | --- | --- |
| Free | `core` | `free` |
| Silver | `pro` | `sliver` |
| Gold | `cro` | `gold` |
| Platinum | `agency` | `platenium` |

The Shopify handle spellings are intentional and must match Shopify exactly. Q5.4 does not rename `sliver` to `silver` or `platenium` to `platinum` at the billing boundary.

The stable internal IDs remain unchanged to preserve database history, entitlement definitions, marketplace gates, developer integrations and previous migrations.

## Environment variables

Preferred public plan variables:

- `SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE=free`
- `SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE=sliver`
- `SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE=gold`
- `SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE=platenium`

Legacy `CORE/PRO/CRO/AGENCY` handle variables remain accepted for existing deployments. Public plan variables take precedence.

## Lifecycle states

`app/config/billingLifecycle.js` converts the verified subscription mirror into a merchant-readable lifecycle:

- Active
- Trial
- Cancellation scheduled
- Frozen
- Canceled
- No active subscription
- Developer simulation

The UI also exposes:

- billing period
- current billing-cycle start/end
- trial end and days remaining
- pending upgrade/downgrade
- pending billing-period change
- scheduled cancellation effective date
- current and pending Shopify handles
- last successful verification
- last verification warning

## Recovery

Production Plans & License surfaces include **Refresh Shopify status**. This performs a server-authenticated Partner API sync and never grants billing-change permission.

The refresh action requires billing-view permission. Plan changes still require billing-manage permission and continue through Shopify's hosted App Pricing page.

## Cache remap safety

Q5.2 used a bounded verified subscription cache. Q5.4 adds a handle-compatibility check before reusing that cache. Active/trial/canceling mirrors are reused only when their stored Shopify handle still maps to their current internal plan under the current configuration.

This protects upgrades from older VSN defaults (`core/pro/cro/agency`) when the real Shopify handles are `free/sliver/gold/platenium`: a mismatched fresh cache is re-verified instead of incorrectly persisting a Free fallback.

Inactive, canceled and frozen mirrors remain safely reusable because those states fail closed to Free.

## Security boundaries

- `plan_handle` return parameters remain untrusted.
- Partner API credentials remain server-only.
- Manual refresh never creates/cancels a Shopify subscription.
- Production paid access still requires the trusted Q5.2 mirror.
- Q5.3 server-side entitlements remain the authorization authority.
- Q5.4 adds no Prisma migration.
