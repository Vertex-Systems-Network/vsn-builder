# VSN Builder v2.5.100 — Milestone Q.6.2 Report

## Shared Settings toolkit
- `VsnSettingsPopover` now owns an optional full-width Reset footer action through `onReset`, `resetLabel` and `resetDisabled` props.
- Dashboard and Templates both use the same primitive.
- Dashboard no longer renders a separate Done footer action; close/toggle remains the floating Settings button, the X control, outside workflow controls and Escape.

## Templates bulk actions
- Removed the extra Grid `Select page` control beside Bulk actions and removed the selected-count text beside the dropdown.
- Published: Draft, Trash.
- Draft: Scheduled, Publish, Trash.
- Scheduled: Cancel schedule, Trash, Draft, Publish.
- Trash: Restore, Delete Forever.
- All: Draft, Scheduled, Publish, Trash.
- Bulk Restore/Delete Forever use the same server authorization and Shopify/theme cleanup contracts as single-item actions.

## Shell/runtime hardening
- Removed the app-owned Zap icon before `VSN Builder` in the internal topbar.
- Dashboard `?view=` selection now initializes from React Router location on both SSR and hydration instead of using `window` only on the client.
- Lazy dashboard subpages get one bounded retry for transient module-load failures; persistent failures still reach the existing runtime error boundary.
- Shopify's outer App Header (app name/icon/overflow) is Admin-owned chrome outside the iframe and is intentionally not manipulated by iframe CSS or DOM access.

## Data/database
- No Prisma migration.
- Existing Q6 Templates metadata schema is unchanged.
- Shopify plan handles remain exactly `free`, `sliver`, `gold`, `platenium`.

## Final QA
- Q6 Templates Final QA: 106/106 PASS.
- Q6.1 Reusable Data View + App Shell: 90/90 PASS.
- Q6.2 Settings/Bulk/Shell: 33/33 PASS.
- Full historical `npm run qa:release`: EXIT 0.
- JS/JSX parser: 308 files, 0 blocking errors.
- Capability coverage: 112/112.
- Codebase health: 0 failures / 0 warnings.
- Package integrity: 181 required files, PASS.
- Production Shopify readiness smoke: 20/20 PASS using a generated temporary config; no production secret/URL was persisted.
- Packaged SQLite SHA-256 remains `b9d681ab0180dc8247e8cc1aa1281d7b519cfdda418fc8b461e2bf24855fab03`.
