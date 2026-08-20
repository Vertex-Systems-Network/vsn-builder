# VSN Builder v2.5.60 — Milestone H.2 Single-Shell Correction

## Why this release exists
Milestone H.1 incorrectly left two application shells: the Dashboard shell on `/app` and a second Builder sidebar on `/app/pages`. The intended product architecture is one VSN Builder entrance and one classified sidebar for all management/build systems.

## Result
The persistent app shell now lives in `app/routes/app.jsx`. It renders one VSN Builder sidebar and one top navigation around both Dashboard routes and Builder workspace routes.

### Unified sidebar classification
- Overview: Home
- Build: Pages, Saved Library, Marketplace, Brand Kits, Widgets
- Growth: Campaigns, CRO Experiments, Floating Elements
- Assets: Custom Fonts, SVG Library
- Data & Forms: Submissions, Form Settings
- Localization: Languages & Markets
- Developer: Plugin SDK (owner only)
- System: Setup, Backups, Roles & Permissions (owner only), System Health
- Manage: Documentation, Plans, Settings, License, Support, Changelog, Notifications, About

The owner/profile entry remains at the bottom of the same sidebar.

## Dashboard preservation
The existing Dashboard/Home widgets, Widgets management screen, Plans, Support, Notifications, Documentation and other Dashboard pages remain available. Their page content no longer renders its own Sidebar/TopNav.

## Builder preservation
Pages and Builder panels remain backed by the existing `/app/pages` loader/actions and Builder panel resource routes. Only the duplicate Builder sidebar was removed. Editor opening continues through `s-app-window`.

## Backward compatibility
Existing `/app/pages`, `?panel=...`, direct resource routes and `/app?view=...` links remain valid. Navigation is consolidated visually and structurally without forcing a database migration.
