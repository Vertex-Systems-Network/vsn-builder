# VSN Builder — One Consolidated Development Batch / Evidence Report

**Date:** 2026-10-16 (Asia/Karachi). **Repo:** [VSN Builder](https://github.com/Vertex-Systems-Network/vsn-builder/tree/development). **Policy:** All remaining tasks are managed as one dependency-aware engineering batch, without treating legacy phases as serial gates.

## Exact task accounting — no artificial closures

- **14 FINAL CLOSED** for original narrow acceptance scopes; permanently removed from ACTIVE work.
- **27 ACTIVE** = **8 IN_REVIEW** + **19 WAITING**; **0 READY**; **0 hosted/live release-ready**.
- Opening/merging a source PR or passing synthetic CI **never** changes task acceptance to CLOSED without its real written requirements.
- Exactly one eventual public Shopify application: **VSN | Builder**. Development/Staging are internal configurations. No Free plan. Starter $30, Sliver $100, Gold $150, Platinum $350 monthly / $3,000 annual, all 10-day trials. Shopify Partner plan publication **not attested**.

## Source development in this batch

| PR | Task | Scope | Evidence/limitations |
| --- | --- | --- | --- |
| [#232](https://github.com/Vertex-Systems-Network/vsn-builder/pull/232) | T032 | Countdown ISO parsing/escaping, timer disposal on Shopify section unload, bounded interval lifetime, adversarial fake-clock tests | Squash merged `cead9ddb822c53c0be7f09e19adab9f4f0b8ffe4`; 3/3 source PR workflows green; post-merge 4/4 push workflows green; not hosted theme proof |
| [#233](https://github.com/Vertex-Systems-Network/vsn-builder/pull/233) | T014 | Reject private/special-use Staging OAuth origins, malformed/duplicate Cloudflare secret metadata | Squash merged `88fe4031df17b58a58537da4923faa98636ff06b`; 3/3 source PR workflows green; staging credentials remain absent |
| [#234](https://github.com/Vertex-Systems-Network/vsn-builder/pull/234) | T020 | Reject invalid/out-of-range stored Builder draft optimistic-lock version and regression tests | Squash merged `f9e83142f414c50f9f65f9a45188c362bf7d09e2`; 3/3 PR workflows green, including full merchant Workerd compatibility; no real merchant acceptance |
| [#236](https://github.com/Vertex-Systems-Network/vsn-builder/pull/236) | T032 | Escaped 14 blocks' plain outputs and catalog titles; preserved Shopify richtext | Squash merged at 1e24fa5a6452fba23477953fd42a8ee066c1030b, 3/3 PR CI green; not hosted theme QA |
| [#237](https://github.com/Vertex-Systems-Network/vsn-builder/pull/237) | T024 | Canonical topic/shop guard on SDK-authenticated legacy uninstall before tenant cleanup | Squash merged at 6a9ca0bc0122ceb7cc163c0a2aa41adc26fdf3a2, 5/5 PR CI green; generation attestation still missing |
| [#238](https://github.com/Vertex-Systems-Network/vsn-builder/pull/238) | T032 | Main page-builder and 20 native block editor instance/attribute checks | Squash merged at 58dc6a5a8cf59452a26aa4a35f258703adc1c2d0, 3/3 PR CI green; not merchant E2E |
| [#240](https://github.com/Vertex-Systems-Network/vsn-builder/pull/240) | T032 | Strip customer ID/name/email from app-proxy GET query; constrain same-origin Builder paths; adversarial VM tests | Squash merged 812d0c431c5e11272ea3a2d9b67ab8a76dbc1705, 3/3 exact-head PR CI green; no hosted browser QA |
| [#241](https://github.com/Vertex-Systems-Network/vsn-builder/pull/241) | T020 | Merchant page JSON scalar limits, PostgreSQL Int version bounds, consistent page summary counts and adversarial tests | Squash merged 96088aaf535adf5304679a45c5bf596e9003249f, 3/3 exact-head PR CI green incl full merchant Workerd; no hosted OAuth/E2E |

| [#243](https://github.com/Vertex-Systems-Network/vsn-builder/pull/243) | T032 | Safe same-origin wishlist product links and HTTPS images, no script/data/blob click or image schemes; VM adversarial tests normalize+card sinks | Squash merged aef60d8732d931ceda72d8917f0165d10db121c7; 3/3 exact-head PR CI green; not hosted storefront proof |
| [#244](https://github.com/Vertex-Systems-Network/vsn-builder/pull/244) | T032 | Cancel stale theme-editor app-block fetch on reselect/unload; ignore detached or out-of-order response; exact proxy URL contract | Squash merged 321d362cebb0dad4792d9ab7e345a15b0dcba9b8; 3/3 exact-head PR CI green; real theme editor merchant QA pending |

**2026-10-16 T024 source security continuation:** Legacy Shopify uninstall Node handler previously deleted entire shop data/sessions from an HMAC-validated event lacking independently trusted install-generation identity. That is unsafe after reinstall. It now rejects deletion and responds 503 with Retry-After until transactionally attested generation handling is implemented; actual action VM regression tests execute signed/invalid inputs. Real app/uninstalled delivery and GDPR/merchant cleanup acceptance remain pending.

**Newest verified source batch — 16 October 2026:** [PR #249](https://github.com/Vertex-Systems-Network/vsn-builder/pull/249) T024 valid but unproven pre-reinstall uninstall webhooks no longer delete current merchant data; [PR #250](https://github.com/Vertex-Systems-Network/vsn-builder/pull/250) T013 protected-development push attests real GitHub effective rules, **live run #38909028455 fails NO_REQUIRED_HUMAN_APPROVAL** (real admin blocker); [PR #251](https://github.com/Vertex-Systems-Network/vsn-builder/pull/251) T020 editor hydration enforces PostgreSQL 32-bit version with signed boundary, tenant forgery and closed-lease tests (**4/4 PR CI green**, merge `15455cdf40941b353a2e7fa30b60eba15e636100`). No hosted merchant/Live acceptance from these source merges.

**AI-only review policy — 16 October 2026 (user-approved):** All PR design/code/security review is the AI engineering agent's responsibility, backed by mandatory GitHub PR and deterministic security/test CI. **0 human approval required**; protected `development`, `repository-integrity` required status, force-push and deletion restrictions remain mandatory. GitHub effective-rule read-only attestation now rejects human approval prerequisites rather than requiring them. A passing CI check **does not mean** an independent AI model reviewed code; code review must be performed by the agent with recorded PR evidence. Real GitHub Environment secrets and hosted Shopify/Neon validation remain separately blocked. T013 remains IN_REVIEW until a new protected push attestation passes; no Live/Staging deployment authorized.

## Live control-plane audit (metadata only, NO MUTATIONS)

- **GitHub:** development.protected=true independently confirmed. The repository-integrity check was enforced by GitHub during PR #247; T013 now runs GET-only effective rules attestation automatically on protected development pushes. Required approval/reviewer/Environment scopes still unverified.
- **Cloudflare:** API GET 200 for Staging and Production Worker settings/secrets/subdomain. Both `vsn-builder-staging` and `vsn-builder-production` have **0 script secrets, 0 settings bindings**, and **workers.dev subdomain disabled**. Do not deploy OAuth without correct protected bindings.
- **Neon Free-tier policy:** Staging project `vsn-builder-staging` uses the Free plan. Its paid protected-branch action was rejected HTTP 422; this is now **not** a mandatory Staging acceptance. The reviewed source policy allows only the exact pinned Staging project/branch (unprotected), real backup snapshot, correctly paired pooled/direct TLS compute and GitHub-protected manually approved environment workflow. Production is a separate Neon project and has no Free-tier release waiver. No SQL was executed.
- **Neon SINGLE-BRANCH CLEANUP VERIFIED:** Staging `shiny-violet-61219572` now has **exactly one live default** `br-square-mountain-b3ij6q2s`; Production `nameless-violet-68750490` has **exactly one default** `br-odd-credit-b3rzlpz9`. User-approved deletion of obsolete Staging QA/recovery branches occurred after all 52 QA tables were counted at **0 rows** and SQL schema/migrations were preserved in repo. Manual snapshot `snap-green-bar-b3m1btfb` remained listed after deleting historical source; recovery restore has NOT been tested. Staging default has **0 app tables**; no migration took place.
- **Shopify:** Store connections `Local Server`, `Staging`, `Production` were read and returned live stores. Store connectivity does **not** certify Partner legal ownership, Builder installation/OAuth, paid-plan publication, or actual App Store eligibility.
- No production release, Worker script mutation, Neon default schema change, Shopify plan charges, or Shopify submission was performed.

## Single-batch 27-item blocker matrix

| ID | Priority | Work | Verified status | Missing acceptance / next unblock |
| --- | --- | --- | --- | --- |
| T013 | P0 | AI-led automated PR and repository-integrity protected-branch verification | IN_REVIEW | User-approved zero-human-review policy implemented in source; postmerge effective-rules PASS not yet verified |
| T014 | P0 | Configure/verify GitHub Environment secrets and tier variables | IN_REVIEW | GitHub scoped Environment policies not authenticated; both Workers have no bindings |
| T015 | P0 | Verify single public Shopify Builder app and internal Dev/Staging identities | IN_REVIEW | Three connected Shopify stores verified; Partner public-app ownership and OAuth missing |
| T016 | P0 | Real Neon Staging pooled/direct credentials and connectivity | WAITING | Requires T014; scoped pooled/direct Neon URL pairing not certified |
| T017 | P0 | Live Neon snapshot/default/compute attestation in protected preflight | IN_REVIEW | Exactly one active Staging branch verified after deleting two obsolete branches; historical snapshot still listed; real scoped manual preflight pending |
| T018 | P0 | GitHub-reviewed Staging Prisma migration and restore drill | WAITING | Needs protected GitHub source/Environment, paired scoped URLs, manual approval, read-only backup preflight and rollback; Neon paid protection not required |
| T019 | P0 | Bind and verify real Cloudflare Staging secrets and tier variables | WAITING | Requires T014/T015/T016 and actual encrypted Staging secrets |
| T020 | P0 | Implement functional hosted React Router/Shopify Worker adapter | IN_REVIEW | Worker SDK/router source & local Workerd CI; real hosted OAuth/editor/Neon missing |
| T021 | P0 | Staging Worker deploy and stable HTTPS callback acceptance | WAITING | Requires protected migrated Staging, bound Worker, real HTTPS callbacks |
| T022 | P0 | Real Dev Shopify test-store install, OAuth and session acceptance | WAITING | No authenticated Development test-store Builder install |
| T023 | P0 | Real Staging Shopify OAuth, App Bridge ID token and session lifecycle | WAITING | Requires T015/T021/T022 and real Staging OAuth/session lifecycle |
| T024 | P0 | Trusted uninstall-generation provenance and safe replay handling | IN_REVIEW | No trusted independent install-generation webhook attestor |
| T025 | P0 | Real signed Shopify webhook retry/uninstall/reinstall E2E | WAITING | Requires real migrated Staging + webhook provenance and merchant E2E |
| T028 | P0 | Create/verify exactly four public plans in Shopify Partner Dashboard | WAITING | Partner Dashboard 4 public paid plans not independently published/verified |
| T029 | P0 | Real subscription/trial lifecycle and plan limits E2E | WAITING | Requires real OAuth + published Shopify plan/trial lifecycle testing |
| T030 | P1 | Real Dev create/edit/save/preview and reload persistence | WAITING | Needs real Development install & save/reload acceptance |
| T031 | P1 | Real Staging create/edit/save/publish Shopify page persistence | WAITING | Needs migrated Staging, OAuth, Development editor acceptance |
| T032 | P1 | Templates/Widgets/theme app assets implementation and synthetic QA | IN_REVIEW | Native countdown/source QA merged in #232; real supported Shopify theme/browser QA open |
| T033 | P1 | Real Shopify theme extension storefront/mobile E2E | WAITING | Requires T031/T032 merchant Shopify storefront + mobile tests |
| T034 | P1 | AI/widgets/pages/seats quotas across Starter-Sliver-Gold-Platinum | WAITING | Requires T031 + real four-plan quota billing and merchant use |
| T035 | P1 | Full Staging test-store browser/device/billing/webhook E2E | WAITING | Requires webhook, billing, theme, quota end-to-end test evidence |
| T036 | P0 | Staging deployment rollback and post-migration restore acceptance | WAITING | Requires reviewed Staging deploy plus irreversible restore/rollback proof |
| T037 | P0 | Production Neon isolated migration, backup and recovery proof | WAITING | Requires full accepted Staging release and isolated Production backups/migrations |
| T038 | P0 | Authorized production Worker/promoted exact SHA and secrets | WAITING | Requires T037, protected exact SHA, Worker secrets and safe promotion |
| T039 | P0 | Live merchant smoke, safety rollback and payment verification | WAITING | Requires paid Live merchant smoke/rollback after T038 |
| T040 | P1 | Shopify listing screenshots, privacy, support, scopes and review assets | IN_REVIEW | Listing draft exists but verified 5 screenshots/privacy/support/Partner review missing |
| T041 | P0 | Attempt Shopify App Store submission only after release certification | WAITING | Requires all release/security/merchant gates; no Shopify submission yet |

## Integration decision

Merge isolated code changes only after exact-head mandatory CI, and check development push CI independently. Current top-level release remains **BLOCKED** by missing protected GitHub ref/review rules, actual scoped secrets, GitHub-reviewed Neon Free-plan Staging migration and real Shopify Partner/merchant E2E. Finish all independent source/test work as one batch, but do **not** bypass these gates to claim complete or submit to Shopify.

See [canonical task manifest](../config/project/task-dependency-plan.json) and [active task board](../TASKS.md). This report is evidence, not a new task tracker or a reset of FINAL CLOSED scopes.
