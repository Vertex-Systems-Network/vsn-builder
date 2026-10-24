# VSN Live Work State

---
schema_version: 1
status: active
mode: environment_promotion
task_key: T021-staging-secrets-from-github-environment
owner_intent: "Fix Staging billing verification by deploying the reviewed Shopify Partner token binding from the protected GitHub staging environment."
base_branch: development
working_branch: fix/staging-deploy-from-github-secrets
pull_request: https://github.com/Vertex-Systems-Network/vsn-builder/pull/367
last_verified_commit: c17e2752ac0fde942c0126c67054276eae8c95d2
last_verified_step: "On PR #367, the Staging real Worker artifact dry run, CodeQL, Environment Isolation, Repository Integrity, and Production Confidence checks passed on c17e275. The protected T021 deployment run #14 for base SHA 3b9f953 failed before code publication because the staging Worker lacked SHOPIFY_PARTNER_API_TOKEN. The user-provided Cloudflare screenshot shows SHOPIFY_PARTNER_API_ACCESS_TOKEN configured under the Worker Production environment, not Staging. PR #367 now sources staging-only values from GitHub's cloudflare-staging environment and maps the token name; no new deploy has run."
in_flight_step: "Complete exact-head checks and obtain required independent PR review for #367. After merge, run the protected T021 workflow and verify deployment plus hosted app behavior."
next_exact_action: "Do not merge before required review. Once PR #367 is reviewed and exact-head CI is green, merge to development, dispatch T021 from protected development with typed confirmation, then verify deploy output, Staging health probes, billing log and Shopify app UI. Never reuse the Production Cloudflare secret."
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

**2026-10-25:** Active task is PR #367, which updates the protected T021 deploy workflow to source Staging secrets from the GitHub `cloudflare-staging` environment. The last exact deployment attempt failed before code publication because the Staging Worker lacked `SHOPIFY_PARTNER_API_TOKEN`; the screenshot provided by the owner showed `SHOPIFY_PARTNER_API_ACCESS_TOKEN` under the Worker’s Production environment. Staging remains blocked until PR #367 is reviewed, merged, and its protected deployment succeeds. Production remains locked.

Historical note (2026-09-18):

The documentation operating-system task is complete once this reconciled PR lands on `main`. The previous runtime-alignment implementation task is also complete and validated independently.

Future engineering should start from current `main` on a fresh feature branch, verify repository state, and continue from the earliest uncompleted roadmap item. Do not revive the completed Node-runtime remediation or use this historical docs branch for product implementation.
