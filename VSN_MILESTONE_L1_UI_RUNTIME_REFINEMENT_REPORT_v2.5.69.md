# VSN Builder v2.5.69 — Milestone L.1 UI & Runtime Refinement

## Runtime fixes

- Fixed the Motion Library crash caused by `humanLabel` being referenced without an import.
- Kept the existing root recovery boundary as a last-resort UI while removing the known Motion crash source.
- Fixed three additional latent runtime errors found by the global identifier scan: undefined `gridSettings` in Search Results preview, the `escapeAttr` typo in Theme Section storefront rendering, and the undefined `dimensions` reference in container storefront rendering.
- Normalized the Prisma development singleton on `globalThis`.

## Theme App Embed verification

- Dashboard Theme status now queries `shopify.app.extensions()` in the embedded client and checks the published Theme App Extension activation for `vsn-page-renderer`.
- `active` reports Theme Active; `available` / `unavailable` report Theme Inactive.
- If the App API cannot verify activation, the UI shows neutral Verify Theme instead of a false critical Theme Check Required state.
- The existing server theme settings inspection remains as a fallback when the app has `read_themes` access.

## Navigation telemetry

Added tenant-scoped sidebar counts for Campaigns, CRO Experiments, Floating Elements, Custom Fonts and SVG Library while preserving existing counts.

## Dashboard layout

Dashboard preference schema is now version 2. Existing version-1 layouts migrate once to stable compact/stat → medium → wide ordering. After migration, explicit user drag order remains authoritative.

## Custom Widget Studio

- Added a shared field catalog with human-readable labels and grouped choices.
- Core types: text, textarea, number, toggle, select, multi-select, radio, button-set, URL, color, color/gradient, range, CSS length, date, date-time, time, dimensions, border radius, typography, media and icon.
- Each type exposes relevant settings such as options, default values, min/max/step, units, CSS keywords and accepted media types. Complex design fields now use human-readable configuration instead of raw JSON: dimensions expose four sides, border radius exposes linked/per-corner defaults, typography exposes font defaults, gradients expose fill controls, media exposes fallback metadata and icons expose name/size/color defaults.
- SDK-defined field types retain their custom identity while resolving through the declared VSN native base control.
- Server normalization preserves the field-specific contract in the existing JSON persistence model; no database migration is required.

## Dark/light and destructive UI

- Added dark variants for recent management cards, modals, tool tabs, Developer Studio, Motion, permissions and recovery surfaces.
- Added editor dark styling for portal-mounted controls using the editor overlay root while intentionally excluding storefront Canvas content.
- Synchronized Dashboard and Editor appearance through a same-window appearance event so editor theme toggles update portal/root theme tokens immediately and remain consistent when returning to the app shell.
- Standardized close/action icon sizing and added visible danger treatment to destructive editor icon buttons.

## QA contract

A new `qa:refinement` audit verifies the runtime repair, authoritative Theme status path, counts, Dashboard migration, Custom Widget field system, synchronized editor appearance, hidden runtime identifier fixes and destructive-action styling.
