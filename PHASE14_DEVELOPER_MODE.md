# VSN Builder v2.5.50 — Phase 14 Developer Mode

Milestone D Phase 14 adds the first public Developer SDK and Plugin Architecture while preserving the v2.5.49 stabilized Builder as the compatibility baseline.

## Developer-mode rules
- `VSN_FEATURE_DEVELOPER_SDK=true` enables the SDK management surface in development.
- No remote JavaScript plugin installation or runtime `eval` is supported.
- Third-party plugins are source packages bundled by the app developer and must pass `npm run plugin:validate -- <plugin-directory>` before being added to a build.
- Remote Marketplace creator signing/review and dynamic plugin distribution are intentionally deferred.
- Existing pages, internal widgets and Shopify storefront rendering remain supported through the central registry/renderer bridge.

## Security boundary
The v1 SDK uses a constrained registration API, explicit permissions, manifest compatibility ranges, safe render descriptors, restricted Shopify data-provider capabilities, public-HTTPS allowlists for external data, source scanning for forbidden APIs/imports, and renderer/hook crash isolation.

This is a developer SDK, not an arbitrary-code execution environment. Bundled plugins are still reviewed code and should be treated as part of the application build.
