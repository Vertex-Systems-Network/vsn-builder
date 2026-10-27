# Shopify App Pricing — Q5.1 foundation

VSN uses **Shopify App Pricing** as the production plan-selection boundary for public App Store billing. The app does not create recurring subscriptions with the legacy Billing API in Q5.

## Hosted pricing page

VSN generates the Shopify-hosted pricing page from the authenticated shop and app handle:

`https://admin.shopify.com/store/<store_handle>/charges/<app_handle>/pricing_plans`

Set `SHOPIFY_APP_HANDLE` to the App Home handle configured for the Shopify app. `SHOPIFY_APP_PRICING_URL` is an optional absolute HTTPS override. `SHOPIFY_MANAGED_PRICING_URL` is retained only as a temporary compatibility fallback.

## Eight paid public plans (owner-directed expansion, 2026-10-26)

VSN | Builder is **one public Shopify app**. Development and Staging are internal test environments, not separate App Store listings. No Free plan is offered. Public Shopify plan IDs, displayed plan names, and default handles match **exactly**:

| Public plan / canonical ID / handle | Monthly USD | Annual USD | Shopify free trial |
| --- | ---: | ---: | ---: |
| Starter (`starter`) | $30 | Not offered | 10 days |
| Solo (`solo`) | $60 | Not offered | 10 days |
| Silver (`silver`) | $100 | Not offered | 10 days |
| Gold (`gold`) | $150 | Not offered | 10 days |
| Business (`business`) | $250 | Not offered | 10 days |
| Platinum (`platinum`) | $350 | $3,000 | 10 days |
| Agency (`agency`) | $600 | Not offered | 10 days |
| Scale (`scale`) | $1,000 | Not offered | 10 days |

The earlier four-plan contract is superseded by the owner-directed eight-plan catalog above. The monthly amounts for Solo, Business, Agency and Scale carry forward the previously proposed rates; Shopify Partner publication must be verified before live billing. The retired Shopify handle `sliver` and prior internal keys remain read aliases for Silver or their verified historical contract; `free` and an unknown Shopify paid handle never authorize Starter. Subscription-free merchants remain on a no-access `inactive` sentinel until a Shopify-verified trial or paid contract exists.

Environment handle names: `SHOPIFY_APP_PRICING_PLAN_STARTER_HANDLE`, `...SOLO_HANDLE`, `...SILVER_HANDLE`, `...GOLD_HANDLE`, `...BUSINESS_HANDLE`, `...PLATINUM_HANDLE`, `...AGENCY_HANDLE`, `...SCALE_HANDLE`. `...SLIVER_HANDLE` and legacy internal-key overrides remain migration fallbacks, not additional public tiers. Before Staging or Live billing is enabled, verify all eight exact handles and prices in the **Shopify Partner Dashboard** and complete a real billing acceptance run.

Shopify App Pricing owns recurring charges and trial accounting; never fake an approved subscription locally in Production. Trial reinstallation limits are governed by Shopify. Do not submit the app while hosted runtime, branch protection, security CI, merchant OAuth, billing smoke or developer audit is blocked.

## Return contract

A Shopify welcome link can point back to `/app?view=pricing`. Shopify appends `plan_handle` and may append `shop`. Q5.1 parses and displays this return signal, validates an included shop parameter against the authenticated session, and maps the handle to the internal VSN plan key.

**Security rule:** `plan_handle` is never enough to grant or remove an entitlement. Query parameters are user-controllable. Q5.2 must query Shopify's Partner API Active Subscription endpoint and only then mirror verified subscription state into VSN.

## Developer Mode

Outside production, `BuilderSubscription` remains a local simulation mechanism. Production actions never upsert plan state locally; every upgrade and downgrade returns the merchant to the Shopify-hosted pricing page.

## Q5.2+ verification

Q5.2 verifies the live contract through the Partner API before production entitlements change. Q5.4 adds merchant-facing lifecycle status, pending-change/cancellation presentation and manual verification recovery. Q5.5 makes `activeSubscription` canonical for current-plan authority and adds bounded Partner API recovery while keeping Shopify App Pricing authoritative.
