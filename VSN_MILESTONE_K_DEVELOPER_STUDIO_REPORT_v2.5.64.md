# VSN Builder v2.5.64 — Milestone K Developer Studio Report

## Status
Milestone K implemented in developer mode.

## K1 — GraphQL Studio
- Owner-only Developer Studio route and unified navigation entry.
- Live Shopify GraphQL QueryRoot/Mutation root explorer through introspection.
- Current app installation scope list.
- Query/variables workspace using the shared VSN Code Editor with GraphQL/JSON suggestions.
- Saved queries, favorites and bounded execution history.
- Response, timing, requested/actual cost and throttle status display.
- Per-run mutation confirmation (`MUTATE`).
- Additional destructive-operation confirmation (`DELETE`).
- No response payload or unsaved variable persistence in history.

## K2 — Global CSS + JavaScript
- Persistent Global Code and revision models.
- CSS and JavaScript snippet management.
- Storefront/template/page/market/locale targeting.
- Head/body-start/body-end JavaScript ordering; CSS normalized to head.
- Enable/disable, duplicate, trash, restore, permanent delete and rollback.
- CSP/performance-risk warnings for patterns such as eval, document.write, external URLs and CSS @import.
- Authenticated storefront delivery through the existing VSN app proxy.
- Short cached runtime responses and Safe Mode short-circuit.
- Theme app extension includes Global Code runtime assets.

## Data lifecycle
- Prisma migration: `20260808234500_milestone_k_developer_studio`.
- Backup format upgraded to v7 for saved GraphQL queries and Global Code/revisions.
- GraphQL history deliberately excluded from backups.
- Uninstall cleanup covers all Milestone K tables.

## Boundary to Milestone L
Milestone K uses owner-only access. Action/resource permissions for staff/collaborators are intentionally deferred to Permissions 2.0.
