# Milestone Q.3.1 — Windows Database Bootstrap Hotfix

Developer Mode hotfix for the Q.3 baseline.

- Replaces Windows `npx.cmd` child-process spawning with the local Prisma CLI executed through `node`.
- Surfaces child-process startup, signal and exit-code failures instead of returning a silent generic exit 1.
- Keeps the five-stage non-destructive database preparation sequence and legacy migration-history repair.
- No Prisma schema migration is introduced by Q.3.1.
