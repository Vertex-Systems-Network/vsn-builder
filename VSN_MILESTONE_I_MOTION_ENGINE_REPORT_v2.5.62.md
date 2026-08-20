# VSN Builder v2.5.62 — Milestone I Complete

Milestone I upgrades the Phase 6 Interaction Engine into a reusable Motion Engine 2.0 without introducing a second animation runtime.

## Motion Engine

- Motion Library in Assets navigation.
- Built-in entrance/hover presets plus merchant-created presets.
- Create, edit, duplicate, favorite, trash, restore and permanent-delete workflows.
- Reusable timelines can be applied to any selected editor element/widget.
- Selected editor timelines can be saved back to Motion Library.
- Page Global Settings expose a reusable Motion Default.
- Interaction schema v4 adds intermediate keyframes and per-timeline reduced-motion behavior.
- Canvas/Preview and storefront runtime both support the same keyframes.
- Motion presets are included in full backups and app-uninstall cleanup.

## Workspace stabilization delivered with Milestone I

- Dashboard reorder is handle-owned, live-reorders while dragging and persists once at drag completion.
- Dashboard Settings is an icon-only floating cog with a VSN tooltip.
- Collapsed sidebar navigation uses non-clipped portal tooltips.
- Settings now exposes only controls VSN can actually apply. Shopify-owned store information is read-only. Settings Import/Export, API Key, Reset to Defaults, fake update toggles and environment toggles are removed.
- Light, Dark and System appearance persists per staff browser and dark tokens cover shared management/workspace surfaces.
- Owner name/email/avatar loading has an authenticated staff-session fallback; initials are used when Shopify does not provide an avatar.
- Documentation was returned to the standard VSN management visual system.

## Developer Mode

Production billing/deployment remains untouched. The local SQLite baseline is advanced through the Milestone I Prisma migration.
