# VSN Live Work State

---
schema_version: 1
status: active
mode: implementation
task_key: eight-plan-quota-hardening
owner_intent: "Close the audited quota bypasses and race conditions for the eight paid plans."
base_branch: development
working_branch: codex/eight-plan-quota-hardening
pull_request: 396
last_verified_commit: afe2882cc65473d6260dd23e454c63775f59a0fe
last_verified_step: "PR #396 exact-head checks passed on afe2882cc65473d6260dd23e454c63775f59a0fe: Production Confidence, T020 Worker compatibility, T021 Staging artifact dry run, T026, CodeQL, repository integrity, and environment isolation. Local Node 22.18.0 typecheck/QA, 27 focused tests, Milestone H audit (39/39), codebase health, touched-file ESLint, and git diff --check pass. PR review is pending."
in_flight_step: "Commit corrected test expectations for requested prices to PR #396 and recheck exact-head CI"
next_exact_action: "Wait for PR #396 exact-head CI after correcting the stale price expectations; fix any further failures before requesting review."
approval_needed_now: false
updated_at: 2026-10-27
---

## Eight paid plan catalog — 2026-10-26

- Public plan keys and labels: Starter, Solo, Silver, Gold, Business, Platinum, Agency, Scale. No public Free plan; inactive stores receive no entitlement.
- Updated the shared catalog, Partner-handle mapping/legacy aliases, server-side quotas, plan cards and comparison table, worker plan mirror, tests, audits, docs and task manifest.
- Verification on supported Node 22.18.0: `npm run typecheck`, `npm run lint`, `npm run qa`, and 62 focused billing/entitlement tests passed. `git diff --check` passed. Shopify Partner plan publication/pricing is still a required external step; no hosted Staging result is claimed.
- The local `git push` had no credentials; branch/PR updates were published through the connected GitHub integration.
- CI exposed and the PR fixed three stale contract expectations: unknown monthly plan keys, legacy `sliver` normalized to canonical `silver`, and the Q5.1/Q5.3/Q5.5 audit assumptions. Latest exact PR head passed all observed workflows, including T021 artifact dry-run; no hosted Staging deployment has been run.
- Shopify Partner publication and live billing verification for all eight offers remain pending; prices in code are proposed values until Partner configuration is verified.

## Eight-plan quota hardening — 2026-10-27

- Started from protected development SHA `efd6c9b7263e0fa50c2a84e253c1c4f741315483` on `codex/eight-plan-quota-hardening`.
- Added transactional per-shop quota serialization and removed fail-open zero-usage fallbacks. Applied it to page creation, import (including imported section dependencies), duplication, restore, backup restore, onboarding demo seeding, campaigns, floating elements, Marketplace installs, CRO experiment creation/duplication/reactivation, AI generation reservations, and collaboration seats. Backup restore also checks page and marketplace-install capacity. Worker page creation uses the shared quota lock. Marketplace free-tier catalog items now require Starter rather than mapping the catalog label `free` to the inactive billing tier.
- Initial exact-head CI found two gates: `app/routes/app.pages.jsx` exceeded the Milestone G line ceiling by three counted lines, and the Milestone H static audit expected an inline `db.$transaction` call in the import service. Both are corrected: create/duplicate use `createPageWithQuota`, and the audit verifies the shared `withShopQuotaLock` transaction helper. Milestone H passes 39/39 and codebase health passes at 1,214/1,225 lines. On Node 22.18.0, typecheck, QA (429 files; Phase C 112/112), focused billing/plan/Worker tests (27/27), touched-file ESLint, and `git diff --check` pass. Exact-head CI on `afe2882` passed all seven required workflows, including the T021 dry run. PR review is still required before merge; no Staging promotion has occurred.

## Purpose

This file is the live execution cursor for VSN engineering work. It exists so a new AI session can recover the exact work position from the repository without asking the owner to restate prior progress.

`CHECKPOINT.md` records stable verified project state. `WORK_STATE.md` records the current task cursor, including work that may be paused or in progress.

## Silent resume contract

When a user says any equivalent of `continue`, `resume`, `start development`, `carry on`, or gives a new instruction that clearly continues the active task, the AI MUST NOT ask where the previous session stopped if repository evidence can resolve it.

Instead it must:

