# Milestone Q.4.1 — Developer Mode Prisma CLI Resolution Hotfix

Q.4.1 is a database-bootstrap reliability hotfix. It does not change merchant schemas or reset development data.

- Prisma CLI resolution uses `prisma/package.json#bin.prisma`, never the package main/type entry.
- `prisma` and `@prisma/client` are pinned to the same 6.19.3 release.
- `npm run prisma:verify` verifies the installed executable before migrations.
- `npm run prisma:repair` only rebuilds Prisma-related dependencies and never touches `prisma/dev.sqlite`.
- `npm run db:prepare` remains the authoritative generate → drift repair → migrate deploy → schema verification pipeline.
