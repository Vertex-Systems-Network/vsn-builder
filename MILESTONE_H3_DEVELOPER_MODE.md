# Milestone H.3 — Developer Mode Guardrail

VSN Builder v2.5.61 remains a developer-mode build.

- Dashboard visitor telemetry stores only the existing VSN visitor/session identifiers, country code, last VSN path and timestamps/page-view count. It does **not** store IP addresses.
- Visitor telemetry is limited to VSN-rendered storefront page requests and is used for the in-app Dashboard visitor map/live activity widgets.
- Plans remain Shopify-managed. The combined Plans & License screen does not invent production pricing or activate paid subscriptions by itself.
- Dashboard layout preferences are store-scoped and reversible.
- No production deployment URLs, billing approvals or irreversible release actions are introduced by this milestone.
