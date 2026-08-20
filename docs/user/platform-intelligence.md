# Platform Intelligence & Control

VSN Platform Intelligence helps you understand shared-resource usage before editing or deleting reusable assets, and centralizes design-token and state-inspection workflows.

## Dependency / Usage Graph

Open **Developer → Platform Intelligence → Usage Graph**. The graph scans active Pages and Saved Library content plus Fonts, SVG assets, Motion presets, Brand Kits, Email templates, Custom Widgets, CRO experiments and Global Code targets.

Use the graph to answer questions such as:

- Which pages or library items use this widget, component, font, SVG, query or Motion preset?
- Which dynamic-binding sources and condition-rule types are active in content?
- Which email dynamic tokens are used by saved email templates?
- Which resources currently have no known VSN references?

**Unreferenced does not automatically mean safe to delete.** Custom JavaScript, external theme code or third-party integrations can reference resources outside the VSN document graph. Verify before permanent deletion.

## Design Tokens 2.0

The **Design Tokens 2.0** tab groups base colors, typography, spacing, radii, shadows and layout values. It also supports:

- semantic aliases such as `color.text.default` and `space.md`;
- dark-mode overrides;
- storefront semantic CSS variables;
- backward compatibility with existing flat VSN design-token storage.

Only roles with **Platform Intelligence → Manage Design Tokens 2.0** can save token changes.

## Command Palette

Press **Ctrl/Cmd + K** anywhere in the VSN app shell. Search enabled systems, use the arrow keys to select a command and press Enter to navigate. Commands respect the current role's system access.

## Dynamic Binding Inspector

In the visual editor select an element, open **Advanced**, then review **Dynamic Binding Inspector**. It displays the configured binding source/path, resolved preview value and whether a fallback is being used.

## State / Condition Builder

The existing Condition Builder now also supports cart and inventory state:

- cart is empty;
- cart has items;
- cart item count at least;
- product inventory at least;
- product inventory at most.

These rules use preview context in the editor and real cart/product context on the storefront.
