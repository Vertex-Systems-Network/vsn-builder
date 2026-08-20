# VSN Builder v2.5.83 — Milestone Q.3.1 Database Bootstrap Hotfix

## Root cause
The Q.1/Q.2 database bootstrap invoked `npx.cmd` with Node `spawnSync(..., { shell:false })` on Windows. When the command shim could not be started, Node returned a child-process `error` with a null status. The wrapper only inspected the status and exited 1, hiding the actual startup error.

## Fix
- Resolve the installed Prisma CLI as a local Node module (`require.resolve("prisma")`).
- Execute Prisma with `process.execPath`, avoiding Windows `.cmd` launch semantics entirely.
- Use the same runner for `prisma migrate resolve` during legacy migration-history repair.
- Print five explicit database-preparation stages.
- Surface process-start errors, terminating signals and non-zero exit codes with actionable diagnostics.
- Preserve non-destructive migration deployment and required-table verification.

## Database
No new migration. Existing migration `20260808234540_milestone_n1_email_builder` remains the expected Email Builder migration.
