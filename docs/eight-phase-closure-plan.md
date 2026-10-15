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

## Legacy hosted secret-inventory acceptance path retired (2026-10-14)

The old manually dispatched `hosted-environment-secret-inventory.yml` had a weaker "PASS": job-level `APP_ENV` and `SHOPIFY_BILLING_TEST_MODE` were hardcoded, the Staging/Production Worker name was hardcoded, and no actual Environment-scoped variable, exact Neon resource, three distinct Shopify Partner Client IDs, or reviewer/ownership policy was certified. Leaving both workflows active would allow operators to mistake an old format-only success for Phase 1 acceptance. Both retired jobs now **fail explicitly**, require the original exact protected source branch to run, never select a GitHub Environment, and do **not** reference scoped secrets/vars or check out code. A skipped retired run is *also not evidence*. The **sole canonical** no-deploy credential-shape workflow remains `phase1-protected-identity-preflight.yml`, pending safe protected-branch integration and independent real GitHub Environment/Shopify ownership checks. No cloud data or secrets were modified. Phase 1 stays **4/7 IN PROGRESS**.

## Full-hosted versus Phase 1 identity-only parity (2026-10-14)

A code review found that `environment-contract.mjs` enforced `NEON_PROJECT_ID` and `CLOUDFLARE_WORKER_NAME` **only for** `--identity-only`, so the nominally stricter full hosted preflight was actually weaker for endpoint resource identity. It also required neither all three Shopify app IDs nor their complete uniqueness (and used case-sensitive comparisons that could miss a hexadecimal uppercase alias). Both modes now apply the same exact target Neon/Worker and three-way Shopify Client ID isolation checks before returning success; the full mode additionally requires Phase 3/4 schema/runtime. Synthetic positive and negative regression tests prove this parity without accessing hosted accounts. No Partner ownership, GitHub Environment secret/policy source or actual credential-executed protected run is certified. **Phase 1 remains 4/7, IN PROGRESS.**

## Canonical hosted billing setting checked in both local and protected preflights (2026-10-14)

A repository CLI audit found that its Production `isTrue(flag) === false` test also passed arbitrary non-true strings (e.g. `off`, `garbage`, `0`), despite the protected inline GitHub validator already requiring the exact string `false`. The repository Staging/Production `--identity-only` and full preflight now reject *all* noncanonical values: exactly `true` for Staging, exactly `false` for Production. Node regression fixtures exercise invalid/empty values for both tiers without any live Shopify/Neon/Cloudflare access. This strengthens Phase 1 configuration checks only; actual protected GitHub Environment credential execution and Shopify Partner ownership are still missing, so **Phase 1 remains 4/7 and OPEN**.

## Verify configured GitHub variables rather than self-generated expected values

A Phase 1 audit found that the manual protected preflight's `APP_ENV` and `SHOPIFY_BILLING_TEST_MODE` environment values were **hardcoded by its own `workflow_dispatch` target**. Those earlier checks compared expected values to themselves and could not detect a GitHub Environment configured with the wrong app tier or billing mode.

The workflow now passes its dispatch target separately as `REQUESTED_TIER`, reads `APP_ENV` from `${{ vars.APP_ENV }}` and `SHOPIFY_BILLING_TEST_MODE` from `${{ vars.SHOPIFY_BILLING_TEST_MODE }}`, and validates the *effective* GitHub configuration for the selected Staging/Production tier. All four effective configuration variables (`APP_ENV`, `SHOPIFY_BILLING_TEST_MODE`, `NEON_PROJECT_ID`, `CLOUDFLARE_WORKER_NAME`) are evaluated at **runner step scope after the protected GitHub Environment is declared**, not at job-level before Environment variables become available. Missing, swapped or malformed variables **fail closed**. Existing exact Neon project, Worker, three Shopify IDs, HTTPS origin and protected-branch checks remain intact. Unit tests execute the exact inline system Python script with synthetic `vars` values and deliberately swapped/missing variables. **Neither app is deployed and no real scoped credentials were read or written** by these tests.

**Important GitHub semantics:** The `vars` context can inherit a value from the repository or organization unless a variable is configured on the selected Environment. Therefore passing the effective-value check **does not establish that a variable exists at the GitHub Environment scope**. That requires a separate authorized metadata inspection of each Environment's `APP_ENV`, `SHOPIFY_BILLING_TEST_MODE`, `NEON_PROJECT_ID` and `CLOUDFLARE_WORKER_NAME`, as well as its secret names/protections. The real manual workflow has not run on protected target branches; `development` remains unprotected and this PR stack is unmerged. Phase 1 remains **4/7 evidence-tracked, IN PROGRESS**, and no later phase can close.

## Phase 1 protected resource identity and Shopify HTTPS origin hardening

The protected, manual-only Staging/Production identity preflight now requires two **GitHub Environment-scoped non-secret variables**: `NEON_PROJECT_ID` and `CLOUDFLARE_WORKER_NAME`. They must be configured on each respective GitHub Environment. The inline Python validator checks both against exact `config/deployment/environments.json`-aligned expected tier identities: Staging project `shiny-violet-61219572` / Worker `vsn-builder-staging`, and Production project `nameless-violet-68750490` / Worker `vsn-builder-production`. A missing, swapped or invented identifier fails before any deployment and prints no credentials. This closes the gap between the CLI's identity-only mapping contract and the protected runner; it **does not** prove ownership or network connectivity.

