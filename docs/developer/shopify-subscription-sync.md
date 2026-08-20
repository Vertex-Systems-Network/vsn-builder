# Verified Shopify Subscription Sync

Milestone Q.5.2 makes Shopify App Pricing the production source of truth for VSN entitlements.

## Sources

The server resolves the current App GID and Shop GID through the authenticated Admin GraphQL API. It then calls the Shopify Partner API using the configured organization and Partner API token.

Each verification fetch combines:

- `activeSubscription(appId, shopId)` for the canonical current contract, billing period, cycle, items, trial and pending update.
- Historical `events` filtered to subscription lifecycle events for cancellation and frozen/unfrozen context.

Q5.5 makes the authority order explicit: when an active contract exists, its subscription item handle is authoritative for the current plan. A historical event can change lifecycle state (for example frozen or cancellation scheduled) but cannot upgrade a merchant by overriding the active contract handle. Unknown or ambiguous active handles fail closed to Free.

The Shopify pricing return parameter `plan_handle` is never treated as proof of payment. It only causes an immediate verification attempt.

## Environment

```env
SHOPIFY_PARTNER_ORGANIZATION_ID=
SHOPIFY_PARTNER_API_TOKEN=
SHOPIFY_PARTNER_API_VERSION=2026-07
SHOPIFY_SUBSCRIPTION_CACHE_TTL_SECONDS=300
SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS=86400
SHOPIFY_PARTNER_API_TIMEOUT_MS=8000
SHOPIFY_PARTNER_API_RETRY_COUNT=2
SHOPIFY_PARTNER_API_RETRY_BASE_MS=250
VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT=false
```

The Partner API token must stay server-side. The browser receives only a redacted sync configuration.

## Entitlement rules

Production paid entitlements require a `BuilderSubscription` mirror with:

- provider `shopify-app-pricing`
- a recent `verifiedAt`
- status `active`, `trialing`, or `canceling`
- a configured Shopify plan handle that maps to one VSN plan

Inactive, canceled, frozen, unknown, ambiguous, or over-stale states fail closed to Free (internal key `core`).

A scheduled cancellation keeps the current tier until the contract ends and records Free (internal key `core`) as the pending plan. A frozen or canceled state immediately resolves to Free on the next successful verification.

## Cache and failure behavior

A fresh mirror avoids duplicate Partner API calls. Concurrent syncs for the same shop are deduplicated in-process. Q5.5 retries temporary HTTP `429/500/502/503/504`, retryable GraphQL throttling/service errors, and transient network failures with a bounded exponential backoff. Authentication/authorization failures such as HTTP `401` are never retried. If the Partner API is temporarily unavailable after the bounded retries, VSN records the sync error without replacing the last verified contract. A previously verified paid mirror can remain authoritative only until `SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS`; after that, production fails closed to Free.

## Database

Migration `20260809030000_milestone_q52_subscription_sync` adds subscription-provider, lifecycle, Shopify identity, verification, pending-plan and diagnostics fields to `BuilderSubscription`, plus an index over provider/status/verifiedAt. It is additive and preserves existing local Developer Mode rows.
