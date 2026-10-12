# VSN Builder — Local / Dev, Staging, Production / Live

This is an environment-separation **foundation** modeled on [VSN Stock Down Sort](https://github.com/Vertex-Systems-Network/vsn-stock-down-sort/blob/main/docs/environments.md). It is **not** evidence of an operational Cloudflare/Neon deployment.

## PostgreSQL schema foundation (not migrated)

`prisma/cloud/schema.prisma` now mirrors the 51 Local Prisma models while using the PostgreSQL provider and separate `DIRECT_URL` for migrations. The Cloud generator targets the gitignored `generated/prisma-cloud/` directory, leaving the local SQLite `@prisma/client` untouched. CI generates both and explicitly checks that neither schema/client is overwritten. `scripts/verify-prisma-environment-parity.mjs` enforces exact model+enum body parity. A read-only schema-validation workflow validates the Prisma datamodel and generates **proposed** baseline SQL as an artifact, without connecting to any database. This does **not** mean runtime, PostgreSQL migrations or data conversion are completed; legacy SQLite introspection and stateful filesystem services still require review. No cloud migration should run until signed-off SQL/schema/restore tests.

## PostgreSQL schema-health contract (offline only)

`app/services/postgres-schema-health.js` provides a read-only, runtime-neutral PostgreSQL health contract: exact database/schema identity, shared essential feature table map, and applied cloud migration checksum. It fails closed when the migration ledger or expected checksum is missing; it does not create a client, accept secrets, connect to a DB, or report Staging as ready without actual migration evidence. Node tests use an injected mocked `$queryRaw`. The existing Local SQLite database health logic keeps its behavior and now reuses the same table map. This is **not** a cloud runtime integration or a substitute for actual migration/restore acceptance.

## Why the stock app cannot be copied blindly

Builder currently uses Prisma **SQLite** across the application, SQLite migration history, SQLite-specific database health queries, and an explicitly single-instance durable-volume production contract (see `prisma/schema.prisma`, `scripts/validate-production-runtime.mjs`, and `.ai/PRODUCTION_DATA_TOPOLOGY.json`). The Stock Down Sort cloud runtime uses a distinct PostgreSQL Prisma schema, migrations, adapter and Worker entry point. Builder now has a proposed PostgreSQL **schema only**, but still lacks reviewed cloud migrations, compatible runtime/data-health code and a Cloudflare Worker entry point. Switching a database URL from `file:` to `postgresql:` or deploying its Node server directly to Workers would break the app.

## Environment identities and flow

| Tier | Source | Shopify app | Config | Data / billing | Current operational status |
| --- | --- | --- | --- | --- | --- |
| Local/Dev | `development` | Dedicated **VSN | Builder (Development)** (new identity required) | generated `shopify.app.local.toml` | SQLite `prisma/dev.sqlite`; test | Template ready; dedicated Dev identity still required |
| Staging | accepted `development` SHA | Separate **VSN | Builder (Staging)** | `shopify.app.staging.toml` | Target isolated Neon PostgreSQL; test | **Blocked** on app identity, database port, Worker port and infrastructure |
| Production/Live | reviewed `main` SHA | Separate **VSN | Builder** | generated `shopify.app.production.toml` from template | Target isolated Neon PostgreSQL; real billing | **Blocked** pending successful staging certification and production gates |

**Never reuse** Shopify client IDs, API secrets, sessions, app installs, Shopify plan/billing configuration or databases between tiers. The existing Client ID in `shopify.app.toml` is unclassified and **must not** be assumed Dev or Live. The tracked Local **template** deliberately keeps `__SHOPIFY_LOCAL_CLIENT_ID__`; the runtime Local config is generated from gitignored `.env.local` with the separately verified Dev Client ID. Staging and production TOML templates deliberately contain placeholder client IDs/URLs. They are not deployable configurations.

### Local

1. Register or identify a dedicated **VSN | Builder (Development)** Shopify app. Set that verified Dev Client ID and the dedicated secret in gitignored `.env.local` (copy `.env.local.example`). `npm run local:prepare` generates the local-only config from `shopify.app.local.template.toml`; do **not** reuse the existing unclassified default ID from `shopify.app.toml`.
2. Use a dedicated development shop, `DATABASE_URL=file:./dev.sqlite`, `APP_ENV=development` and `SHOPIFY_BILLING_TEST_MODE=true`.
3. Set Local Shopify credentials in `.env.local`, not git. Hosted credentials are rejected by Local preflight.
4. `npm ci`, `npm run local:prepare`, then `npm run dev` (preflight enforces the Dev identity, loads `.env.local`, and pins `--config local`).
5. Run `npm run env:check` and `npm run env:local:check`; then execute real install, auth, page editing and app-pricing smoke tests.
6. Record an exact source SHA and signed runtime evidence before promotion. CI alone cannot certify a Shopify Dev install.

### Staging

Use a dedicated Shopify app, separate Neon PostgreSQL project/branch/database, separate Cloudflare Worker and only test billing. Set GitHub Environment `cloudflare-staging` secrets. Never commit real Client IDs/keys. Once PostgreSQL parity, migrations, Worker adapter and staging runtime are implemented and tested, update the staging app URL and deploy from an explicitly accepted `development` source SHA. Create/release a staging Shopify version only after staging runtime readiness; separately certify signed install/session, Admin API and billing flows. The included manual environment-readiness workflow **fails closed** until infrastructure and runtime compatibility exist; it does not deploy.

### Live / Production

Use a separate Partner app, Neon database and Cloudflare Worker with non-test billing. Use protected `main` and GitHub Environment `cloudflare-production`. Keep the generated `shopify.app.production.toml` gitignored. Enforce staging acceptance for the exact release source before a reviewed promotion; perform migrations/backups, smoke, release approval, rollback and post-release merchant verification. **No workflow in this change publishes or deploys Production.** Existing direct Shopify CLI release shortcuts are blocked as an additional safeguard.

### Remaining implementation phases (must be evidence-based)

1. Assign/verify **three** distinct Partner app registrations and isolated test stores. Configure GitHub environments and secrets.
2. Port Prisma models + migration history to PostgreSQL with data-preservation and schema-parity tests; replace SQLite-specific introspection and database assumptions. Plan conversion of any production data before cutover.
3. Implement and test the Cloudflare Worker runtime, compatible Shopify session storage/Prisma adapter and supporting assets/services. Validate file/blob/email integrations under Worker limits.
4. Introduce staging readiness → deploy → unreleased Shopify version → release → signed runtime acceptance workflows bound to an exact accepted SHA.
5. Add protected staging → `main` promotion, live secrets readiness, explicit live candidate authorization, manual production release and rollback/restore certification.

Until phases 1–4 pass, **Staging is not deployed**. Until all phases pass, **Live must remain unchanged**. Never fabricate acceptance records in `config/deployment/environments.json`.

## Deployment safety during migration

Until approved exact-source release workflows are implemented, the legacy `npm run deploy`, `npm run deploy:production`, `npm run deploy:staging` and `npm run config:use` scripts intentionally exit with an error; **none can create or release Shopify app versions**. External direct use of the Shopify CLI is outside this npm-script guard and must be avoided. Only `npm run dev` with the dedicated generated Local config is intended for Shopify CLI runtime development.

Staging and Production readiness also execute `scripts/verify-environment-promotion.mjs` using `config/release/environment-gates.json`. That file records **not verified** for all tiers initially and must only be updated after an exact-source real runtime/merchant certification. A JSON declaration alone does not prove GitHub provenance; before hosted deploy, verify its referenced run and source on GitHub. Missing or stale acceptance blocks the next tier.

CI security audits remain mandatory. As of 2026-10-12, Production Confidence on environment PR #94 failed at `npm audit --omit=dev --audit-level=high` with vulnerable transitive packages. Do not bypass these failures or claim full CI green because the narrower environment isolation workflow passes.

The generated `shopify.app.local.toml` and `.env.local` are gitignored and must never be committed; `shopify.app.local.template.toml` is the tracked contract.

## CLI checks

```sh
npm run env:check
npm run env:test
npm run env:local:check       # requires dedicated Dev runtime variables
npm run env:staging:check     # intentionally fails until PostgreSQL/Worker port complete
npm run env:production:check  # intentionally fails until PostgreSQL/Worker port complete
```

The `VSN Production Confidence` workflow continues to test the existing SQLite implementation. Its green status does **not** certify PostgreSQL or Cloudflare.

## Cloudflare infrastructure inventory (verified 2026-10-13)

Isolated Workers `vsn-builder-staging` and `vsn-builder-production` have been created in the VSN Cloudflare account. Both currently contain **unavailable/503 placeholder code**, not a deployed Shopify application. Their `workers.dev` public subdomain and preview URL access are disabled; no merchant traffic should be pointed at them. Their presence does **not** satisfy the Worker application compatibility, database migration, Shopify auth, or signed session gates. Existing non-Builder Workers must not be reused or overwritten.

## Environment secret inventory checks (read-only)

GitHub Environment names are `cloudflare-staging` and `cloudflare-production`. The `VSN Hosted Environment Secret Inventory (No Deploy)` workflow checks the *presence/format only* of scoped credentials, with no DB/Shopify/Cloudflare external network calls. It never prints secret values, fetches cloud data, promotes a SHA, updates a Worker, or changes the strict `environment-contract.mjs` readiness requirement. Protected GitHub environments may require their usual approval before a check can execute.

The checks require `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and for Production `SHOPIFY_PRODUCTION_CLIENT_ID`. This is the expected configuration contract; an absent name is a blocker, not proof that no setting exists under another name. The workflow uses hosted `APP_ENV` and billing mode constants, not user-provided overrides. Passing inventory does not certify operational readiness.

**Names:** Dev `VSN | Builder (Development)`, Staging `VSN | Builder (Staging)`, Live `VSN | Builder`. Header `v1.0.0` is a requested display version separate from internal `2.5.107`.

### Secret-inventory run restrictions

The first PR feature-branch inventory jobs were reported failed before any runner steps or readable job logs appeared. That result does **not** identify missing credentials. To avoid injecting Staging/Live secrets into feature branches, the inventory workflow is now **manual only** on `development`/`main` for Staging and only `main` for Live. GitHub Environment policies remain in force. The direct Cloudflare/Neon inventory shows dedicated resources exist, but **credential binding and deployed runtime have not yet been verified**.
