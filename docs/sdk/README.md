# VSN Developer SDK v1

VSN SDK v1 lets developers add widgets and data providers without editing the monolithic renderer switch. It is intentionally build-time/bundled in Phase 14: VSN does **not** download or execute remote JavaScript plugins.

## Core API

```js
import { registerVsnPlugin, vsnElement } from "@vsn/sdk";
```

A plugin calls `registerVsnPlugin({ manifest, setup(api) {} })`. The setup callback receives a constrained SDK object with `registerWidget()` and `registerDataProvider()`. The lower-level `registerVsnWidget()` API exists for first-party VSN/host application code; plugin packages are required to register through `registerVsnPlugin()` and the validation CLI rejects direct registry bypass calls.

### Widget definition
A widget can declare:
- `id`, `label`, `category`, `acceptsChildren`
- `defaults.props` and `defaults.styles`
- reusable `controls`
- capability hooks and a style profile
- editor/storefront renderers
- `mount`, `unmount`, `preview`, and `save` hooks

Third-party renderer output must use `vsnElement()` descriptors (or text/descriptor arrays). Raw React elements and raw storefront HTML are rejected for third-party plugins. VSN sanitizes descriptor attributes/styles and serializes storefront descriptors with escaped content.

## Control Schema API
Supported v1 controls reuse the existing VSN editor controls:
`text`, `textarea`, `number`, `toggle`, `select`, `multi-select`, `radio`, `button-set`, `url`, `color`, `color-gradient`, `range`, `css-length`, `date`, `datetime`, `time`, `dimensions`, `border-radius`, `typography`, `media`, and `icon`.

## Data Provider API
Built-in Shopify providers:
- `shopify:products`
- `shopify:collections`
- `shopify:blogs`
- `shopify:articles`
- `shopify:search`
- `shopify:metaobjects`

Loop / Query Builder can select **SDK Data Provider**, provide a provider ID, and optional JSON input.

Third-party provider callbacks never receive the raw Shopify Admin client. Instead `context.shopify` contains only methods granted by the plugin manifest permissions, such as `data:shopify.products`.

Third-party provider IDs are namespaced by the final plugin ID segment (for example `acme.catalog` → `catalog:items`). Reserved `shopify:` / `vsn:` provider namespaces cannot be shadowed by plugins.

For external APIs use the server helper:

```js
import { createExternalDataProvider } from "@vsn/sdk/server";
```

External calls require `network:external`, a manifest `networkOrigins` allowlist, public HTTPS, timeout limits, redirect blocking, and a 1 MB JSON response limit.

## Manifest

```json
{
  "schemaVersion": 1,
  "id": "acme.notice",
  "name": "Acme Notice",
  "version": "1.0.0",
  "compatibility": { "min": "2.5.50", "maxExclusive": "3.0.0" },
  "permissions": ["editor:controls", "editor:preview", "storefront:render"]
}
```

Plugin and widget versions use semantic versioning. Incompatible manifests are rejected before registration. A failed plugin upgrade restores the previous registry entries so one plugin cannot leave a partial registration behind.

## Security restrictions
The validation CLI rejects forbidden server/runtime APIs and imports outside the plugin package/VSN SDK contract. Direct `fetch`, WebSocket APIs, environment access, eval/function constructors, Node process modules, filesystem-style access signatures and similar escape paths are forbidden by the Phase 14 source contract.

This is defense-in-depth for bundled plugins, not a claim that reviewed JavaScript magically becomes untrusted-code safe. Remote code loading is therefore disabled in Phase 14.

## Lifecycle and crash isolation
- `preview` transforms preview-only data.
- `mount`/`unmount` receive only the mounted editor element and widget context.
- `save` runs before page persistence and can normalize a node; failures block that save with a readable error instead of corrupting content.
- editor renderer failures are isolated by a widget boundary.
- storefront renderer failures return a local widget fallback, not a page-wide failure.
- SDK runtime errors are visible in **Builder → Developer → Plugin SDK**.

## Validation and tests

```bash
npm run plugin:validate -- examples/plugins/announcement-card
npm run plugin:validate -- examples/plugins/remote-data
npm run plugin:test
npm run qa:phase14
```

See `examples/plugins/` for bundled examples.

## Deferred
Creator Marketplace plugin signing, review workflows, remote plugin installation and revenue-sharing are intentionally deferred until a later signed distribution phase.
