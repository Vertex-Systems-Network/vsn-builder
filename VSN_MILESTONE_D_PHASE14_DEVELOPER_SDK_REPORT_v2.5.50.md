# VSN Builder v2.5.50 — Milestone D Phase 14 Developer SDK & Plugin Architecture

## Status
Milestone D Phase 14 is implemented on the stabilized v2.5.49 baseline. Milestone D (Phases 10–14) is now complete in source/developer mode.

## Implemented
- Public SDK v1 with `registerVsnPlugin()`, host-level `registerVsnWidget()` / data-provider registry APIs, semantic version compatibility and manifest schema validation.
- Control Schema API reusing VSN editor controls including text, textarea, number, toggle, select/multi-select, radio/button-set, URL, color/gradient, range, CSS length, date/time, dimensions, radius, typography, media and icon controls.
- Editor Renderer API integrated before the legacy preview switch with per-widget error boundary.
- Storefront Renderer API integrated before the legacy storefront renderer with local fallback on plugin render failure.
- Safe render descriptors (`vsnElement`) for third-party renderer output; raw HTML is escaped and unsafe URL/event/style attributes are stripped.
- `mount`, `unmount`, `preview` and `save` lifecycle hooks; save-hook failures block only the affected save.
- Central capability and style-profile hooks for SDK-backed widgets.
- Internal migration adapter: Spacer is registered through the SDK for controls/capabilities/save lifecycle while deliberately retaining its proven legacy editor/storefront renderer in this release.
- Data Provider API with six Shopify providers (products, collections, blogs, articles, search and metaobjects), plus guarded third-party providers.
- Query/Loop Builder `SDK Data Provider` source with provider ID + JSON input and a readable editor placeholder preview.
- Third-party providers do not receive the raw Shopify Admin client; only manifest-granted `context.shopify` methods are exposed.
- External provider helper requires public HTTPS, declared manifest origin, `network:external`, timeout/redirect controls and a 1 MB JSON response limit.
- Plugin registration is transactional: a failed version upgrade restores the previous widget/provider registry entries.
- Plugin permission enforcement for editor controls, editor preview, storefront rendering and provider requirements.
- Third-party data-provider IDs are plugin-namespaced and cannot shadow reserved `shopify:` / `vsn:` providers.
- Build-time plugin source validator blocks forbidden Node/runtime APIs, environment access, direct network APIs, direct registry bypass calls and non-SDK/non-local imports.
- No remote JavaScript plugin installation/eval in Phase 14. Bundled plugin packages remain reviewed application code.
- Builder → Developer → Plugin SDK owner-only system screen with runtime counts, plugin status, renderer/widget registry, data providers, security contract, manifest validator, self-test and isolation events.
- System Health includes Developer SDK engine/status/counts.
- Example widget plugin, example external provider plugin, CLI validator and SDK test harness.
- Public SDK documentation under `docs/sdk/README.md`.

## Deferred by roadmap
Creator Marketplace signing/review, remote plugin installation and revenue-share distribution are intentionally deferred. Phase 14 does not claim an arbitrary untrusted-code sandbox; dynamic remote code execution is disabled instead.

## Developer mode
Set:

```env
VSN_FEATURE_DEVELOPER_SDK=true
```

Existing production URL/auth placeholders are not modified by Phase 14.

## Verification
`node scripts/phase14-sdk-audit.mjs` passes 67/67 checks. `node scripts/vsn-sdk-test.mjs` passes, and both bundled example plugin directories pass `scripts/vsn-plugin-validate.mjs`.
