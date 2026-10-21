# Environment Promotion Contract — Development → Staging → Production

Every AI agent working on this repository MUST move changes through exactly three tiers, in this order. No tier may be skipped, and no change may reach a later tier without passing the earlier one at the **same exact commit SHA**.

```
Local/Development  ──►  Staging  ──►  Production
 (Node + SQLite)        (Cloudflare Worker + Neon Staging)   (Cloudflare Worker + Neon Production)
```

This contract supplements `AGENTS.md`, `.ai/SECURITY_AND_SAFETY.md`, `.ai/QUALITY_GATES.md`, `TASKS.md` and `.ai/schedule/SCHEDULE-PLAN.md`. Where any of those is stricter, the stricter rule wins. It never grants authority to bypass a required check, review, branch protection or owner approval.

## Tier 1 — Local / Development

- **Where:** feature branch created from current `development`; local Node 22 runtime with SQLite (`prisma/schema.prisma`) and the Shopify Dev app/test store only.
- **What AI may do:** write code, tests and docs; run lint, typecheck, unit/QA audits and local E2E; open a PR **into `development`**.
- **Exit gate (all required):**
  1. Relevant local checks pass: `npm run typecheck`, `npm run qa`, task-relevant audit/tests, and no new lint errors in touched files.
  2. If the Prisma data model changed, the Postgres schema (`prisma/cloud/schema.prisma`) and its migration are updated in the same PR.
  3. All required exact-head CI checks on the PR are green.
  4. PR is reviewed and merged into `development` per branch rules.
- **Never:** use Staging/Production credentials, Neon branches or Cloudflare Workers from local work.

## Tier 2 — Staging

- **Where:** Cloudflare Worker `vsn-builder-staging`, Neon Staging project, Shopify Staging app config (`shopify.app.staging.toml`), Shopify test stores only.
- **Entry gate:** the candidate is a commit on protected `development` whose exact SHA passed all required CI.
- **What AI may do (only via protected workflows / GitHub `staging` environment):**
  1. Take a Neon Staging snapshot/backup **before** any migration.
  2. Run `prisma migrate deploy` against Staging (never `migrate dev`, `db push` or `--accept-data-loss`).
  3. Deploy the exact SHA to the Staging Worker.
  4. Run the hosted readiness gate (`/healthz`, `/readyz`, `/app`) and real E2E: install/OAuth, sessions, editor save/publish, theme extension, webhooks, billing in test mode.
- **Exit gate (all required):** hosted readiness PASS, real Staging E2E PASS with recorded evidence, rollback/restore drill proven for that release, no open P0 security finding. Record the certified SHA and evidence links in `TASKS.md` / the related Issue.
- **Never:** copy Production secrets or data into Staging; claim Staging PASS from CI-only, mocked, 503-locked or binding-name-only evidence.

## Tier 3 — Production

- **Entry gate:** the **same SHA** certified on Staging, plus explicit owner approval recorded for that release (standing consent does **not** cover Production deploys, real charges or Shopify App Store submission).
- **What AI may do after approval (only via protected workflows / GitHub `production` environment):**
  1. Neon Production backup/snapshot, then `prisma migrate deploy`.
  2. Promote the certified SHA to the Production Worker (no rebuild from a different commit).
  3. Live smoke test and monitoring; roll back immediately on failure using the proven rollback path.
- **Never:** hotfix directly on Production, deploy an uncertified SHA, use Staging credentials, or submit to the Shopify App Store before release certification (T041).

## Hotfixes

A production hotfix still follows all three tiers: branch from `development` → PR → CI → Staging verify → same-SHA Production promotion. Speed may be increased; tiers may not be skipped.

## Secrets and data isolation

- Each tier has its own Shopify app config, Neon project/branch, Cloudflare Worker and secrets. Never reuse a secret across tiers.
- Secrets live only in GitHub Environments / Cloudflare secret bindings. Never commit, print or log secret values.
- A lower tier must never hold a credential that can write to a higher tier.

## Missing prerequisites — fail closed

If a tier's infrastructure is not ready (for example: `development` not protected, Staging Worker has no secrets/bindings, Neon Staging has no migrated schema, Worker routes still return 503), the AI MUST:

1. stop promotion at the last passing tier;
2. record the exact blocker and next safe action in `.ai/WORK_STATE.md` and the related Issue;
3. continue other non-conflicting Tier 1 work instead of faking or skipping the blocked tier.

Missing evidence is never PASS.

## Required report per promotion

For every promotion step, record: tier, exact SHA, CI run links, migration result (if any), deploy result, E2E/smoke evidence, rollback status, and next safe action.
