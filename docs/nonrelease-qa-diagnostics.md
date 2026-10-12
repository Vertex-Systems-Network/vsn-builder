# Non-release quality diagnostics

This read-only GitHub Actions workflow is an **independent developer diagnostic** only. Its success is **not** sufficient for Shopify publication, production confidence, Staging or Live acceptance.

## Reason

The canonical `.github/workflows/ci.yml` blocks after `npm audit --include=dev --audit-level=high` because of unresolved upstream GraphQL codegen advisories (Issue #96). Its security gate is deliberately unchanged. This separate workflow makes progress on otherwise-skipped tests without bypassing release requirements.

## What it runs

- Exact-revision `npm ci`, with no write credentials.
- Environment isolation checks and security source audits.
- Prisma SQLite generate + migrations against ephemeral `file:./ci.sqlite` only.
- React Router typegen/typecheck, production build in `NODE_ENV=test`.
- `qa:release` and large-page performance checks; log artifact retained for diagnosis.

It uses **no Shopify API keys, Neon URLs, Cloudflare credentials, real merchant shop or GitHub write permission**. It does not run Shopify CLI release, Wrangler deploy, production migrations, or third-party integration tests.

## Release gate

Production Confidence, including both high-severity npm audits and the full runtime/merchant acceptance contract, remains authoritative and blocking. Never interpret a green diagnostic run as evidence of staging or production readiness.
