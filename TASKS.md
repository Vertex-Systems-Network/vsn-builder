# VSN Builder — Live Dependency Task Board

**Execution policy (14 Oct 2026): Task prerequisites decide readiness. No phase numbers or serial phase closeout order are used to schedule development.**

Canonical detail: [41 atomic tasks and dependencies](docs/task-dependency-roadmap.md). Machine-readable state: [task-dependency-plan.json](config/project/task-dependency-plan.json). [Master GitHub board #156](https://github.com/Vertex-Systems-Network/vsn-builder/issues/156).

Run `node scripts/task-dependency-check.mjs` to list next READY P0/P1 tasks; `node scripts/task-dependency-check.mjs --format=markdown` for the entire backlog; `node --test tests/task-dependency-check.test.mjs` for graph regression.

**Current status:** 41 total tasks, 9 narrowly VERIFIED, 6 IN REVIEW, 7 READY and 19 WAITING for explicit dependencies. These counts are not a deployability score.

**READY tasks:** `T011` security audit, `T013` GitHub branch protection, `T014` environment secrets, `T015` ONE public Shopify app ownership, `T024` trusted webhook generation, `T032` theme/template/widget code QA and `T040` Shopify listing content.

**Commercial contract:** Starter $30/mo, Sliver $100/mo, Gold $150/mo, Platinum $350/mo or $3,000/year. Four paid plans, exact plan IDs, 10-day Shopify trial each. No Free public plan. Only VSN | Builder Live can be submitted.

**Now in review:** `T026` paid mutation guard [PR #170](https://github.com/Vertex-Systems-Network/vsn-builder/pull/170), not verified or merchant-accepted.

**IN REVIEW:** `T020` Web Streams SSR [PR #172](https://github.com/Vertex-Systems-Network/vsn-builder/pull/172) (full Shopify hosted route graph still pending); `T012` source reconciliation [PR #171](https://github.com/Vertex-Systems-Network/vsn-builder/pull/171); exact-head combined CI and mandatory audit pending.

**External blockers remain:** GitHub protected development and scoped secrets unverified; Neon default Staging/Production have no actual Prisma migration history/app tables; Cloudflare Builder Staging/Production Workers have no secrets/bindings; mandatory npm development dependency audit `braces` #96 is red; real merchant Shopify auth/billing not accepted.

Release and Shopify submission require independently verified exact-SHA security checks, actual hosted runtime, merchant E2E, backup/rollback and protected approvals. `T041` remains WAITING until these specific gates pass. Never change task statuses merely to create an artificial pass.
