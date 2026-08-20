# VSN Milestone M.2.1 — Compliance Webhook Configuration Hotfix

Version: `2.5.72`  
Based on: `2.5.71`

## Root cause

The mandatory Shopify privacy topics were incorrectly declared under the normal `topics` property in `shopify.app.toml`. Shopify CLI therefore validated them as ordinary webhook topics and rejected the configuration.

## Fix

The three subscriptions now use `compliance_topics`:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

The existing webhook endpoints and `authenticate.webhook(request)` HMAC verification path are unchanged.

## Database

No migration is required.

## Regression protection

The Milestone M.2 audit now asserts that each privacy subscription uses `compliance_topics` and fails if any of the three is declared as a normal `topics` value.
