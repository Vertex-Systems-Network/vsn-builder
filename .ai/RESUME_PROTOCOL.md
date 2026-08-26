# VSN Automatic Resume Protocol

## Goal

Any authorized human or AI engineer must be able to stop and resume VSN work without relying on chat history or asking the owner to explain where development stopped.

The repository carries the handoff state.

## State model

VSN uses two complementary files:

- `.ai/WORK_STATE.md` — live execution cursor. Small, frequently updated, task-specific.
- `.ai/CHECKPOINT.md` — durable verified project checkpoint. Updated after meaningful verified units, important failures, decisions and handoffs.

Git history, tests and current source remain higher authority than both.

## Mandatory startup algorithm

At the beginning of development work:

1. Read `.ai/README.md`.
2. Read `.ai/WORK_STATE.md`.
3. Read `.ai/CHECKPOINT.md`.
4. Inspect the actual current branch/status and recent commits.
5. Inspect the PR/issue referenced by `WORK_STATE.md` when one exists.
6. Inspect only the source/tests relevant to the active task.
7. Reconcile the recorded cursor against actual repository evidence.
8. If `in_flight_step` is not `none`, determine whether it completed, partially completed, failed, or never started.
9. Resume from the earliest unverified point.
10. Continue without asking the owner for a recap when the repository provides enough evidence.

A generic owner message such as `continue`, `resume`, `carry on`, `start development`, or `next` is sufficient authorization to resume the recorded non-consequential engineering task. It is not authorization for a consequential merchant/product action that separately requires approval under the engineering/security policy.

## Mandatory write-ahead cursor

For a non-trivial step, write intent before execution when practical:

```text
status = active
last_verified_step = <previously proven step>
in_flight_step = <one precise operation about to happen>
next_exact_action = <how to recover/reconcile if interrupted>
```

Then perform the operation.

After inspecting the result:

```text
last_verified_step = <newly proven result>
in_flight_step = none
last_verified_commit = <commit sha when applicable>
next_exact_action = <next precise step>
```

This is intentionally similar to a write-ahead journal: after an unexpected interruption, the next session knows what was intended but must verify whether it actually happened.

## What counts as a meaningful cursor boundary

Record state around:

- multi-file implementation units;
- migrations/schema changes;
- dependency changes;
- branch/PR switches;
- tests/builds that determine the next path;
- external API/configuration mutations;
- high-impact refactors;
- deployments/publishing operations;
- blockers requiring credentials or human decisions.

Do not create cursor churn for every trivial edit.

## Resume decision table

### `status: paused_by_owner`
Do not implement until the owner asks to resume/start development. Once they do, follow `next_exact_action` without requesting a historical recap.

### `status: active` + `in_flight_step: none`
Continue with `next_exact_action` after verifying branch/head state.

### `status: active` + an `in_flight_step`
Assume nothing. Inspect Git, files, tests and remote state. If the operation completed, record it and continue. If partial, repair/complete safely. If it never started, execute it. If retrying could duplicate a side effect, verify idempotency/remote state first.

### `status: blocked`
Re-check whether the blocker still exists. If resolved by repository/environment state, continue automatically. Ask the owner only when the blocker genuinely requires their credential, approval or product decision.

### `status: complete`
Do not redo the task. Use the next roadmap action or the user's new request.

## Conflict and stale-state handling

If `WORK_STATE.md` conflicts with current evidence:

1. executable state/tests win;
2. determine what changed after the recorded SHA;
3. preserve collaborator work;
4. update the cursor to the recovered truth;
5. continue if safe.

Do not ask the owner to resolve a discrepancy that Git history, PR state, tests or source inspection can resolve.

## Branch rules

- Never assume the recorded branch is still the correct place to write.
- If its PR merged, resume from current target branch or a fresh feature branch as appropriate.
- If it is behind, reconcile before coding.
- If it was closed/superseded, inspect why before reopening equivalent work.
- Do not stack unrelated production work onto a documentation-only branch merely because that is where the last session ended.

## Validation continuity

The cursor must distinguish:

- `Verified` — actually executed/inspected evidence;
- `Not verified` — expected but not run;
- `Failed` — executed and failed;
- `Known risk` — accepted/unresolved risk.

A new session cannot upgrade `Not verified` or `Failed` to `Verified` without fresh evidence.

## Handoff quality rule

The recorded `next_exact_action` must be executable, not vague.

Bad:

`Continue AI work.`

Good:

`Create a fresh code branch from current main, align CI and Docker to the repository-supported Node 22.18+ line, then run install/runtime/build gates and record exact failures.`

The objective is that another competent AI or engineer can resume from repository state alone.