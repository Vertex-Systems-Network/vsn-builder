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

## Q4 legacy-audit alignment

The first actual downstream diagnostic run [38295008279](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38295008279) passed installation, SQLite migrations, source security, typecheck, and build but identified a false incompatibility in the legacy Q4 audit: it expected `shopify app deploy --config production` even though three-tier migration explicitly blocks any direct release. The audit now requires the fail-closed deployment command and named production environment guard during migration. It cannot silently turn deployment on.
