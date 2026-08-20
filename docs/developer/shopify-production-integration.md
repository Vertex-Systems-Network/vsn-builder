# Shopify production integration

Milestone Q4 separates development and production Shopify configuration instead of mutating the default development config.

## Contracts

- Admin/Webhook API version: `2026-07`.
- OAuth callback: `<SHOPIFY_APP_URL>/auth/callback`.
- App proxy: `/apps/vsn-builder` -> `/builder-proxy`.
- App-specific webhooks: `app/uninstalled`, `app/scopes_update`, `orders/paid`.
- Compliance webhooks: `customers/data_request`, `customers/redact`, `shop/redact`.
- Webhook verification stays inside `authenticate.webhook(request)`.
- `shop/redact` and `app/uninstalled` share the same idempotent shop-data deletion service.

## Commands

```bash
npm run config:production
npm run release:production:check
npm run deploy:production
```

`deploy:production` always passes `--config production`, preventing an accidental deploy of the default development configuration.

## API fall-forward detection

System Health queries `publicApiVersions` and reads `X-Shopify-Api-Version`. If Shopify serves a version different from the configured `2026-07`, the release screen reports API fall-forward and the API version must be upgraded before production release.
