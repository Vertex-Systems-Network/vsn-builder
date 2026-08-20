# VSN Builder v2.5.58 — Milestone H.1 Unified App Shell & Navigation

## Scope

Milestone H.1 consolidates the management dashboard and visual Builder into one coherent VSN Builder product shell without flattening their distinct UX profiles.

## Delivered

- Renamed active product UI from VSN Page/Template Builder to **VSN Builder**.
- Added primary Shopify app navigation for Home, Builder, Library, Marketplace, Growth, Plans and Settings.
- Added role-aware visibility for Builder destinations.
- Reclassified Home navigation into Workspace, Manage and Account groups.
- Reclassified Builder workspace navigation into Build, Growth, Assets, Data & Forms, Localization, Developer and System.
- Kept Plans authoritative on Home while Builder exposes usage only.
- Added live Home control-center summaries for pages, growth, forms and health.
- Added recent-page continuation links that reopen the existing editor through the same `s-app-window` workflow.
- Synchronized Builder panel selection with the URL so direct links and refreshes restore the correct screen.
- Preserved legacy route modules for backward compatibility and internal resource contracts.

## Compatibility

No Prisma schema change is required. Existing `/app`, `/app/pages`, direct resource routes and editor URLs remain valid.

## Developer Mode

The app remains development-safe. Production URL/billing/deployment settings were not changed.