Both the Node CLI preflight and protected runner reject reserved/placeholder Shopify application origins (`*.example.org`, `*.example.net`, `*.test`, localhost/private IP), credential-bearing URLs, custom ports, callback subpaths, query parameters and fragments. Shopify app URLs must be an exact stable HTTPS origin; a successful check remains syntax-only. Unit tests execute both real validators against synthetic fixtures with positive and negative cases.

The required secret bindings, GitHub Environment variable names, and actual protected workflow execution are **still not independently verified**; the feature is an unmerged stacked PR, `development` remains unprotected and the Stage 8 mandatory development dependency audit #96 is red. **Phase 1 remains 4/7 evidence-tracked, IN PROGRESS**.

## Phase 1 secret-scope and three-app uniqueness fix (2026-10-13)

The legacy `hosted-environment-secret-inventory.yml` formerly allowed `cloudflare-staging` environment secrets to be accessed on **either** protected `development` or protected `main`, violating the approved mapping. It now permits Staging access **only from protected `development`**; Production continues to permit **only protected `main`**. The required branch protection guard is not relaxed.

The new protected identity-only workflow additionally requires `SHOPIFY_DEVELOPMENT_CLIENT_ID`, `SHOPIFY_STAGING_CLIENT_ID`, and `SHOPIFY_PRODUCTION_CLIENT_ID` to be securely supplied as **scoped references in both Staging and Production GitHub Environments**. Client IDs are non-secret public app identifiers but still must not be logged in CI. The validator checks all three are individually well-formed, mutually distinct, do not reuse the unclassified root app identity, and that `SHOPIFY_API_KEY` matches the correct hosted tier. All values are read from the selected environment; no cross-environment secret access or cloud API calls are needed. Real Partner account ownership still requires independent verification. Existing task 1.5 and 1.6 remain **pending** until this secret inventory and protection are actually verified.

The CI unit tests extract and execute the exact inline validator with synthetic ID values and assert that wrong runtime identity, duplicates, missing identity, and unauthorized Staging-from-main workflow paths are denied. The `development` branch remains **unprotected** as of the last live read-only GitHub inspection; no actual protected run or merge has occurred.

## GitHub branch-protection verification (actual read-only GitHub, 2026-10-13)

The GitHub repository read-only **`GET /repos/.../branches/{name}`** and active repository **rulesets** API returned the following:

| Branch | GitHub `protected` | Active ruleset matching branch | Phase 1 impact |
| --- | --- | --- | --- |
| `main` | **true** | Repository ruleset `Protect main` (ID `23685287`) enforces pull requests, required checks `verify` and `Analyze JavaScript and TypeScript`, strict updates and deletion restrictions | Protected source branch requirement **met** for a future Production manual preflight, but GitHub Environment secrets/policies remain unknown |
| `development` | **false** | No active `development` ruleset returned | **BLOCKER**: manual Staging preflight requires `github.ref_protected == true`; will be skipped until the branch is actually protected |

This is a verified current observation, not a statement about **GitHub Environment reviewer** protection or scoped secret names. GitHub's branch-protection REST endpoint itself returned **403 due to this connector's missing administration permission**, while the ruleset and branch summary were readable. The branch summary plus active ruleset suffice to distinguish the actual main/dev protection state. Do **not** force `github.ref_protected` to true in code, run Staging off `main`, replace protected branch checks with a synthetic boolean, or treat skipped jobs as successful.

Sanitized, historical evidence is recorded in `config/project/phase1-github-protection-observation.json`, with `node scripts/phase1-github-protection-observation-check.mjs` checking exact-branch/prerequisite consistency. Running `node scripts/phase1-github-protection-observation-check.mjs --require-staging-protected` **currently fails intentionally**. The source of truth for current protection is GitHub itself, not this historical snapshot. Securing `development` requires a repository administrator to configure an actual active branch ruleset with appropriate required checks and merge protections; existing GitHub connection cannot change repository rulesets.

**Phase 1 remains 4/7**: task 1.6 is **not complete**, both because `development` is unprotected and because scoped GitHub Environment secret/protection policy metadata is not authenticated. Task 1.7 real protected preflight also cannot pass until then. Task 1.5 actual three Shopify Partner app identities is separately pending.

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


## Targeted Phase 3 / Phase 4 shadow migration and gated Worker batch (2026-10-14)

The owner temporarily prioritized implementation work for Phases 3 and 4 before returning to Phase 1 and billing. On a disposable branch **inside Staging's Neon project only**, 171 repository SQL statements were applied transactionally, yielding 52 tables, 168 indexes and 477 constraints. A synthetic installation/Shopify Session transaction was rolled back with both row counts returning to zero. **No Prisma migration history or main Staging/Production schema was applied** by this test. A protected, backup-gated Staging-only migration workflow was added but not executed; GitHub `development` remains unprotected and mandatory dependency audit issue #96 remains open.

A hosted Worker entry with isolated non-secret Staging/Production Wrangler configs was added for liveness, database schema check and official Shopify verified-session testing. **The real React Router merchant app/Shopify OAuth/editor routes remain HTTP 503**; both public Worker domains and cloud secrets remain unconfigured, and no deployed Worker or real merchant smoke is proven. Read the complete [Phase 3/4 audit](phase3-4-hosted-acceptance-20261014.md). The 3/5 and 1/4 evidence counts are unchanged. No phase closed.
