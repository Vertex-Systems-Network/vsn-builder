# Architecture Boundaries

## Request flow
`Route → authentication/permission → domain service → Prisma/Shopify API → serialized resource response → UI`.

The Builder workspace uses dedicated resource endpoints. Document routes must never be parsed as JSON resources.

## Core layers
- `app/builder/`: schema engines, registries and renderer-independent builder logic.
- `app/services/`: server-side domain services and Shopify/database integration.
- `app/routes/`: HTTP/loaders/actions and thin composition.
- `app/components/editor/`: editor-only interaction and canvas UI.
- `app/components/dashboard/`: dashboard/admin experience.
- `app/components/builder-panel/`: Builder workspace resource-panel contracts/presentation.
- `app/sdk/`: public extension contract and runtime isolation.
- `extensions/`: Shopify storefront/theme extension runtime.

Do not create parallel registries or renderer models to ship a feature faster.

## Client/server route boundary

- Client-rendered route code must never import a `*.server` module for values used by UI exports.
- Shared permission definitions and pure helpers live in `app/utils/builder-permissions.js`.
- Database/session-backed authorization lives in `app/utils/builder-permissions.server.js`.
- Route modules may import server authorization only for `loader`/`action` server paths, and unused named `*.server` imports are prohibited.
- `scripts/k3-client-server-boundary-audit.mjs` guards this boundary because a violation can leave SSR HTML visible while React hydration is offline.
