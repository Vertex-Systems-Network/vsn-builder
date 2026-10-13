# VSN Builder — mandatory eight-phase closeout sequence

Last audited: **2026-10-13**. Owner requested that phases be worked **one at a time** in the exact order below, and that every progress response end with a complete eight-row status table. This registry is not a merchant or hosted deployment certification.

| # | Phase | Evidence-tracked subtasks | Closure |
| --- | --- | --- | --- |
| 1 | Environment Setup | 4/7 | **IN PROGRESS — not closed** |
| 2 | Local Application & Browser | 2/4 | QUEUED, earlier synthetic CI only |
| 3 | PostgreSQL / Neon Database | 3/5 | QUEUED, real Neon pending |
| 4 | Cloudflare Worker Runtime | 1/4 | QUEUED, hosted Worker pending |
| 5 | Shopify Authentication & Sessions | 2/4 | QUEUED, live OAuth pending |
| 6 | Webhooks & Mutation Security | 2/4 | QUEUED, trusted provenance pending |
| 7 | Application Features & E2E | 1/5 | QUEUED, real merchant E2E pending |
| 8 | Security, CI & Deployment | 1/6 | QUEUED, dev dependency audit blocked |

Numbers count entries in `config/project/phase-closure-sequence.json` that have recorded source references. **They are NOT project completion percentages.** A PR URL proves that changes were proposed, not that a real Shopify install, protected GitHub Environment or hosted release has been accepted.

## Closeout rules

1. A phase is `closed` **only** after every required subtask has independent evidence appropriate to its type. PR and CI evidence are allowed for local development checks; merchant identity, hosted secrets, live Shopify authorization, billing and Worker readiness require **real external acceptance**. Merely changing a JSON field cannot establish real acceptance.
2. **No phase N+1 closure or activation before phase N is closed.** Existing CI tests for later stages can still be recorded historically, but that does not mean those phases have formally started.
3. A stage blocker is not a pass. Security audit #96 stays red, uninstall generation attestation remains missing, and all hosted Shopify/Neon/Cloudflare operations stay unverified until positively checked.
4. No external secret values, merchant tokens, account IDs or database connection strings belong in the phase manifest; it stores only task names, statuses and safe GitHub references.
5. A phase-closeout operator must independently verify external evidence and exact-source GitHub CI, then update `config/project/phase-closure-sequence.json` and the relevant release gate. The automated script enforces order/traceability but **does not independently authenticate GitHub run status** or Shopify acceptance.
6. Final release/staging/live deployment still requires the separately existing `config/release/environment-gates.json`, actual Shopify merchant E2E and mandatory security audits. Never use a green phase registry alone to deploy or merge.

## Current read-only resource verification (2026-10-13)

Connected Neon returned **two distinct organization-owned Builder projects**, `vsn-builder-staging` (project `shiny-violet-61219572`) and `vsn-builder-production` (project `nameless-violet-68750490`), in the same region but **different project IDs**. Connected Cloudflare account **Vertex Systems Network** returned the distinct Worker script identifiers `vsn-builder-staging` and `vsn-builder-production`. These findings are based on authorized account **read-only resource enumeration**, not configuration placeholders alone. The evidence has been recorded in this PR and its phase tracker. No credentials, connection URL passwords, secret contents, migrations, Worker deployments or Shopify merchant session data were read or changed.

**What it does not establish:** Both scripts being listed is not proof that Builder application code is deployed; it remains placeholder-only pending actual runtime tests. Neither actual Shopify Partner app identity nor GitHub Environment secret binding/policy is proven by this inventory.

## Read-only Cloudflare binding + Neon branch review (2026-10-13)

The authorized Cloudflare API read-only script/secrets/settings/deployments lookup confirmed both `vsn-builder-staging` and `vsn-builder-production` Worker script records exist in the VSN Cloudflare account, with **one deployment record each**. Crucially, both list **zero bound secret names** and **zero script-settings bindings**. This does *not* establish that the Workers host the Builder application: both remain placeholder-only, and Shopify, DATABASE_URL and live session credentials cannot be assumed present. Script existence is NOT deployment readiness. The Cloudflare settings and secrets metadata was summarized by **name/count only**; no secret values or Worker code was read.

Neon read-only project and branch listings again confirmed distinct staging/production projects, both on **PostgreSQL 18** in `aws-ap-southeast-1`. Each project's only primary branch is named `production` and currently reports `protected: false`. The word "production" is the *branch name* within each distinct Neon project, **not evidence of a cross-tier database mix-up**. Branch protection deserves review before production acceptance; none was changed.

The reviewed, **historical, non-sensitive** snapshot is `config/project/phase1-cloud-observation.json`. CI runs `node scripts/phase1-cloud-observation-check.mjs` and its regression tests; this verifies the correct manifest-to-resource names and flags missing hosted bindings, but **does not re-query cloud accounts**. To require all listed hosted infrastructure prerequisites, run `node scripts/phase1-cloud-observation-check.mjs --require-hosted-ready`; it **currently fails deliberately**. Further changes must use new read-only live evidence and must not rewrite an old observation as if it were current.

This metadata does not satisfy Phase 1 external Shopify Partner account ownership, protected GitHub Environment credential/policy review, or actual tier-specific preflight. **Phase 1 stays 4/7, IN PROGRESS**. GitHub Environment secret values were never read; their existence and protection remain unverified separately from these missing Cloudflare Worker runtime bindings. No hosted SQL, Worker deployment, Neon protection mutation, Shopify API call or merchant data write occurred.

## Phase 1 identity-only preflight (no Worker/DB deployment)