1. read `.ai/README.md`, this file, and `.ai/CHECKPOINT.md`;
2. inspect current Git branch/status, recent commits, referenced PR/issue and the task-relevant source;
3. compare repository evidence with the fields above;
4. reconcile stale state silently when the answer is recoverable from Git/repository evidence;
5. verify whether any `in_flight_step` actually completed before repeating it;
6. continue from `next_exact_action` or the earliest unverified sub-step;
7. ask the owner only when a genuinely material product/security/data-loss decision cannot be resolved from repository evidence.

Conversation memory is never required for resume.

## Two-phase work cursor

For every non-trivial implementation step, update this file using two phases whenever repository writes are available.

### Before execution

Set:

- `status: active`;
- `in_flight_step` to one precise action;
- the expected evidence that would prove completion in the notes below when useful;
- `next_exact_action` to the recovery action if the session stops during that step.

This creates a recoverable intent marker before the risky or multi-file operation starts.

### After verification

Only after inspecting the result:

- move the completed action into `last_verified_step`;
- update `last_verified_commit` when a commit exists;
- clear `in_flight_step` to `none`;
- set the next precise action;
- record validation results or failures in `CHECKPOINT.md` when they are durable/significant.

If a session dies between the two phases, the next AI must inspect whether the intended operation landed. It must never assume success and must never blindly execute the step twice.

## Update cadence

Update the live cursor at least:

- when starting a new meaningful task;
- before a destructive, high-impact, long-running or multi-file operation;
- after each coherent implementation unit is verified;
- after a test/build/migration/deployment result materially changes what should happen next;
- when switching branches or PRs;
- before an intentional handoff/pause;
- when blocked by an external dependency or required human approval.

Do not update it for every keystroke or trivial local edit.

## Recovery rules

- Repository state and tests override this file when they disagree.
- Never resume from a stale SHA without checking current branch history.
- Never overwrite uncommitted or collaborator changes just to restore the recorded cursor.
- If the recorded branch was merged, continue from current target branch and preserve the historical task reference.
- If the recorded PR was closed without merge, determine whether the task was superseded before reviving it.
- If an `in_flight_step` changed external state, verify idempotency and actual remote state before retrying.
- If tests previously failed, do not treat them as passed merely because the next session started later.
- If a task is fully complete, set `status: complete`, clear `in_flight_step`, and set `next_exact_action` to the next roadmap item or `none`.

## Current state

**2026-10-26:** PR #384 wired the full React Router app to the Staging Worker; PR #385 repaired the protected deploy config guard; PR #386 added safe session persistence reason codes. All three are merged to protected `development`, and T021 run #34 deployed `45e9d41b342721f3ccce8a10f81512d1d90c9a6a` to Staging. Live Shopify Admin showed the full navigation and plan catalog, but repeat opens/navigation failed intermittently. Protected T023 run #21 recorded Cloudflare invocation outcome `exceededCpu`, which is the current blocker. Production remains untouched.

**2026-10-26 billing follow-up:** PR #391 at `02ecff5a5dadcf1666ae7d73e8d959851820d827` is merged and its T021 run #39 passed. Live Staging now loads Dashboard and Plans & License; forced billing refresh says `Shopify subscription status verified.` The current subscription is `canceling` through 2026-11-24, while entitlements remain fail-closed with 0 pages and source `production-unrecognized-paid-contract`. Shopify hosted App Pricing confirms subscription expiration on 2026-11-24. A Tier-1 branch `fix/staging-plan-handle-diagnostic` now preserves one syntactically safe unmapped Partner API plan handle and surfaces it on Plans & License without granting access. Focused tests passed under Node 24, but the repository rejects Node 24; `npm ci` stopped at its runtime guard and ESLint/typecheck/full local QA are NOT VERIFIED. Continue only after supported Node 22.18+ is available; no PR or additional Staging deployment yet. Production untouched.

Historical note (2026-09-18):

The documentation operating-system task is complete once this reconciled PR lands on `main`. The previous runtime-alignment implementation task is also complete and validated independently.

Future engineering should start from current `main` on a fresh feature branch, verify repository state, and continue from the earliest uncompleted roadmap item. Do not revive the completed Node-runtime remediation or use this historical docs branch for product implementation.
