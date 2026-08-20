# Shopify App Pricing — Q5.1 foundation

VSN uses **Shopify App Pricing** as the production plan-selection boundary for public App Store billing. The app does not create recurring subscriptions with the legacy Billing API in Q5.

## Hosted pricing page

VSN generates the Shopify-hosted pricing page from the authenticated shop and app handle:

`https://admin.shopify.com/store/<store_handle>/charges/<app_handle>/pricing_plans`

Set `SHOPIFY_APP_HANDLE` to the App Home handle configured for the Shopify app. `SHOPIFY_APP_PRICING_URL` is an optional absolute HTTPS override. `SHOPIFY_MANAGED_PRICING_URL` is retained only as a temporary compatibility fallback.

## Plan handles

Configure the Partner Dashboard plan handles to match the VSN mapping, or override them with:

- `SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE=free`
- `SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE=sliver`
- `SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE=gold`
- `SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE=platenium`

VSN intentionally preserves the Shopify handle spellings exactly as configured. The merchant-facing names are Free, Silver, Gold and Platinum, while the stable internal entitlement IDs remain `core`, `pro`, `cro` and `agency` for backward compatibility. Legacy `...CORE/PRO/CRO/AGENCY_HANDLE` environment names are still accepted, but the public plan env names above take precedence.

The default Shopify handles are `free`, `sliver`, `gold`, and `platenium`.

## Return contract

A Shopify welcome link can point back to `/app?view=pricing`. Shopify appends `plan_handle` and may append `shop`. Q5.1 parses and displays this return signal, validates an included shop parameter against the authenticated session, and maps the handle to the internal VSN plan key.

**Security rule:** `plan_handle` is never enough to grant or remove an entitlement. Query parameters are user-controllable. Q5.2 must query Shopify's Partner API Active Subscription endpoint and only then mirror verified subscription state into VSN.

## Developer Mode

Outside production, `BuilderSubscription` remains a local simulation mechanism. Production actions never upsert plan state locally; every upgrade and downgrade returns the merchant to the Shopify-hosted pricing page.

## Q5.2+ verification

Q5.2 verifies the live contract through the Partner API before production entitlements change. Q5.4 adds merchant-facing lifecycle status, pending-change/cancellation presentation and manual verification recovery. Q5.5 makes `activeSubscription` canonical for current-plan authority and adds bounded Partner API recovery while keeping Shopify App Pricing authoritative.
