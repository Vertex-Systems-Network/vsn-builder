# VSN Builder Documentation

**Current engineering execution policy (2026-10-14): [Task Dependency Roadmap](task-dependency-roadmap.md).** Development is scheduled by explicit task prerequisites, not eight ordered phases. The single public Shopify app and four paid plans are documented there. [Master GitHub task board #156](https://github.com/Vertex-Systems-Network/vsn-builder/issues/156).

Run `node scripts/task-dependency-check.mjs` from repository root to list next READY tasks. CI and external merchant/hosting release gates still apply; an old phase counter is an archival inventory, not an execution stop.
This directory is the packaged documentation source for merchants and developers.

- `user/` — task-based product documentation.
- `developer/` — extension/runtime engineering documentation.
- `engineering/` — architecture and internal engineering standards.
- `generated/ecosystem-manifest.json` — source-derived release inventory used to detect documentation/version drift.
- `migrations/` — migration guidance from supported third-party builders.
- `competitive/` and `launch/` — positioning/reference material.

Regenerate the ecosystem inventory with `npm run docs:generate` and validate it with `npm run qa:milestone-o`.
