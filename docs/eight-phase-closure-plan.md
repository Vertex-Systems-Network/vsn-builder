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

## Phase 1 identity-only preflight (no Worker/DB deployment)

A previously discovered **phase dependency deadlock** made a strict Staging/Production `env:*:check` require `workers/app.js` and Cloudflare release wiring, even though the approved execution sequence reserves actual hosted application setup for **Phase 4**. This would block legitimate Phase 1 identity verification until a later phase.

Two new **configuration-only** commands separate that concern without changing existing deployment gates:

```bash
npm run env:staging:identity:check
npm run env:production:identity:check
```

They require the tier's *actual* environment variables (never check secrets into Git). Both validate the Shopify Client ID and secret presence, tier-specific billing test mode, HTTPS app URL, exact independent `NEON_PROJECT_ID` and `CLOUDFLARE_WORKER_NAME`, and pinned Neon direct/pooled hosts, matching database name/role and TLS. Production must use the explicit matching `SHOPIFY_PRODUCTION_CLIENT_ID`; Staging must not reuse the supplied Production identity. The Local preflight still checks the unique runtime `shopify.app.local.toml` Dev app and SQLite. No mode prints credentials or accesses remote services.

**Security distinction:** Existing `npm run env:staging:check` and `npm run env:production:check` continue to require Phase 3 schemas/migrations and Phase 4 real Worker entry/configuration, and remain FAIL-CLOSED. An identity-only result proves **syntax and cross-tier mapping only**, not that Shopify owns the Client ID, GitHub scoped secrets exist, Neon credentials work, or the Workers serve app code. GitHub Environments and real credential preflight require separate authorized, protected execution on the appropriate branches. CI tests use fake credentials solely to validate these checks and their rejection cases.

Phase 1 stays **4/7 evidence-tracked; NOT closed**, until separately authenticated Shopify registration, GitHub secret bindings/protection and actual protected tier-specific preflight are verified. Code having an identity preflight does not make its real invocation passed.

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
