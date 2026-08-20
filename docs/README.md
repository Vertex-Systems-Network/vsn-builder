# VSN Builder Documentation

This directory is the packaged documentation source for merchants and developers.

- `user/` — task-based product documentation.
- `developer/` — extension/runtime engineering documentation.
- `engineering/` — architecture and internal engineering standards.
- `generated/ecosystem-manifest.json` — source-derived release inventory used to detect documentation/version drift.
- `migrations/` — migration guidance from supported third-party builders.
- `competitive/` and `launch/` — positioning/reference material.

Regenerate the ecosystem inventory with `npm run docs:generate` and validate it with `npm run qa:milestone-o`.
