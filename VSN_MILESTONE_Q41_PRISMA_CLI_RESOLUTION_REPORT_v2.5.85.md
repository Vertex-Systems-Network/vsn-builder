# VSN Builder v2.5.85 — Milestone Q.4.1 Prisma CLI Resolution & Database Bootstrap Hotfix

## Root cause

The Q.3.1 runner correctly stopped spawning `npx.cmd`, but it used `require.resolve("prisma")`. That resolves a package entry point, not necessarily Prisma's CLI executable. On the reported Windows Prisma 6.19.3 installation Node attempted to resolve `node_modules/prisma/build/types.js`, while Prisma declares its CLI separately in `package.json#bin.prisma` (`build/index.js`). Database preparation therefore failed before `prisma generate` could run.

## Fix

The shared Prisma process helper now resolves `prisma/package.json`, reads `bin.prisma`, verifies the executable exists and invokes that file with the current Node executable. The same runner is used by `db:prepare`, migration-history repair and postinstall generation.

## Additional hardening

- Prisma CLI/client are pinned together at 6.19.3.
- Added a fixture reproducing `main: build/types.js` + `bin.prisma: build/index.js`; release QA fails if the resolver selects the main entry.
- Added `npm run prisma:verify` for installed-path and CLI execution diagnostics.
- Added `npm run prisma:repair` to reinstall only Prisma-related dependency directories without touching `prisma/dev.sqlite`.
- Existing 30 migrations are unchanged; no new Prisma migration is required.

## Verification

- Q.4.1 Prisma CLI resolution audit: 18/18 PASS.
- Q.3.1 database bootstrap audit: 13/13 PASS.
- Q.4 Shopify production integration audit: 23/23 PASS.
- Dependency-free Phase 0 → Q.4.1 release chain: 55/55 commands PASS.
- TypeScript parser: 380 app/script files, 0 syntax errors.
- Packaged SQLite: 30/30 migrations applied; `BuilderEmailTemplate`, `BuilderWishlist`, `BuilderGlobalCode` and `Session` present.
- Resolver fixture executes a mock Prisma CLI where the package main points to missing `build/types.js` but `bin.prisma` correctly points to `build/index.js`.
