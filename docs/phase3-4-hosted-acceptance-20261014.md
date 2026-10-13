# Phase 3 / 4 targeted completion audit — 2026-10-14

## Why phases are not marked closed

The owner temporarily prioritized Phase 3 (Neon PostgreSQL) and Phase 4 (Cloudflare Worker Runtime) ahead of the strict Phase 1 → 8 sequence. **This is a targeted engineering batch, not permission to manufacture external acceptance or release a partial app.** The eight-phase tracker remains unchanged until real acceptance evidence exists.

### Phase 3 — actual connected Neon verification

Read-only inspection of the real VSN organization projects:

| Tier | Project | Default branch | Current baseline | Acceptance |
| --- | --- | --- | --- | --- |
| Staging | `shiny-violet-61219572` | `br-square-mountain-b3ij6q2s` (restored snapshot default) | PostgreSQL 18.6; zero application tables and no Prisma migration history at inspection | NOT MIGRATED |
| Production | `nameless-violet-68750490` | `br-odd-credit-b3rzlpz9` | PostgreSQL 18.6; zero application tables and no Prisma migration history at inspection | NOT MIGRATED |

**QA shadow branch created under the Staging project only:** `br-blue-flower-b3kiqk5n` / `vsn-builder-phase3-migration-qa-20261014`, copied from Staging before applying any migration. This branch is neither the Staging default nor the Production project.

On that isolated QA branch, the repository's **two exact PostgreSQL migration SQL files** were split into 171 statements (170 baseline + 1 installation-generation fence) and executed in a single Neon SQL transaction. Real post-execution SQL results: **52 application tables, 168 indexes, 477 constraints**, with `BuilderShopInstallation` and `BuilderSubscription` tables present. A synthetic shop installation and Session row were inserted under a SAVEPOINT and then **rolled back**; SQL verification observed **1/1 inside the savepoint, 0/0 after rollback**. No real merchant data was used or accessed. The shadow remains available to diagnose/compare; its contents are **NOT** Prisma migration deployment evidence.

**Staging compute pooler change:** A fresh authorized Neon endpoint inventory showed both primary endpoints originally had `pooler_enabled:false`. The **Staging primary endpoint only**, `ep-little-dream-b3g6puj2`, was updated to `pooler_enabled:true`, `pooler_mode:transaction`; the API confirmed these values. No Production compute settings changed. This prepares the paired pooled/runtime and direct/migration URL paths but **does not** verify credentials or an end-to-end pooled query.

**Neon root snapshot / actual recovery drill (same Staging project, 2026-10-14):** The live Staging root was captured as `snap-green-bar-b3m1btfb` while it held **zero application tables**. Neon `restore_snapshot` with `finalize:true` restored the snapshot to new branch `br-square-mountain-b3ij6q2s` **and switched the Staging default branch and stable endpoint `ep-little-dream-b3g6puj2` to that restored branch**. This was a real Staging default-branch cutover, NOT a passive isolated restore; the original root `br-wandering-queen-b3mmztjy` is preserved under the backup/recovery-drill name, with independent endpoint `ep-holy-tooth-b39zxzxs`. Follow-up Neon branch/endpoint listing and SQL on both confirmed **zero application tables on the old and restored branches**, the restored branch is default, the same configured application endpoint hostname remains attached to the default, and **Production was not touched**. This proves successful restoration of the *empty pre-migration* Staging baseline, not recovery of an initialized app schema. The QA migration branch `br-blue-flower-b3kiqk5n` remains separate and still contains the 52-table SQL dry run. The new Staging default branch ID must be used when reviewing future backup identifiers and migration plans.

**Important gap:** These direct SQL dry-run transactions do **not** create Prisma's `_prisma_migrations` bookkeeping. The QA branch reports **zero Prisma migration-history tables**. We have not tested a Neon point-in-time restore of a *migrated* branch, direct vs pooled **authenticated app** connections, or the real protected migration workflow. The Staging default's application tables remained empty throughout; a separate Neon restore subsequently changed its default-branch identity as documented below. Production project was not written to.

A new manual-only `phase3-staging-neon-migration.yml`:
- Runs only on the **protected `development` branch** with GitHub Environment `cloudflare-staging`.
- Requires approved Staging snapshot/restore evidence and `STAGING_MIGRATION_APPROVED=true`; deliberately cannot treat the shadow test as full restore evidence.
- Confirms exact Staging Neon identity and distinct pinned pooled/direct PostgreSQL URLs, without logging passwords.
- Enforces `npm audit --include=dev --audit-level=high`; **issue #96 currently blocks it**.
- Uses official `prisma migrate deploy --schema prisma/cloud/schema.prisma`, generates an isolated PostgreSQL client and checks actual `_prisma_migrations` plus required tables.
- Never targets Production. This workflow has **not** been dispatched; current `development` is unprotected.

