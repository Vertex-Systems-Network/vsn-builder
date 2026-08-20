# Milestone L.1 — UI & Runtime Refinement (Developer Mode)

This release stays in Developer Mode and refines the Milestone L baseline before Wishlist Commerce work begins.

## Scope

- Repair Motion Library runtime labeling.
- Verify the published Theme App Embed through App Bridge extension activation data with a server-side theme inspection fallback.
- Add missing navigation resource counts.
- Migrate the default Dashboard layout to compact-first ordering.
- Complete dark/light treatment for recent management surfaces and editor portals.
- Expand Visual Custom Widget field types and per-type configuration without creating a second renderer contract.
- Normalize destructive icon sizing and danger states.

## Guardrails

- No production billing changes.
- No automatic theme activation or theme writes.
- No new destructive database migration.
- Existing page/document schemas remain backward compatible.
- Canvas/storefront content is not recolored by editor dark-mode chrome rules.
