# Reusable Data View + Settings Kit

VSN management screens should reuse `app/components/ui/VsnDataViewKit.jsx` and the shared popover primitives in `VsnToolkit.jsx` rather than creating new one-off List/Grid controls.

## Default configuration

`normalizeDataViewConfig()` merges a screen's options with the shared defaults. Available feature switches include:

- `list`, `grid`
- `search`
- `filters`
- `statusFilters`, `dateFilter`, `seoFilter`, `templateFilter`, `authorFilter`
- `bulkActions`
- `sorting`
- `pagination`
- `settings`
- `widgets`, `columnVisibility`, `pageSize`, `customPageSize`
- `rowActions`

Setting `filters: false` disables the individual filter controls. Setting `settings: false` disables its configurable sections as well.

## Shared components

- `VsnDataViewToggle` — Grid/List switch.
- `VsnDataViewSortControls` — separate sort-field and ASC/DESC selects.
- `VsnDataViewPagination` — consistent count and previous/next behavior.
- `VsnDataViewBulkMenu` — portal-safe bulk menu.
- `VsnDataViewActionMenu` — portal-safe row/card actions with viewport-aware positioning.
- `VsnDataViewSettings` — common floating Settings button plus reusable Settings popup.
- `VsnFloatingSettingsButton`, `VsnSettingsPopover`, `VsnAnchoredPopover` — toolkit-level primitives usable outside Data Views.

## Interaction rules

Menus are rendered through a body portal so table/card overflow does not create a new scrollbar or clip actions. The anchored popover chooses above/below placement from available viewport space and repositions on scroll/resize.

Notices created with `VsnNotice` are dismissible by default. Dashboard toasts also keep their explicit close action.

## Shopify-owned controls

The VSN profile menu can expose app-owned actions such as Profile and the supported self-uninstall flow. Shopify Admin pin state and Shopify account logout are host-owned and have no documented embedded-app mutation in the App Bridge surface used by VSN, so the menu points merchants to Shopify's native controls instead of pretending those operations succeeded.
