# VSN Builder — ACTIVE Development Task Board

**Verified state: 15 October 2026.** A task marked **CLOSED means final complete** for its written acceptance scope and is **excluded from every active/READY/WAITING list**. Closed work is never reopened; new or larger work requires a separate task ID. The immutable [closure audit archive](docs/closed-task-archive.md) retains evidence without keeping completed work in the queue.

**28 ACTIVE** of 41 tracked tasks · **1 READY** · **8 IN_REVIEW** · **19 WAITING** · **0 release-ready**. The historical 13 final closures are audit entries, **not active development**. Counts are task-state, not product completion percentages.

**Work order:** dependency-first, not phase-first. Mandatory release and Shopify safeguards remain in place. One public VSN | Builder app; Starter $30, Sliver $100, Gold $150, Platinum $350 monthly/$3,000 annually; each 10-day Shopify trial, no Free tier.

**Current integration evidence:** [draft PR #190](https://github.com/Vertex-Systems-Network/vsn-builder/pull/190) is still **unmerged to `development`**; [T020 local Workerd](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38729990503), [T011 security](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38729990721) and [Production Confidence](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38729990508) CI passed on prior integration candidate, **not hosted merchant acceptance**. Worker `/app` and `/auth/*` still return 503, Staging Neon primary has no app tables, and `development` lacks enforced branch protection. Do not ship Live or submit to Shopify.

## Current actionable tasks

**READY now:** `T015`.

**Code/merge IN_REVIEW:** `T012`, `T013`, `T014`, `T017`, `T020`, `T024`, `T032`, `T040`.

**T024 in review:** [PR #193](https://github.com/Vertex-Systems-Network/vsn-builder/pull/193) hardens webhook read deadlines; real trusted generation and uninstall E2E still OPEN.

**T013 in review:** [PR #194](https://github.com/Vertex-Systems-Network/vsn-builder/pull/194) tests effective GitHub branch policy; live development protection still missing. No deployment approval.

**T032 IN_REVIEW:** [PR #197](https://github.com/Vertex-Systems-Network/vsn-builder/pull/197) passes 26 Liquid blocks/14 asset static checks; actual supported theme fixtures still pending.

**T040 IN_REVIEW:** [PR #199](https://github.com/Vertex-Systems-Network/vsn-builder/pull/199) contains listing draft and fails closed on missing privacy/support/screenshots; no Partner upload or submission.

**T026 FINAL CLOSED:** [PR #196](https://github.com/Vertex-Systems-Network/vsn-builder/pull/196) and audited mutation inventory close the server paid-access code scope. Live Shopify subscription/trial E2E is T029 and still pending.

**New FINAL CLOSED:** T011 full-dev/production/post-Playwright security audits and T027 exact four paid plan **code contract**. These now appear solely in [audit archive](docs/closed-task-archive.md); release integration T012 and Shopify Partner pricing T028 remain open.

**T014 IN_REVIEW:** [PR #205](https://github.com/Vertex-Systems-Network/vsn-builder/pull/205) adds encrypted Cloudflare Worker binding checks. Real Staging audit found 0 Worker secrets and 0 bindings; GitHub Environment reviewers remain unverified. T019/T018 remain WAITING.

## Entire ACTIVE queue (CLOSED tasks removed)

| ID | Priority | Task | Status | Unmet dependency | Work package |
| --- | --- | --- | --- | --- | --- |
| T012 | P0 | Review/rebase/merge stacked PRs with mandatory exact-SHA CI | IN_REVIEW | — | [issues/157](https://github.com/Vertex-Systems-Network/vsn-builder/issues/157) |
| T013 | P0 | Protect development branch and verify GitHub required reviewers | IN_REVIEW | — | [issues/158](https://github.com/Vertex-Systems-Network/vsn-builder/issues/158) |
| T014 | P0 | Configure/verify GitHub Environment secrets and tier variables | IN_REVIEW | — | [issues/158](https://github.com/Vertex-Systems-Network/vsn-builder/issues/158) |
| T015 | P0 | Verify single public Shopify Builder app and internal Dev/Staging identities | READY | — | [issues/159](https://github.com/Vertex-Systems-Network/vsn-builder/issues/159) |
| T016 | P0 | Real Neon Staging pooled/direct credentials and connectivity | WAITING | T014 | [issues/160](https://github.com/Vertex-Systems-Network/vsn-builder/issues/160) |
| T017 | P0 | Live Neon snapshot/default/compute attestation in protected preflight | IN_REVIEW | — | [issues/160](https://github.com/Vertex-Systems-Network/vsn-builder/issues/160) |
| T018 | P0 | Protected Staging Prisma migrate deploy and data restore drill | WAITING | T011, T012, T013, T014, T016, T017 | [issues/160](https://github.com/Vertex-Systems-Network/vsn-builder/issues/160) |
| T019 | P0 | Bind and verify real Cloudflare Staging secrets and tier variables | WAITING | T014, T015, T016 | [issues/161](https://github.com/Vertex-Systems-Network/vsn-builder/issues/161) |
| T020 | P0 | Implement functional hosted React Router/Shopify Worker adapter | IN_REVIEW | — | [issues/161](https://github.com/Vertex-Systems-Network/vsn-builder/issues/161) |
| T021 | P0 | Staging Worker deploy and stable HTTPS callback acceptance | WAITING | T011, T012, T013, T018, T019, T020 | [issues/161](https://github.com/Vertex-Systems-Network/vsn-builder/issues/161) |
| T022 | P0 | Real Dev Shopify test-store install, OAuth and session acceptance | WAITING | T015 | [issues/162](https://github.com/Vertex-Systems-Network/vsn-builder/issues/162) |
| T023 | P0 | Real Staging Shopify OAuth, App Bridge ID token and session lifecycle | WAITING | T015, T021, T022 | [issues/162](https://github.com/Vertex-Systems-Network/vsn-builder/issues/162) |
| T024 | P0 | Trusted uninstall-generation provenance and safe replay handling | IN_REVIEW | — | [issues/163](https://github.com/Vertex-Systems-Network/vsn-builder/issues/163) |
| T025 | P0 | Real signed Shopify webhook retry/uninstall/reinstall E2E | WAITING | T018, T023, T024 | [issues/163](https://github.com/Vertex-Systems-Network/vsn-builder/issues/163) |
| T028 | P0 | Create/verify exactly four public plans in Shopify Partner Dashboard | WAITING | T015 | [issues/164](https://github.com/Vertex-Systems-Network/vsn-builder/issues/164) |
| T029 | P0 | Real subscription/trial lifecycle and plan limits E2E | WAITING | T023, T028 | [issues/164](https://github.com/Vertex-Systems-Network/vsn-builder/issues/164) |
| T036 | P0 | Staging deployment rollback and post-migration restore acceptance | WAITING | T018, T021, T035 | [issues/166](https://github.com/Vertex-Systems-Network/vsn-builder/issues/166) |
| T037 | P0 | Production Neon isolated migration, backup and recovery proof | WAITING | T011, T012, T013, T014, T035, T036 | [issues/167](https://github.com/Vertex-Systems-Network/vsn-builder/issues/167) |
| T038 | P0 | Authorized production Worker/promoted exact SHA and secrets | WAITING | T011, T012, T014, T020, T036, T037 | [issues/167](https://github.com/Vertex-Systems-Network/vsn-builder/issues/167) |
| T039 | P0 | Live merchant smoke, safety rollback and payment verification | WAITING | T029, T038 | [issues/167](https://github.com/Vertex-Systems-Network/vsn-builder/issues/167) |
| T041 | P0 | Attempt Shopify App Store submission only after release certification | WAITING | T011, T025, T029, T035, T039, T040 | [issues/168](https://github.com/Vertex-Systems-Network/vsn-builder/issues/168) |
| T030 | P1 | Real Dev create/edit/save/preview and reload persistence | WAITING | T022 | [issues/165](https://github.com/Vertex-Systems-Network/vsn-builder/issues/165) |
| T031 | P1 | Real Staging create/edit/save/publish Shopify page persistence | WAITING | T018, T023, T030 | [issues/165](https://github.com/Vertex-Systems-Network/vsn-builder/issues/165) |
| T032 | P1 | Templates/Widgets/theme app assets implementation and synthetic QA | IN_REVIEW | — | [issues/165](https://github.com/Vertex-Systems-Network/vsn-builder/issues/165) |
| T033 | P1 | Real Shopify theme extension storefront/mobile E2E | WAITING | T031, T032 | [issues/165](https://github.com/Vertex-Systems-Network/vsn-builder/issues/165) |
| T034 | P1 | AI/widgets/pages/seats quotas across Starter-Sliver-Gold-Platinum | WAITING | T031 | [issues/165](https://github.com/Vertex-Systems-Network/vsn-builder/issues/165) |
| T035 | P1 | Full Staging test-store browser/device/billing/webhook E2E | WAITING | T025, T029, T033, T034 | [issues/166](https://github.com/Vertex-Systems-Network/vsn-builder/issues/166) |
| T040 | P1 | Shopify listing screenshots, privacy, support, scopes and review assets | IN_REVIEW | — | [issues/168](https://github.com/Vertex-Systems-Network/vsn-builder/issues/168) |

## Commands & gates

`node scripts/task-dependency-check.mjs` prints only READY items and active summary.
`node scripts/task-dependency-check.mjs --format=markdown` prints only active tasks.
`node scripts/task-dependency-check.mjs --format=markdown --include-closed` explicitly displays audit history.
`node --test tests/task-dependency-check.test.mjs` enforces irreversible final closure, required release prerequisites, and the four paid Shopify plan contract.

Full mapping: [canonical dependency roadmap](docs/task-dependency-roadmap.md) · [task manifest](config/project/task-dependency-plan.json) · [master issue #156](https://github.com/Vertex-Systems-Network/vsn-builder/issues/156). No production/staging deployment or Shopify submission is authorized by closing local tasks.
