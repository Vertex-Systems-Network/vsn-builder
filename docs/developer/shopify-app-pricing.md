# Shopify App Pricing — Q5.1 foundation

VSN uses **Shopify App Pricing** as the production plan-selection boundary for public App Store billing. The app does not create recurring subscriptions with the legacy Billing API in Q5.

## Hosted pricing page

VSN generates the Shopify-hosted pricing page from the authenticated shop and app handle:

`https://admin.shopify.com/store/<store_handle>/charges/<app_handle>/pricing_plans`

Set `SHOPIFY_APP_HANDLE` to the App Home handle configured for the Shopify app. `SHOPIFY_APP_PRICING_URL` is an optional absolute HTTPS override. `SHOPIFY_MANAGED_PRICING_URL` is retained only as a temporary compatibility fallback.

## Four paid public plans (owner-approved, 2026-10-14)

VSN | Builder is **one public Shopify app**. Development and Staging are internal test environments, not separate App Store listings. No Free plan is offered. Public Shopify plan IDs, displayed plan names, and default handles match **exactly**:

| Public plan / canonical ID / handle | Monthly USD | Annual USD | Shopify free trial |
| --- | ---: | ---: | ---: |
| Starter (`starter`) | $30 | Not offered | 10 days |
| Sliver (`sliver`) | $100 | Not offered | 10 days |
| Gold (`gold`) | $150 | Not offered | 10 days |
| Platinum (`platinum`) | $350 | $3,000 | 10 days |

`Sliver` is the intentional owner-supplied spelling. Previous internal DB keys `core/pro/cro/agency` are backward-compatible aliases only; `free` and an unknown Shopify paid handle never authorize Starter. Subscription-free merchants remain on a no-access `inactive` sentinel until a Shopify-verified trial or paid contract exists.

Environment handle names: `SHOPIFY_APP_PRICING_PLAN_STARTER_HANDLE`, `...SLIVER_HANDLE`, `...GOLD_HANDLE`, `...PLATINUM_HANDLE`. Older SILVER and internal-key env overrides are migration fallbacks, not additional public tiers. Before Live, verify exact handles and prices in the **Shopify Partner Dashboard** and complete a real billing acceptance run.

Shopify App Pricing owns recurring charges and trial accounting; never fake an approved subscription locally in Production. Trial reinstallation limits are governed by Shopify. Do not submit the app while hosted runtime, branch protection, security CI, merchant OAuth, billing smoke or developer audit is blocked.

## Return contract

A Shopify welcome link can point back to `/app?view=pricing`. Shopify appends `plan_handle` and may append `shop`. Q5.1 parses and displays this return signal, validates an included shop parameter against the authenticated session, and maps the handle to the internal VSN plan key.

**Security rule:** `plan_handle` is never enough to grant or remove an entitlement. Query parameters are user-controllable. Q5.2 must query Shopify's Partner API Active Subscription endpoint and only then mirror verified subscription state into VSN.

## Developer Mode

Outside production, `BuilderSubscription` remains a local simulation mechanism. Production actions never upsert plan state locally; every upgrade and downgrade returns the merchant to the Shopify-hosted pricing page.

## Q5.2+ verification

Q5.2 verifies the live contract through the Partner API before production entitlements change. Q5.4 adds merchant-facing lifecycle status, pending-change/cancellation presentation and manual verification recovery. Q5.5 makes `activeSubscription` canonical for current-plan authority and adds bounded Partner API recovery while keeping Shopify App Pricing authoritative.