A previously discovered **phase dependency deadlock** made a strict Staging/Production `env:*:check` require `workers/app.js` and Cloudflare release wiring, even though the approved execution sequence reserves actual hosted application setup for **Phase 4**. This would block legitimate Phase 1 identity verification until a later phase.

Two new **configuration-only** commands separate that concern without changing existing deployment gates:

```bash
npm run env:staging:identity:check
npm run env:production:identity:check
npm run env:shopify:identity:distinct:check
```

The three-tier uniqueness command additionally requires `SHOPIFY_DEVELOPMENT_CLIENT_ID`, `SHOPIFY_STAGING_CLIENT_ID` and `SHOPIFY_PRODUCTION_CLIENT_ID` supplied securely together; it refuses repeated IDs and the unclassified default app without printing values. Real Shopify Partner ownership still needs separate verification.

They require the tier's *actual* environment variables (never check secrets into Git). Both validate the Shopify Client ID and secret presence, tier-specific billing test mode, HTTPS app URL, exact independent `NEON_PROJECT_ID` and `CLOUDFLARE_WORKER_NAME`, and pinned Neon direct/pooled hosts, matching database name/role and TLS. Production must use the explicit matching `SHOPIFY_PRODUCTION_CLIENT_ID`; Staging must not reuse the supplied Production identity. The Local preflight still checks the unique runtime `shopify.app.local.toml` Dev app and SQLite. No mode prints credentials or accesses remote services.

**Security distinction:** Existing `npm run env:staging:check` and `npm run env:production:check` continue to require Phase 3 schemas/migrations and Phase 4 real Worker entry/configuration, and remain FAIL-CLOSED. An identity-only result proves **syntax and cross-tier mapping only**, not that Shopify owns the Client ID, GitHub scoped secrets exist, Neon credentials work, or the Workers serve app code. GitHub Environments and real credential preflight require separate authorized, protected execution on the appropriate branches. CI tests use fake credentials solely to validate these checks and their rejection cases.

Phase 1 stays **4/7 evidence-tracked; NOT closed**, until separately authenticated Shopify registration, GitHub secret bindings/protection and actual protected tier-specific preflight are verified. Code having an identity preflight does not make its real invocation passed.

## Protected GitHub Environment secret-presence preflight (2026-10-13)

New manual-only `.github/workflows/phase1-protected-identity-preflight.yml` verifies **one** Staging or Production environment in a deliberately isolated job. It permits Staging only from a **protected** `development` branch and Production only from a **protected** `main` branch. The job explicitly selects `cloudflare-staging` or `cloudflare-production` so GitHub's configured environment protection rules apply before scoped secrets are released. The source branch must have `github.ref_protected == true`. **Skipped jobs are not successful preflight evidence**: the run must show the credential-check step actually executed and passed.

The job has **no checkout, no npm or third-party commands, no API calls**, and does not print, save or return secret values/hashes. A small, inlined standard-library Python validator checks: Shopify Client ID shape, unclassified default ID rejection, secret presence, Production Client ID equality, Staging-versus-Production mismatch when supplied, billing test mode, stable HTTPS-only app origin, Cloudflare account ID/token presence, and exact environment-specific Neon direct/runtime endpoint hosts, matching DB user/name and required TLS. All outputs use generic names and errors; no URL passwords or client IDs are emitted. Its code runs in **local CI with synthetic values**, including negative tests for cross-tier connection swapping, unexpected identities and malformed URLs. The legacy secret inventory workflow also has its feature-branch push trigger removed and both jobs now require a protected ref.

**This new workflow is not yet executed against protected real secrets.** It can be manually dispatched only once the workflow exists on the proper protected branch and GitHub Environments are correctly configured. Available GitHub connection tools cannot inspect protected GitHub Environment policies/secret names or directly dispatch a workflow; do not invent evidence of them. The preflight is **configuration identity only**. GitHub Environment required-reviewer rules and Shopify Partner registration ownership need independent authenticated account verification, even if this validation passes. The existence of this code **does not** satisfy task 1.5/1.6/1.7 and does not authorize cloud deployments.

For exact syntax and tests, see `tests/phase1-protected-identity-preflight.test.mjs`. Production Confidence's mandatory security audit #96 is still a separate release blocker; a green preflight must never be substituted for its pass.

## Phase 1 outstanding environment closure work

- Independently verify three **distinct** Shopify Partner app identities for **Development**, **Staging** and **Live**; the original default `shopify.app.toml` client ID remains unclassified. Tracked config client IDs are placeholders, by design.
- Verify the presence and protections of GitHub Environments `cloudflare-staging` and `cloudflare-production` and their correctly scoped Shopify/Neon/Cloudflare bindings. Do not print or copy secrets, and do not confuse a secret's existence with a successful runtime connection.
- Verify resource ownership/isolation for Neon Staging `shiny-violet-61219572`, Neon Production `nameless-violet-68750490`, Worker `vsn-builder-staging` and Worker `vsn-builder-production` at the time of closure. Existing inventory references and placeholder resources do **not** prove active applications.
- Execute actual configuration preflight for each tier with the tier's **real** distinct credentials, without triggering a hosted migration or deploy. Do not close Phase 1 based only on synthetic environment tests.

## CLI and regression tests

```bash
node scripts/phase-closure-check.mjs --format=markdown
node --test tests/phase-closure-check.test.mjs
node scripts/phase-closure-check.mjs --require-closed=1
```

The last command is **expected to return nonzero** until Phase 1 is legitimately closed. The local Workerd GitHub Actions job runs the non-mutating policy and regression checks along with application tests.

After this phase is genuinely closed, mark Phase 2 `in_progress` and continue its outstanding merchant/install/browser checks; progress responses still show all eight rows.
