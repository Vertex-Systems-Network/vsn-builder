# VSN Builder — Final Closed Task Archive

**Final closure policy (15 Oct 2026):** A CLOSED task is permanently complete for its precise acceptance scope, cannot be reopened, is excluded from the active/backlog/READY tables, and satisfies DAG prerequisites. This archive is audit-only. Any later, broader requirement is a different task ID.

Historical evidence below is LOCAL/CI/synthetic or a specifically described snapshot. These closures do **not** certify hosted Shopify merchant routing, real OAuth, Neon primary migration, paid billing, Live deployment, or App Store submission.

| Task | Closed on | Precisely accepted work | Evidence |
| --- | --- | --- | --- |
| T001 | 2026-10-15 | Environment isolation and fail-closed config templates — Historical configuration/synthetic identity checks only; no external Shopify account or secret proof | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/94) |
| T002 | 2026-10-15 | Local SQLite migration and synthetic desktop/mobile browser acceptance — Local CI only, real Dev test-store not included | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/114) |
| T003 | 2026-10-15 | PostgreSQL schema parity, disposable SQL CRUD/rollback — Disposable PostgreSQL acceptance, not Neon primary migration | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/141) |
| T004 | 2026-10-15 | Local Workerd SDK/Prisma SSR and Wrangler dry-run compile — Actual CI Workerd + disposable Postgres success; NO deployed Worker | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38475181411) |
| T005 | 2026-10-15 | Neon Staging shadow-branch SQL migration/savepoint rollback — 171 SQL statements on isolated QA branch; 52 tables; NOT Prisma migration history/default branch | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/155) |
| T006 | 2026-10-15 | Staging pre-migration root snapshot and empty-baseline restore — Real snapshot and default-branch switch; restore contains 0 app tables, not migrated schema | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/155) |
| T007 | 2026-10-15 | Shopify official SDK synthetic session and tenant gate — Synthetic SDK CI tests only; no real merchant login | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/135) |
| T008 | 2026-10-15 | Webhook HMAC and transactional mutation synthetic security — Synthetic signed-webhook and rollback tests only; trusted install attestation not implemented | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/pull/141) |
| T009 | 2026-10-15 | Internal editor/components/AI QA scripts — Internal code QA only; real merchant create/publish not accepted | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38411932985) |
| T010 | 2026-10-15 | Adopt dependency-based task board, validator, issue mapping — Plan PR must pass task graph tests; no silent phase-based scheduling | [Proof 1](https://github.com/Vertex-Systems-Network/vsn-builder/issues/156), [Proof 2](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38729990514) |

**Integrity:** `config/project/task-dependency-plan.json` keeps all 41 IDs plus `closed_task_ids` so references remain resolvable; `scripts/task-dependency-check.mjs` enforces the registry. `node scripts/task-dependency-check.mjs --format=markdown --include-closed` displays archived entries on explicit request. Ordinary active views exclude them.
