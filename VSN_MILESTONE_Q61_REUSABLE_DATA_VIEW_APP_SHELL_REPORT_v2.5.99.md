# VSN Builder v2.5.99 — Milestone Q.6.1 Reusable Data View + App Shell QA

## Summary

This release hardens the Q.6 Templates management workspace after final merchant runtime QA and promotes its reusable interaction patterns into the shared VSN UI toolkit.

## Runtime fixes

- Normalizes Trash/Restore generated-asset fallback arrays at the service boundary, including persisted JSON `null`.
- Makes Trash metadata cleanup warning-safe after the database state has already moved the template to Trash.
- Refreshes List/Grid data after successful mutations and closes stale row/bulk menus after refresh.
- Removes the server-rendered Dashboard `useLayoutEffect` warning source.
- Makes row/card and bulk menus portal-based and viewport-aware so table overflow cannot clip bottom-row actions.

## Templates refinements

- Image placeholder contains no title initial/letter when a template has no image.
- Editor image options can use the active Product, Collection or Article featured image when Shopify exposes one.
- Merchant-facing column labels are `Image` and `Title`.
- Soft-delete actions are labeled `Trash`; permanent deletion remains explicitly `Delete forever` inside Trash.
- Sorting is split into a field selector and a separate `ASC / DESC` selector.
- Sidebar/dashboard navigation uses `Templates` for the Pages management workspace.
- Records per page supports presets and a custom DB-backed value from 1–100.

## Shared UI kit

`VsnDataViewKit.jsx` now contains reusable, configurable Grid/List, sorting, pagination, bulk-action, row-action and Settings controls. `VsnToolkit.jsx` contains the shared anchored popover, floating Settings button, Settings popup and dismissible Notice primitives.

Future screens can disable individual controls through configuration rather than copying/forking the Templates implementation.

## App shell

- VSN Builder branding is placed immediately before the workspace search field; the duplicate sidebar brand label is removed.
- Profile dropdown contains Profile and icon-bearing app-management entries.
- Supported self-uninstall is available from the profile menu and Settings Danger Zone, is owner-only, and requires typed `UNINSTALL` confirmation before calling Shopify `appUninstall`.
- Sidebar collapse control is no longer clipped by the sidebar overflow boundary.
- Dashboard Settings now uses the same shared popup/floating-button pattern as Templates.
- Shopify-owned pin state and Shopify Admin account logout are not simulated; VSN directs users to the native Shopify controls instead.

## Database

No Prisma schema change and no new migration.

## Compatibility

- Exact Shopify App Pricing handles remain `free`, `sliver`, `gold`, `platenium`.
- Q.6 Templates database/query architecture is preserved.
- React Router v8 future flags are intentionally not enabled during this stability patch.

## Final QA

- Q.6 Templates Final QA: 106/106 PASS
- Q.6.1 Reusable Data View + App Shell: 90/90 PASS
- Full historical `npm run qa:release`: EXIT 0
- JS/JSX parser: 308 files, 0 blocking errors
- Capability coverage: 112/112
- Codebase health: 0 failures, 0 warnings
- Package integrity: 178 required files, PASS
- Shopify production-config/readiness smoke: 20/20 PASS using ephemeral QA-only values; no production credential or URL is written into the release package
- Production runtime configuration smoke: PASS
- Packaged SQLite is byte-for-byte unchanged from v2.5.98 (`b9d681ab0180dc8247e8cc1aa1281d7b519cfdda418fc8b461e2bf24855fab03`)

The existing non-blocking `PropertiesPanel.jsx` remote-image URL warning remains outside this milestone; Q.6.1 introduces no new blocking parser warning.
