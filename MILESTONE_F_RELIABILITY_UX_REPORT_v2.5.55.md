# VSN Milestone F — Reliability & UX Foundation — v2.5.55

## Scope

Milestone F is a post-roadmap stabilization milestone built on v2.5.54. It does not create a new roadmap phase; completed roadmap phases remain 0–16.

## UI profiles

VSN keeps two deliberate visual profiles. Dashboard/Builder workspace uses the established VSN admin language and reusable VSN primitives. The visual editor keeps its compact, canvas-first editor profile. Polaris is not forced into surfaces where it would change the existing product language.

## Resource refresh and SVG 2.0

Builder panels now treat a refreshed lazy/resource response as authoritative after a mutation instead of allowing preloaded static panel data to mask successful creates/uploads. The SVG Library maintains active/trash state immediately after upload/update/trash/restore/delete, provides checker/light/dark previews, and renders sanitized SVG source directly so `currentColor` and authored colors remain visible. SVG source editing uses a VSN modal Code Workspace with HTML/SVG suggestions and a sandboxed live preview; the server sanitizes again on save.

## Destructive actions

A VSN confirmation provider centralizes permanent-delete consent. Library hard delete/empty trash, SVG hard delete, custom-font hard delete, Brand Kit hard delete, form-submission deletion, integration deletion and page hard deletion require explicit confirmation. Reversible Trash operations remain distinct from permanent deletion.

## System Health 3.0

Core health checks now return Why, Impact, Fix steps and Verify guidance. The UI exposes those instructions inline for failing/warning checks and adds a consistent Diagnose → Smallest Fix → Verify workflow. Shopify Files guidance explicitly distinguishes session permissions, reauthorization and picker refresh.

## Idle/runtime hardening

Collaboration heartbeats pause while the document is hidden or offline and resume when visible. Explicit global loader events have a bounded watchdog so a missed stop event cannot leave the entire UI visually loading forever when React Router is idle.

## Editor canvas

Canvas now supports 25–200% zoom, +/- controls, 100% reset, Fit-to-available-width, Ctrl/Cmd +/-/0 shortcuts, Space + drag panning, and pointer-capture canvas resizing that compensates for zoom scale. Viewport width and zoom are independent states.

## Inspector isolation

Element-specific content controls are gated to Content instead of rendering across all tabs. Previously misplaced dynamic-content controls were moved out of the Style block. Content, Style and Advanced labels are human-readable and remain separate control groups.

## Database

No Prisma schema change is required for Milestone F. Existing v2.5.54 database/migrations are preserved.