### Phase 4 — initial hosted Worker entry (no deployment)

The repo now contains `workers/app.js`, `wrangler.staging.jsonc`, and `wrangler.production.jsonc`, entirely separate from `workers/ci-worker-compat.js`. Configs use distinct Worker and Neon IDs, no secrets, `workers_dev=false`, and `preview_urls=false`.

- `/healthz`: minimal liveness with explicit `merchantAppReady:false`, **not** product-ready.
- `/readyz`: always HTTP 503 until real React Router/Shopify UI integration exists.
- `/__vsn/database-health`: guarded Staging/Production environment and real database check requiring **at least 52 tables and two successful Prisma migration-history rows**; returns 503 otherwise and leaks no DB error strings/credentials.
- `/app/__vsn/verified-session`: protected official Shopify SDK session + persistent Neon installation/session checks via the existing admin gate, not query-string trust.
- `/webhooks/app/uninstalled`: double signature validation route wired to the existing **fail-closed** uninstall handler; it will remain HTTP 503 without independently trustworthy install-generation attestation and must **not** delete merchant sessions.
- All `/app` editor, `/auth`, billing and publishing paths remain **503**. No user-facing application route has been released.

Local CI must execute static/runtime regression checks, validate staged Prisma policy, and bundle the *gated* Staging Worker with Wrangler **dry run only**. A dry-run bundling pass does NOT prove the hosted Worker is deployed, Shopify OAuth, public HTTPS, or app-route SSR. **Neither Staging nor Live was deployed.** Both connected Worker scripts previously had zero secrets/bindings; these code changes do not secretly configure them.

## New protected remote verification gates (2026-10-14)

The prior migration workflow accepted any plausible `br-` branch ID as "backup evidence." That was **not evidence of a real backup**. The code now requires the actual pinned Staging root snapshot `snap-green-bar-b3m1btfb`, independently observed via the connected Neon account. The Staging manifest also pins restored default branch `br-square-mountain-b3ij6q2s`, preserved original root `br-wandering-queen-b3mmztjy` and pool-enabled endpoint `ep-little-dream-b3g6puj2`.

`scripts/phase3-staging-neon-live-proof.mjs` checks the **actual Neon read-only control-plane API** for the snapshot's original source, restored default, independent recoverable original branch, correct pooled endpoint, matching project and no truncated list responses. This check is injected **before** the mandatory security audit and any Prisma DDL in the protected Staging-only workflow. It requires a correctly scoped `NEON_API_KEY` GitHub Environment secret; a fake string or missing token fails. Synthetic regression tests cover forged snapshots, switched endpoints, absent pooler and API failures. This is not confirmation that a protected workflow has ever executed; GitHub `development` protection and audit issue #96 remain unresolved.

`scripts/phase4-staging-cloudflare-readiness.mjs` adds a separate **Cloudflare metadata GET-only** acceptance check through the protected manual workflow `phase4-staging-cloudflare-observation.yml`. It requires real bound secret names `DATABASE_URL` and `SHOPIFY_API_SECRET`, public Shopify config bindings, and exact tier variables for Staging/Neon. **It never writes secrets or deploys a Worker and never prints credentials.** Missing secrets or a Production target fail closed. **Connected Cloudflare recheck (2026-10-14):** Staging and Production scripts each returned HTTP 200 for both secret-list and settings-list GETs, with **0 secrets and 0 settings bindings on EACH Worker**. This is current read-only external evidence that the Phase 4 hosted secret/config acceptance gate will fail; no Worker was deployed or modified. Unit tests validate the denial cases using synthetic API results only.

Neither workflow is currently ready to run from protected `development` and neither constitutes a Live app or real merchant acceptance. No cloud Worker deployment or production database migration took place in this follow-up.

## True outstanding closure evidence

| Phase | Existing verified subtasks | Outstanding |
| --- | --- | --- |
| 3 — PostgreSQL/Neon | 3/5 | Approved protected Staging migration + authenticated pool/direct and restore; independent isolated Production migration/recovery |
| 4 — Cloudflare Worker | 1/4 | Full production-grade React Router/Shopify Worker app (not only this gated entry), properly scoped secrets and deployed Staging HTTPS/OAuth, Live promotion/rollback and independent smoke |

**Required order after targeted batch:** resume pending Phase 1 and commercial billing work; never mark Phases 3/4 closed out of sequence simply because SQL dry-run or Worker code exists. No Shopify review submission until Phase 8 is demonstrably release-ready.
