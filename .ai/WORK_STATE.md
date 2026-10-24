# VSN Live Work State

---
schema_version: 1
status: active
mode: environment_promotion
task_key: T020-staging-embedded-app-rendering-diagnostic
owner_intent: "Make the Staging embedded app render its safe billing-required screen, while retaining all paid-data and mutation gates."
base_branch: development
working_branch: fix/staging-app-frame-diagnostics
pull_request: none
last_verified_commit: b2836a8dd38014b2c77a02c93658e5d9dc0bac95
last_verified_step: "Added Staging-only app/OAuth response breadcrumbs; Node 22.18 ran 16/16 targeted tests, typecheck, QA, changed-file ESLint and production build successfully. No secret or signed-query data is logged."
in_flight_step: "Commit the verified diagnostics, push the feature branch, and open a PR to development linked to Issue #161."
next_exact_action: "Inspect required exact-head CI/review gates on the PR; after merge, deploy only through protected T021 and use T023 while reproducing Shopify Admin launch."
approval_needed_now: false
updated_at: 2026-10-25
---

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

**2026-10-25:** PR #368 is merged at `b2836a8` and protected T021 run #16 deployed it. `/healthz` and `/readyz` returned 200 and unauthenticated `/app` returned 302. After a real Shopify Admin launch, the frame still showed `about:blank`; the protected T023 tail saw billing-sync-failed, paid-plan-not-verified and billing-notice-session-rotated, but no HTTP status for successful responses. The internal Staging app ID cannot use Partner API `activeSubscription`; paid page data and mutations remain gated. Current step adds safe successful `/app` response telemetry so the next live tail can tell whether the Worker returned HTML or reauthorization.

Historical note (2026-09-18):

The documentation operating-system task is complete once this reconciled PR lands on `main`. The previous runtime-alignment implementation task is also complete and validated independently.

Future engineering should start from current `main` on a fresh feature branch, verify repository state, and continue from the earliest uncompleted roadmap item. Do not revive the completed Node-runtime remediation or use this historical docs branch for product implementation.
