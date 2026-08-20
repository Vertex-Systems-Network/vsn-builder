# Platform Intelligence — Developer Contract

Milestone P.1 adds a client-safe platform contract and a server-only usage-analysis service without adding a Prisma migration.

## Main modules

- `app/builder/designTokens2.js` — normalization, semantic aliases, dark modes and CSS-variable names.
- `app/services/platform-intelligence.server.js` — dependency/usage graph assembly and token persistence.
- `app/routes/app.platform-intelligence.jsx` — role/action-authorized management UI.
- `app/components/dashboard/AppCommandPalette.jsx` — app-wide command surface.
- `DynamicBindingInspector` in `AdvancedBuilderControls.jsx` — resolved-binding diagnostics.

## Token persistence

Base token keys stay top-level for backward compatibility. New metadata is stored under:

```json
{
  "__vsn2": {
    "schemaVersion": 2,
    "aliases": {},
    "modes": { "dark": {} }
  }
}
```

Legacy Control Center saves must preserve `__vsn2` metadata. Storefront CSS generation resolves base/dark semantic aliases and publishes `--vsn-token-*` variables.

## Usage graph rules

The graph is advisory, not a hard referential-integrity layer. It scans VSN-managed documents and resource registries. Do not allow an `unused` result to bypass the centralized destructive-action confirmation policy.

## Permissions

System: `platformIntelligence`. Resource actions: `platform:view` and `platform:manage_tokens`. UI visibility and server authorization are both required.

## Condition runtime parity

Any condition-rule addition must be implemented in all relevant runtimes:

1. editor configuration;
2. Canvas preview;
3. server storefront renderer;
4. Theme App Extension browser runtime;
5. Liquid/page context when new data is required.

P.1 adds cart-count and product-inventory rules across all of these layers.
