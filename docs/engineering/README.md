# VSN Engineering Guide

Start with [`/SRS.md`](../../SRS.md). It is the mandatory standard for all human and AI-assisted changes.

- `architecture.md` — layer boundaries and request flow.
- `ui-standards.md` — separate Workspace/Dashboard and Editor visual profiles.
- `module-map.md` — ownership and current decomposition targets.
- `error-handling.md` — merchant-safe error and remediation contract.
- `permissions.md` — UI + server authorization rules.
- `migrations.md` — Prisma/document migration requirements.
- `testing.md` — regression and live-E2E expectations.
- `security.md` — untrusted input, plugin and secret rules.
- `performance.md` — bundle/runtime performance expectations.
- `resource-packages.md` — Saved Library/Marketplace ownership and transactional import/export contracts.
- `widget-platform.md` — Template Lab, visual custom widgets and SDK 2.0 extension contracts.

Before a release run `npm run qa:milestone-g` plus the audits for every affected subsystem.

- [Developer Studio](developer-studio.md) — GraphQL Studio and revisioned Global CSS/JavaScript runtime.
