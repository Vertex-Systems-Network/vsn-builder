# Runner Benchmark & Deferred CI Optimization Plan

Issue: #76

## Purpose

This document is the persistent benchmark/backlog for GitHub Actions runner work discovered while feature and security development continues. Runner optimization is intentionally deferred so unrelated feature PRs stay behavior-focused and easy to review.

Required protected security/quality checks are **not** deferred. They still run before every protected merge.

## Current runner inventory

| Stage | Current command / action | Merge-blocking | Benchmark later |
| --- | --- | --- | --- |
| Checkout | pinned `actions/checkout` | yes | checkout/cache overhead |
| Node setup | pinned `actions/setup-node`, npm cache | yes | cache hit/miss timings |
| Dependency install | `npm ci` | yes | wall time / cache reuse |
| Prod dependency audit | `npm audit --omit=dev --audit-level=high` | yes | audit wall time |
| Dev dependency audit | `npm audit --include=dev --audit-level=high` | yes | audit wall time |
| Custom security | `npm run security:audit` | yes | split/parallel feasibility |
| Webhook/SSRF security | legacy webhook egress audit | yes | split/parallel feasibility |
| Prisma | generate + migrate deploy | yes | generated-client cache feasibility |
| Lint diagnostics | lint JSON artifact | non-blocking diagnostics | artifact cost |
| Typecheck | `npm run typecheck` | yes | split/parallel feasibility |
| Build | `npm run build` | yes | build cache potential |
| Release QA | `npm run qa:release` + log artifact | yes | audit fan-out / timing |
| Deterministic AI eval | artifact upload | diagnostics | artifact cost |
| External phase-1 | protected-credential QA on non-PR events | yes when executed | duplicate event cost |
| Large-page performance | `npm run performance:large-pages` | yes | independent job potential |
| Playwright package | temporary exact-pin `@playwright/test@1.63.0` | yes | locked toolchain alternative |
| Post-Playwright audit | high-severity dev audit | yes | preserve security invariant |
| Browser install | Chromium + Firefox + WebKit with deps | yes | browser cache reuse |
| External Playwright E2E | protected-credential E2E on non-PR events | yes when executed | duplicate event cost |
| CodeQL | JS/TS CodeQL workflow | yes | workflow/event duplication |

## Observed baseline evidence

### 2026-09-20 / P1.6m PR #78

- The same commit head produced duplicate `verify` checks and duplicate JavaScript/TypeScript CodeQL analyses because both push and pull-request events fired.
- One verify run may queue while the other executes, so duplicate event coverage can increase both runner minutes and protected-merge latency.
- Release QA intentionally runs with `continue-on-error` so diagnostics can upload; the separate enforcement step is the real merge gate. Benchmark/reporting must use the release-QA **outcome**, not only the displayed step conclusion.
- Browser installation remains a late, comparatively expensive runner phase; preserve the post-Playwright high-severity dependency audit when benchmarking browser/toolchain caching.

## Deferred benchmark backlog

1. Measure total runner minutes for one protected merge, including duplicate push + pull_request runs.
2. Measure `npm ci` cold vs warm cache wall time and cache hit reliability.
3. Benchmark eliminating duplicate push/PR verification for the same commit while preserving required status contexts.
4. Benchmark splitting the monolithic verify job into dependency/security, build/release, performance, and E2E jobs.
5. Benchmark Playwright browser cache reuse vs full `playwright install --with-deps`.
6. Benchmark replacing temporary `npm install --no-save @playwright/test` with a locked CI toolchain/devDependency while preserving the post-install dependency-audit property.
7. Measure artifact upload overhead for lint, release QA, and deterministic AI eval diagnostics.
8. Measure external phase-1 and Playwright E2E duplication between push/PR contexts.
9. Compare runner minutes and wall-clock latency before/after changes.
10. Keep a rollback path for every runner optimization; never weaken security gates to gain speed.

## Batch execution rule

Do not mix runner optimizations into normal P1.6 feature/refactor PRs. Add observations/tasks to this file and Issue #76 as they are discovered. Execute the accumulated backlog together in a dedicated runner-optimization milestone after the current decomposition work.

## Benchmark acceptance targets

Targets will be finalized after baseline measurement. The batch must at minimum preserve:

- all branch-protection-required checks;
- production/dev high-severity dependency audits;
- post-Playwright high-severity audit or an equivalent stronger locked-toolchain invariant;
- custom security + webhook/SSRF audits;
- CodeQL / GitHub Advanced Security;
- build, typecheck, release QA and performance gates;
- external protected-credential QA/E2E coverage;
- reproducible pinned action/tool versions.
