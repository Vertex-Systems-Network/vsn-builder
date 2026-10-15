# T017 — Staging Neon primary protection acceptance (2026-10-16)

## Live authenticated control-plane check

- Environment: **VSN Builder Staging** Neon project `shiny-violet-61219572` (NOT Production).
- Current default and primary branch: `br-square-mountain-b3ij6q2s`; returned `protected: false`.
- The project is currently on Neon organization plan `free_v3`. A direct authenticated, authorized `update_branch({protected:true})` attempt against that exact primary failed with **HTTP 422**: "You have reached the maximum number of protected branches for your current plan. To protect this branch, either upgrade your plan or reduce the number of existing protected branches."
- After this failed request, **do not claim protection was enabled**. No SQL, branch restore, data deletion, deployment, migration, or Production change was performed.
- The app-table inventory on the Staging primary was empty at last inspection; earlier migration SQL executed only in isolated QA branch. This is NOT full Staging acceptance.

## Code safety consequence

`phase3-staging-neon-live-proof.mjs` previously verified protected **GitHub** branch and precise Staging Neon default ID, snapshot provenance and compute, but omitted the independent Neon **branch.protected** flag. A future allowed GitHub workflow could otherwise perform DDL on the *unprotected Neon primary*. The control-plane verifier now fails closed unless the authenticated live Neon branch inventory returns `protected === true` on that exact default. Any missing, non-boolean, or `false` protection assertion rejects migration; the reviewer cannot replace proof with environment flags.

Tests in `tests/phase3-staging-neon-live-proof.test.mjs` cover these negative cases, and the dedicated no-deploy T017 workflow tests the policy without using a Neon API key. This source-level hardening is not evidence of a completed hosted migration.

## Remaining acceptance prerequisites

1. Raise the account's Neon protected-branch allowance through the owner's plan/entitlement or another provider-approved way **without unprotecting a separately required production branch**.
2. Activate `protected:true` on the exact Staging default, independently re-fetch it as `true`.
3. Enable actual protected GitHub `development` branch and Staging environment reviewer/secret policies (both currently unverified).
4. Independently verify the pinned snapshot, restored default, direct+pooled credential targets, 2 Prisma migration-history entries and required application tables through the manual-only Staging workflow.
5. Never infer Stage or Live readiness from synthetic fixture CI.

**T017 remains IN_REVIEW, not FINAL CLOSED.**
