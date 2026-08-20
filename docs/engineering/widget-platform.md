# Widget Platform 2.0

Milestone J turns widget extension into one platform rather than separate built-in, merchant and plugin paths.

## Sources

1. **Built-in widgets** are owned by VSN and registered through the core widget registry.
2. **Merchant custom widgets** are stored in `BuilderCustomWidget` and registered at editor/storefront request boundaries through `sdk/visualWidgets.js`.
3. **Third-party extensions** use the Phase 14 SDK registry. They must never mutate internal maps directly.

All three sources resolve through the same editor/storefront widget renderer contracts.

## Widget Template Lab

`BuilderWidgetTemplate` stores an optional presentation override per shop + widget type.

A template override may change HTML structure and scoped CSS, but must not replace widget data/business logic. The protected contract is:

- `{{vsn.root}}` — required on the single root element.
- `{{vsn.content}}` — required for native widget overrides and represents the current VSN renderer.
- `{{field}}` / `{{prop.field}}` — escaped value interpolation.

Unsafe document tags, scripts, forms, inline event handlers, unsafe URL schemes, duplicate IDs and CSS at-rules are rejected. Template Lab does not run JavaScript. Reusable motion belongs in Motion Library.

The same saved override is consumed by Canvas, Preview and storefront rendering. A parser/runtime failure must fall back to the native widget renderer instead of taking down the editor or storefront.

## Visual Custom Widgets

Merchant widgets define:

- name/category/icon/description,
- a bounded field schema,
- safe HTML,
- scoped CSS,
- capabilities.

Supported core field types are text, textarea, number, toggle, select, URL, color and media. SDK 2.0 field types may be used when they map to a supported VSN base control.

Lifecycle is Create → Active/Disabled → Trash → Restore/Permanent Delete. Permanent delete requires the shared destructive-action confirmation contract.

## SDK 2.0 extension points

Plugins may register through the scoped setup API:

- Widget
- Category
- Field type
- Control
- Data provider
- Template type
- Inspector panel

Custom field types must declare a `baseType`; VSN renders the base control so plugin fields remain visually consistent and do not inject arbitrary admin UI. Direct registry calls from plugin source are rejected by the SDK source scanner.

Extension ownership, permissions, upgrade rollback and error isolation remain inherited from the Phase 14 plugin contract.

## Permissions

Widget management and Widget Studio are distinct Role Manager systems. Widget Studio resource routes enforce `widgetStudio` server permission. Plugin SDK and Roles & Permissions remain owner-only.

## Data and tenancy

Every Widget Studio database read/write is scoped by Shopify shop. Updating an existing custom widget first verifies `id + shop`; another shop's ID must never be updated or deleted.

## Release checks

A Widget Platform release must verify:

- protected template validation,
- Canvas/Preview/storefront template usage,
- custom widget registration in editor/storefront,
- tenant-safe CRUD,
- SDK extension registration/rollback,
- field-type base-control mapping,
- permission enforcement,
- migration checksum and SQLite integrity,
- Milestone G large-file ceilings.
