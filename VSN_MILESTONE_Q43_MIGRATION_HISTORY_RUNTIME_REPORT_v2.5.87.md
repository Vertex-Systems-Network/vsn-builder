# VSN Milestone Q.4.3 — Deterministic Migration History & Runtime Compatibility

Version: 2.5.87

## Root cause addressed

The Email Builder table could be physically complete while `_prisma_migrations` still lacked an applied N.1 row. Prisma `migrate resolve --applied` could return without the expected postcondition in the reported environment, and the old pipeline trusted the process exit code rather than reading the history table again.

The reported environment also used Node 25.0.0. VSN/Prisma v6 is now constrained to tested LTS lines rather than accepting an unbounded `>=22.12` range.

## Fix

- Verify the exact migration row and SHA-256 checksum after `migrate resolve`.
- Refuse to rewrite an already-applied row with a mismatched checksum.
- When the Email schema (13 columns + 2 indexes) is already verified and no valid applied row exists, deterministically baseline the known additive N.1 migration in `_prisma_migrations`.
- Mark stale failed rows rolled back only within this verified reconciliation path.
- Add checksum-aware System Health/schema verification and `npm run db:diagnose`.
- Add runtime compatibility validation for Node 22.18+, recommending Node 22 LTS.

No database reset and no new Prisma migration are required.
