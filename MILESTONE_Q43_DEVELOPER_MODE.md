# Milestone Q.4.3 — Developer Mode

This hotfix closes the remaining Email Builder migration-history failure without resetting `prisma/dev.sqlite`.

- `prisma migrate resolve` is no longer trusted only by exit code; VSN verifies that an applied row with the packaged migration checksum actually exists.
- If the verified additive Email Builder schema exists and Prisma leaves migration history missing, VSN records the exact known migration using the SHA-256 checksum of its packaged `migration.sql` and Prisma-compatible `_prisma_migrations` metadata.
- Existing applied rows with a mismatched checksum are not overwritten automatically.
- Unsupported/current odd Node runtimes are rejected. Developer mode supports Node 22.18+ and recommends Node 22 LTS.
- `npm run db:diagnose` prints the exact DB target and Email migration history rows.
