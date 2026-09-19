# Shopify production setup

VSN keeps the default `shopify.app.toml` for development. Do not replace the Cloudflare/dev workflow with production URLs while you are still developing.

## Create production configuration

Set `SHOPIFY_PRODUCTION_APP_URL` and `SHOPIFY_PRODUCTION_CLIENT_ID`, then run:

```bash
npm run config:production
npm run release:production:check
```

This generates `shopify.app.production.toml` with the production application URL, `/auth/callback`, API version `2026-07`, the VSN app proxy and the same declared app-specific/compliance webhooks.

Deploy only after the readiness check passes:

```bash
npm run deploy:production
```

The Theme Active badge uses Shopify App Bridge to verify the published theme app embed. A draft/development theme can differ from the published theme.

## Runtime hosting variables

Production hosting requires at least `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` and an explicit SQLite `DATABASE_URL=file:...`. The current release does not implement Postgres/MySQL by changing the URL alone. `VSN_DEFAULT_PLAN` must stay blank in production.

Before `release:production:check` can pass, also provide the P0.5 persistence evidence: `VSN_PRODUCTION_HOSTING_PROVIDER`, `VSN_SQLITE_VOLUME_MOUNT`, `VSN_SQLITE_INSTANCE_MODE=single-instance`, `VSN_SQLITE_DURABILITY=durable-volume`, `VSN_SQLITE_BACKUP_MODE=infrastructure-snapshot`, and a valid `VSN_SQLITE_RESTORE_TESTED_AT` timestamp. See `docs/developer/production-data-topology.md` for the boundary between repository support and actual deployment evidence.
