# VSN Phase 14 Data & Permissions Runtime Stabilization — v2.5.52

Date: 2026-08-07
Mode: Developer Mode
Baseline: v2.5.51 Phase 14 Stabilized

## Root cause

v2.5.51 moved heavy Builder panels to native browser `fetch()` calls against normal React Router UI/document routes. Their actions still executed and persisted data, but the lazy list loader expected plain JSON and could receive framework/document serialization instead. The fallback converted that response to an empty object, so Marketplace, Fonts, SVGs, Campaigns, CRO, Floating Elements and System Health appeared empty even when the database contained records.

## Data/runtime repair

- Added `app/routes/app.builder-panel.$panel.jsx` as a dedicated JSON resource route.
- Added central `loadBuilderPanel()` / `dispatchBuilderPanelAction()` gateway handling.
- Builder lazy reads and mutations now use React Router fetchers against that resource route.
- Lazy responses are generation-scoped and action completion remains transition-scoped to avoid the previous maximum-update-depth regression.
- `/app/pages` no longer revalidates the whole workspace for `/app/builder-panel/*` mutations.
- Errors from auth, permissions, migrations, network/tunnel and unknown panels are converted into screen-local human-readable messages rather than blank panels.

## Marketplace / assets / growth systems

- Verified built-in Marketplace catalog remains 120 pages + 320 sections = 440 templates.
- Font and SVG loaders still read active + Trash rows from Prisma; upload actions persist binary font data / sanitized SVG markup.
- Campaign, CRO Experiment and Floating Element loaders/actions remain mapped through the same panel gateway.
- Successful font/SVG actions refresh their managed registry without reloading unrelated Builder screens.
- Editor Typography font-catalog requests and the SVG picker also use `/app/builder-panel/fonts` / `/app/builder-panel/svg-assets` JSON resources, while the existing binary child routes remain intact for actual font/SVG file delivery.
- The editor SVG dialog now treats Shopify Files and the managed VSN SVG library as independent sources: a Shopify permission/API failure no longer clears or hides SVGs that were successfully saved in the VSN database.

## Shopify Files / image selection repair

The persistent picker issue had two independent causes:

1. VSN incorrectly required `read_files` specifically, although Shopify's Files API accepts `read_files`, `read_themes`, or `read_images` for the `files` query.
2. `/app/editor-media` was implemented as a blank UI route while the editor used it like a JSON API endpoint.

Repairs:

- `/app/editor-media` is now a true resource route.
- Files access accepts `read_files`, `read_themes`, or `read_images` from the current online Shopify session.
- Resolution order: canonical `nodes(ids:)` → targeted `files(query: id...)` → paginated Files fallback.
- Numeric identity fallback handles picker IDs whose GraphQL resource prefix differs from the concrete File type.
- File status + `fileErrors` are returned for processing/failed media so the UI can explain the actual condition.
- Non-JSON/session responses are identified explicitly instead of showing the generic unresolved-files message.

## System Health

- Performs a live Shopify Files query.
- Displays current session scopes, configured scopes and missing configured scopes.
- Distinguishes permission failure from Files API/query failure.
- Checks all Builder data stores and reports migration/schema problems as actionable messages.
- Diagnostics recognizes all three supported Files read capabilities.

## Database

No Prisma schema change was necessary. Phase 13 remains the latest database migration.
