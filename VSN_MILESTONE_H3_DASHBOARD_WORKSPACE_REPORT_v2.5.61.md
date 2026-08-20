# VSN Builder v2.5.61 — Milestone H.3 Dashboard Workspace Report

## Scope

Milestone H.3 consolidates commercial navigation and restores operational visibility in the single-shell VSN Builder management UI without redesigning the accepted visual language.

## Navigation and commercial UI

- `Home` is presented as **Dashboard**.
- Plans and License are a single **Plans & License** screen.
- Monthly/Yearly plan switching and the existing pricing-card hierarchy remain intact.
- Unified sidebar badges expose store-scoped Pages, Saved Library and Widgets counts plus the current supplied Marketplace catalog count.

## Widgets management

The Widgets screen restores the established four summary cards:

- Total Widgets
- Active Widgets
- Disabled Widgets
- Inactive Widgets

Inactive means the widget is enabled but not currently referenced by a saved page. Usage is calculated server-side from active page content and remains available after widget settings are saved.

## Configurable Dashboard

Default visible widgets:

- Published Pages
- Active Campaigns chart
- System Health Issues
- Live System Monitor
- Visitor Map
- Continue Editing
- Workspace Snapshot
- Activity Timeline

Optional widgets available from the Dashboard settings drawer include Draft Pages, Total Pages, CRO Experiments, Unread Submissions, Saved Library, Marketplace Installs, Active Widgets, AI Usage, Backups, Plan Usage, Recent Updates and Getting Started.

Dashboard widgets can be reordered by drag-and-drop or with drawer move controls. Visibility/order preferences are persisted in `BuilderShopSetting.dashboardJson`.

## Live telemetry

`BuilderVisitorSession` records store-scoped VSN storefront session activity for the Dashboard map. The model stores visitor/session identifiers already emitted by the VSN storefront runtime, country code, last path, timestamps and page-view count. No IP address is stored.

A lightweight `/app/dashboard-live` resource refreshes campaign state, system telemetry and visitor summaries while the Dashboard is visible.

## UI consistency

Management inputs, selects, numeric controls and textareas inherit VSN UI typography/color tokens. Code-editor surfaces explicitly retain monospace typography.

## Database

Migration: `20260808200000_dashboard_workspace`

- Adds `BuilderShopSetting.dashboardJson`
- Adds `BuilderVisitorSession`
- Adds session/country/time indexes

Visitor telemetry is removed on app uninstall.

## Developer mode

This milestone does not alter production URLs or approve Shopify billing. See `MILESTONE_H3_DEVELOPER_MODE.md`.
