# VSN | Builder

## Current active work and irreversible task closure (15 Oct 2026)

**T011 FINAL CLOSED:** Audited dependency/codegen remediation and post-Playwright security checks passed on the audited candidate. Mandatory re-audit during future protected release merge is still enforced under T012; never infer Shopify merchant readiness.

**30 active atomic tasks only:** 2 READY, 9 IN_REVIEW, 19 WAITING. The 11 narrow-scope previously verified tasks have been **CLOSED FINAL**, removed from all active work tables and recorded in [the immutable audit archive](docs/closed-task-archive.md). A closed acceptance scope is never reopened or scheduled; any additional functionality requires a new task ID. [ACTIVE TASKS.md](TASKS.md) and [the canonical validator](scripts/task-dependency-check.mjs) enforce this policy; `--include-closed` is the explicit historical audit view.

**Engineering/release distinction:** CI on the candidate integration PR [#190](https://github.com/Vertex-Systems-Network/vsn-builder/pull/190) passed the scoped security, local Cloudflare-native Workerd and QA checks. This does **not** close T012/T020 or any real Shopify/Neon hosted task: the PR remains draft, development branch is not protected, hosted `/app` and `/auth/*` remain HTTP 503, Staging primary Neon is not migrated and real Shopify installation/billing remain unverified. No Live deployment or Shopify submission.

VSN Builder is a Shopify page-builder application. This repository is being separated into **Local/Development**, **Staging**, and **Production/Live** environments with independent Shopify identities, databases, billing modes and Cloudflare Workers.

> **Deployment warning (13 Oct 2026):** The hosted Worker integration is **not functional or released**. The current engineering work is on **unmerged stacked PRs**, not the default branch. Staging/Live Workers are placeholders. **Do not point merchant traffic at them or submit the Shopify app for review.**

## Owner-approved Shopify pricing contract (2026-10-14)

**One public Shopify App: VSN | Builder. Four paid plans and no Free tier:** Starter (`starter`, $30/month), Sliver (`sliver`, $100/month), Gold (`gold`, $150/month), Platinum (`platinum`, $350/month or $3,000/year). **Each includes a 10-day Shopify free trial.** The names and public handles are the exact plan IDs. No active verified Shopify trial/subscription means **zero builder access**. Legacy internal keys are read aliases, not public billing IDs. Shopify Partner Dashboard pricing setup and real merchant verification are pending; this is source-code configuration in an unmerged PR, not published prices. Do not submit for Shopify review before all release gates are proven green.

## Dependency-first integration checkpoint — 2026-10-14

**T012 combined source candidate:** four paid Starter/Sliver/Gold/Platinum plans, trusted merchant-write guards, real Neon shadow migration evidence and gated Staging Cloudflare Worker source are reconciled in one branch. This is **code integration only**: GitHub Developer branch remains unprotected, Staging/Production primary Neon schemas are not migrated, both Worker scripts lack actual secret bindings, and Shopify merchant OAuth/billing E2E are unverified. Mandatory development dependency security issue [#96](https://github.com/Vertex-Systems-Network/vsn-builder/issues/96) remains red. **No deploy, Live promotion, or App Store submission.** See [Staging Neon/Cloudflare acceptance record](docs/phase3-4-hosted-acceptance-20261014.md) and [Task Board #156](https://github.com/Vertex-Systems-Network/vsn-builder/issues/156).

## Environment identity and promotion

| Tier | User-facing name | Code source | Storage | Worker | Verification |
| --- | --- | --- | --- | --- | --- |
| Local/Dev | VSN \| Builder (Development) | `development` | isolated SQLite | Shopify CLI Local | Dev identity and real merchant install **not certified** |
| Staging | VSN \| Builder (Staging) | accepted `development` SHA | isolated Neon PostgreSQL | `vsn-builder-staging` | placeholder only; no hosted schema |
| Production | VSN \| Builder | reviewed `main` SHA | different Neon PostgreSQL | `vsn-builder-production` | placeholder only; no release |

Development and Staging UI should display **Dev** / **Staging** environment badges; the requested display-version badge is **v1.0.0**. The internal package version is tracked separately.

## Mandatory eight-phase closure sequence (requested order)

The tracked execution order below is enforced by `scripts/phase-closure-check.mjs`. **A historical CI pass does not close a phase**; real merchant and hosted evidence is still required. The status list is maintained at [eight-phase closeout plan](docs/eight-phase-closure-plan.md) and `config/project/phase-closure-sequence.json`.

| # | Phase | Evidence-tracked subtasks | Current status |
| --- | --- | --- | --- |
| 1 | Environment Setup | 4/7 | **IN PROGRESS** — 3-tier Shopify identities/secrets and real preflight still unverified |
| 2 | Local Application & Browser | 2/4 | QUEUED — real Dev install/editor acceptance missing |
| 3 | PostgreSQL / Neon Database | 3/5 | QUEUED — hosted Neon migrations unverified |
| 4 | Cloudflare Worker Runtime | 1/4 | QUEUED — hosted Worker app missing |
| 5 | Shopify Authentication & Sessions | 2/4 | QUEUED — real merchant OAuth/reinstall pending |
| 6 | Webhooks & Mutation Security | 2/4 | QUEUED — trusted uninstall event provenance missing |
| 7 | Application Features & E2E | 1/5 | QUEUED — merchant editor/billing E2E pending |
| 8 | Security, CI & Deployment | 1/6 | QUEUED — development audit #96 still red |

No phase is currently closed. This is an evidence-inventory count, **not a feature-completion estimate** or readiness to deploy. Phase 2 may become active only after Phase 1 passes all required identity, configuration and separation acceptance checks.

**Phase 1 preflight update:** `npm run env:staging:identity:check` and `npm run env:production:identity:check` verify real supplied identity/configuration variables without requiring the Phase 3 Neon schema or Phase 4 Worker application. The full `env:staging:check` / `env:production:check` stay strict and deployment-blocking. CI uses synthetic identities only; **actual GitHub Environment and Shopify Partner registrations remain unverified**, so Phase 1 is still 4/7 and IN PROGRESS. See [phase closeout rules](docs/eight-phase-closure-plan.md).

**Phase 1 infrastructure recheck (2026-10-13):** Both dedicated Neon projects and Cloudflare Worker script names exist, but **Cloudflare currently lists zero Worker secret bindings for both Staging and Production**. Both Neon primary branches report `protected: false`; protections require review before release. This is an authenticated read-only historical observation, **not hosted app readiness or GitHub Environment secret verification**. See `config/project/phase1-cloud-observation.json` and `node scripts/phase1-cloud-observation-check.mjs`. Phase 1 remains **4/7 evidence-tracked, IN PROGRESS**.

**Phase 1 GitHub secret verification:** `.github/workflows/phase1-protected-identity-preflight.yml` now defines a **manual-only**, protected-branch, environment-scoped, no-checkout syntax/tier check for Staging and Production. CI covers this validator only with synthetic secrets; **real GitHub Environment reviewer/secret existence checks and actual protected runs remain pending**. The legacy inventory workflow is restricted to protected refs. No hosted credentials or Shopify merchant API calls were made. Phase 1 is still **4/7 evidence-tracked, IN PROGRESS**; see [closeout plan](docs/eight-phase-closure-plan.md).

**Phase 1 GitHub branch protection (read-only, 2026-10-13):** `main` is protected under active ruleset `Protect main`, but **`development` currently reports `protected: false`**. Consequently the strict protected-branch Staging preflight will skip on `development` until an administrator protects it. GitHub Environment scoped secret names/policies remain unverified. See `config/project/phase1-github-protection-observation.json` and `scripts/phase1-github-protection-observation-check.mjs`. **No security guard disabled; Phase 1 remains 4/7 IN PROGRESS**.

**Phase 1 source/Shopify secret hardening:** Staging secrets in the legacy GitHub workflow are now restricted to **protected `development` only** (not protected `main`); the protected identity-only preflight requires three separate Dev/Staging/Live Shopify Client IDs with exact runtime tier matching, tested against synthetic fixtures. `development` branch still lacks actual protection, and real GitHub Environment secret presence is still unverified; **Phase 1 remains 4/7**, not closed. See [closeout plan](docs/eight-phase-closure-plan.md).

**Phase 1 hosted identity preflight improvement:** Protected manual workflow now requires GitHub Environment-scoped non-secret `NEON_PROJECT_ID` / `CLOUDFLARE_WORKER_NAME` alongside 3 distinct Shopify app IDs, and exact tier identity/strict HTTPS origin checks. The repository CLI and workflow reject reserved placeholder domains, callback paths, embedded URL credentials and wrong-tier resources with synthetic CI. Real protected environment variables/secrets and Shopify Partner ownership remain unverified. **Environment Setup stays 4/7 evidence-tracked, IN PROGRESS.**

**Phase 1 billing-mode consistency (2026-10-14):** The repository-side Staging/Production identity-only preflight now requires an explicit canonical `SHOPIFY_BILLING_TEST_MODE=true` or `false`, rather than treating malformed or omitted values as Production `false`. Synthetic negative tests cover noncanonical flags. This is not hosted credential verification; Phase 1 remains **4/7 IN PROGRESS**.

**Phase 1 legacy inventory retired (2026-10-14):** The older manual `hosted-environment-secret-inventory.yml` was a weaker check: it self-assigned tier and billing flags, did not prove all three Shopify IDs or exact Neon/Worker resources, and could have shown an encouraging PASS despite missing external ownership evidence. Its branch-scoped dispatch jobs now **fail explicitly**, with **no GitHub Environment selection or secret injection**. Do not count a skipped retired job as evidence. Use only the protected manual `phase1-protected-identity-preflight.yml` after normal safe integration and verified branch/environment protection. This removes a misleading acceptance path but **does not** certify any new Phase 1 external task; the phase remains **4/7 IN PROGRESS**.

**Phase 1 hosted identity parity (2026-10-14):** Both full hosted preflight and Phase 1 `--identity-only` now require exact Neon project/Cloudflare Worker IDs and all three unique Dev/Staging/Production Shopify Client IDs. Both reject runtime ID mismatch, duplicate/uppercase alias and unclassified default-app reuse. CI uses synthetic IDs; real Shopify Partner ownership and GitHub Environment protection remain unverified. **Phase 1 is still 4/7, IN PROGRESS.**

**Phase 1 effective GitHub config validation:** The protected, manually dispatched preflight now checks actual effective `vars.APP_ENV` and `vars.SHOPIFY_BILLING_TEST_MODE` against the requested tier, rather than comparing hardcoded expectations with themselves. Missing or wrong vars fail closed. GitHub `vars` may inherit from repository/organization, so the **selected Environment's own variable/secret inventory and branch rules are still unverified**. No real protected run, Phase 1 still **4/7**. See [eight-phase closeout plan](docs/eight-phase-closure-plan.md).

## Evidence-based status dashboard

*Progress bars below measure only the **explicit checks named here**, not percentage of app features completed.*

| Workstream | Progress | Current result |
| --- | --- | --- |
| Local Workerd compatibility checks¹ | `[███████] 7/7` | CI-only **PASS** on unmerged [PR #127](https://github.com/Vertex-Systems-Network/vsn-builder/pull/127) |
| Local/Dev real merchant readiness² | `[░░░░] 0/4` | **Not certified** |
| Hosted Staging readiness³ | `[░░░░░░] 0/6` | **Not deployed** |
| Hosted Production readiness³ | `[░░░░░░] 0/6` | **Not deployed** |
| Mandatory full security audit | `[░] 0/1` | **BLOCKED** by dev-only `braces` advisory, [#96](https://github.com/Vertex-Systems-Network/vsn-builder/issues/96) |

¹ Seven passing CI-only capability classes: generated Worker Prisma, Neon endpoint isolation, Worker Shopify SDK, merchant CSP Web Streams SSR, signed webhook verification, tenant-scoped uninstall session revocation, and restricted HTTP Workerd routes. These use synthetic input and never establish real Shopify/Neon connectivity. [Exact code-head Workerd CI evidence](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490935).

² Requires independently verified Dev Shopify app identity, fresh merchant install/auth, SQLite persistence tests and test-billing acceptance.

³ Six per-tier operational gates: exact tier Shopify identity, verified hosted secrets/runtime, real reviewed PostgreSQL migration + restore, functioning Worker request routing, signed merchant session/installation acceptance, and protected billing/release/rollback smoke verification. Production also requires verified Staging promotion. None are certified merely because cloud resources exist.

### CI checkpoints

- [PR #127 real local Cloudflare Workerd CI #38387490935](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490935): **PASS** before this README-only commit. Signed Shopify uninstall + tenant-only in-memory session cleanup and tamper/replay regression tested. No hosted credentials, migration or Shopify release.
- [PR #127 Production Confidence #38387490929](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490929): required overall job **FAILS at mandatory dependency audit enforcement**; production dependency audit, static security checks, typecheck, application build, internal release QA and performance checks all passed on that previous code head. The post-browser audit is not accepted as passed or bypassed.
- Upstream `braces <=3.0.3` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no fixed published version as verified on 13 Oct 2026. No audit waiver or severity downgrade is active.

### Connected infrastructure (read-only, 13 Oct 2026)

Separate Neon Staging and Production projects each contain a default `neondb` database with **zero application tables** at inspection time. Two separate Builder Cloudflare Worker names exist as non-operational placeholders without public merchant traffic. Neither hosted database has been migrated by this work.

### Next verified release prerequisites

1. Resolve the development dependency security advisory **without bypassing the audit**; keep mandatory release CI red meanwhile.
2. Implement and review the real hosted React Router Worker entry + service/asset ports, with isolated Staging bindings; never use the CI-only Workerd Worker in hosted production.
3. Certify offline schema/migration/rollback, then apply **Staging-only** reviewed migration through protected approval and validate actual DB health.
4. Validate signed real merchant installation/session persistence, editor, billing and webhook delivery on Staging.
5. Promote only an exact source SHA accepted by all required gates; do not deploy Live or submit for Shopify review without full runtime evidence.

See [environment details](docs/three-environments.md), [verified uninstall limitations](docs/workerd-verified-uninstall-session-revoke.md), and [mandatory audit continuity](docs/mandatory-audit-qa-continuity.md).
