# VSN Milestone D — Phase 11 Localization & Shopify Markets

Version: **2.5.46**  
Mode: **Developer**

## Implemented

- Shopify locale catalog and Shopify Markets catalog sync.
- Base-locale + locale + market inheritance without mutating base page JSON.
- Per-locale text, links, image/media URL and alt/content overrides, including nested structured widget fields such as gallery/card item content.
- Per-locale SEO title, description, Open Graph title/description/image.
- RTL locale detection and direction-aware editor/storefront rendering.
- Mixed-direction diagnostics for Arabic/Hebrew/Urdu-style locales.
- Translation completeness, missing and outdated translation tracking.
- Translation Dashboard in the app navigation.
- Editor Localization & Markets panel with selected-element filtering and locale preview.
- Market-specific variants and global-market fallbacks.
- Storefront locale/market resolution for pages, global header/footer, reusable sections and campaigns.
- Native Shopify Page translation hook using translatable resource digests and `translationsRegister`.
- Developer translation-app hook registry for catalog load, translation save and native-sync adapters without coupling Phase 11 to a specific third-party translation app.
- Shopify localization/market/translation scopes added for development testing.
- Localization state is included in backup/restore and page duplicate/delete/uninstall lifecycle cleanup.

## Companion fixes in this package

- Repaired Support Center Create Ticket modal layout so it renders as a centered, isolated modal instead of flattened inline form content.
- Removed React SSR `useLayoutEffect` warning from editor anchored overlays by using an isomorphic layout-effect wrapper.
- Replaced invalid Shopify `avatar(fallback: INITIALS)` GraphQL enum with the supported `DEFAULT` fallback.
- Missing `OPENAI_API_KEY` now returns a structured developer-mode configuration response instead of logging a full runtime stack.

## Guardrails

- Phase 11 is behind `VSN_FEATURE_LOCALIZATION_MARKETS`, default OFF.
- Old behavior remains intact with the feature flag disabled.
- No production URLs, production webhooks, or irreversible deployment state are changed.
- Native Shopify translation sync only runs when explicitly requested and when the required scopes/resource ID are available.
