# VSN Builder v2.5.63 — Milestone J Report

## Scope

Milestone J adds Widget Platform 2.0 and completes the requested runtime/UI stabilization pass on top of v2.5.62.

## Widget Platform 2.0

- Widget Template Lab with protected `{{vsn.root}}` and `{{vsn.content}}` contracts.
- Safe HTML parsing, escaped field interpolation and widget-scoped CSS.
- Template overrides consumed by Canvas, Preview and storefront rendering.
- Visual Custom Widget Builder with fields, live preview, active/disabled state, duplicate, Trash, restore and permanent delete.
- Custom widgets register into the same shared widget registry used by the visual editor/storefront.
- SDK 2.0 adds categories, field types, controls, template types and inspector panels alongside widgets/data providers.
- SDK field types map to VSN-native base controls to preserve UI consistency.
- Third-party direct registry access is blocked by the SDK source scanner.

## Requested stabilization

1. Fixed Motion Library runtime failure caused by a missing `Plus` icon import.
2. Added Brand Kit navigation count.
3. Management/editor library pagination scrolls smoothly back to its first item on Next/Previous.
4. Extended Light/Dark/System coverage and added an Editor theme icon without recoloring merchant page content.
5. Added published-theme App Embed inspection; only verified enabled state displays `Theme Active`, while disabled/unverifiable states use danger status with a Theme Editor link.
6. Global interaction loader follows resolved Light/Dark appearance.
7. Roles & Permissions now uses per-system toggles, with separate Widget Studio permission and owner-only security systems.
8. Shopify-owned Settings values provide direct Shopify management links; removed pseudo "Removed from Settings" content.
9. Support adds tracked Bug Report and Feature Request flows; Documentation adds an FAQ destination.
10. Management button labels use the compact VSN type scale.

## Database

Migration: `20260808230000_milestone_j_widget_platform`

Adds:

- `BuilderWidgetTemplate`
- `BuilderCustomWidget`

No cross-shop custom-widget mutation is allowed.

## Compatibility

- Existing page/widget schema remains valid.
- Template overrides are optional and fall back to native renderers.
- Existing Phase 14 plugins continue through the same registry/permission/rollback path.
- Milestone G file-growth ceilings remain enforced.
