# VSN Builder v2.5.84 — Milestone Q.4 Shopify Production Integration

## Delivered

- Separate development/production Shopify CLI configuration workflow.
- Production config generator and strict readiness gate.
- Explicit production deploy command using `--config production`.
- Production runtime environment validation with development-tunnel rejection.
- Central Shopify integration contract for API version, OAuth callback, app proxy, scopes and webhook topics.
- Live `publicApiVersions` + `X-Shopify-Api-Version` fall-forward detection in System Health.
- Shared idempotent full-shop deletion lifecycle used by both `app/uninstalled` and mandatory `shop/redact`.
- In-app and packaged Q4 documentation.

## Developer Mode boundary

The package does not invent a production hostname or production Client ID. The default `shopify.app.toml` remains development-safe with URL auto-update enabled. A named production config is generated only from explicit environment values.

## Validation

- Q4 audit: 23/23 PASS.
- Q1/Q2 runtime/security audit: 39/39 PASS.
- Q3 performance audit: 26/26 PASS.
- Q3.1 Windows DB bootstrap audit: 13/13 PASS.
- Complete `qa:release`: PASS (exit 0).
- JS/JSX syntax QA: 283 files, 0 blocking syntax errors.
- Codebase health: 0 failures / 0 warnings.
- Production config smoke check: 20/20 PASS.
- Strict release-readiness smoke check: PASS.
- Development tunnel rejection smoke check: PASS.
- Packaged SQLite: 30 applied migrations; BuilderEmailTemplate, BuilderWishlist, BuilderGlobalCode and Session tables present.

## Database

No new Prisma migration is required for Q.4.
