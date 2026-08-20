# VSN Milestone E — Phase 15 Enterprise Hardening — v2.5.53

## Scope
Phase 15 adds Accessibility, SEO, Performance, Security and Enterprise hardening without replacing the shared renderer or earlier System Health architecture.

## Health scanner
The unified scanner checks contrast, heading order, missing alt text, form labels, focusability, keyboard-trap risk, tap-target size, duplicate H1, metadata, canonical validity/conflicts, noindex state, JSON-LD validity, DOM size, image optimization signals, third-party/embed density, custom JS and unsafe links.

The same scanner feeds Editor Template Health and Builder → System → System Health.

## Performance pipeline
- Used-assets-only runtime dependency manifests with compatibility fallback.
- Safe generated-CSS deduplication.
- Critical CSS metadata and early critical-style injection while the full generated stylesheet loads.
- Responsive `srcset` for Shopify-hosted Image widgets.
- Configurable lazy-loading policy.
- Custom-font usage/variant pruning and preload policy controls.
- CSS, JS, known-image and custom-font weight reporting.

## Enterprise controls
Store-scoped settings include Safe Mode, asset mode, critical CSS, CSS deduplication, lazy/responsive images, image-format diagnostics, font variant pruning, font preload policy, backup retention and environment/promotion metadata.

Saving hardening settings rebuilds generated theme assets when Shopify theme permissions are available. Permission failures are returned as readable warnings while settings remain safely persisted.

## Safe Mode
Safe Mode prevents the Builder custom-JS proxy from returning executable merchant JavaScript and omits generated template custom-JS files on the next theme-asset rebuild.

## Backups and promotion
Cleanup preserves the configured newest backup count and removes only older backups beyond the configured retention age. Environment promotion remains deliberately dry-run in Developer Mode and never deploys or alters a production store.

## QA
Use:

```bash
npm run qa:phase15
```

The audit validates Phase 15 scanner coverage, System Health integration, storefront safeguards, asset optimization controls, retention and developer-mode promotion protection.
