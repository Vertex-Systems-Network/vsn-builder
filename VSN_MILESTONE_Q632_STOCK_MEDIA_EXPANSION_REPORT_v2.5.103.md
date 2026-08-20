# VSN Builder v2.5.103 — Q6.3.2 Stock Media Expansion & Shopify-safe Images

## Scope

This milestone fixes the Stock Media Settings checkbox presentation, prevents oversized stock images from being sent to Shopify Files, and adds Stock Videos + Stock Audio workspaces using provider capabilities that are actually available through documented APIs.

## Image import hardening

- 18 MP internal target (margin below Shopify Files image ceiling)
- 18 MB internal transfer cap
- aspect-ratio-preserving Unsplash resize parameters
- Pexels/Pixabay provider derivative selection instead of original-size image import
- provider/redirect/MIME validation retained
- Shopify staged upload/file lifecycle retained

## Stock Videos

Providers: Pexels + Pixabay.

Capabilities: discover/search, filters, balanced provider results, favorites, Shopify imports, update, delete, attribution, quality selection, video compatibility gate and provider-aware caching.

## Stock Audio

Provider: Freesound APIv2.

Capabilities: search, sort, duration/tag filters, preview, waveform, favorites, license gates, Shopify generic-file import/update/delete.

Freesound free API use is non-commercial, so the adapter defaults disabled and requires explicit commercial API permission/license confirmation. Original-file download is not used because it requires OAuth2; VSN currently imports API preview media.

## Database

No new migration. Q6.3.2 reuses BuilderLibraryItem and BuilderStockSearchCache.

## Commercial/billing safety

No billing code or Shopify plan handles changed. Handles remain exactly `free`, `sliver`, `gold`, `platenium`.

## Final QA

- Q6.3 Stock Image Hub regression: 83/83 PASS
- Q6.3.1 Credential/UI hotfix regression: 35/35 PASS
- Q6.3.2 Stock Media Expansion: 93/93 PASS
- Full historical `npm run qa:release`: EXIT 0
- Parser QA: 319 JS/JSX files, 0 blocking syntax errors
- Capability coverage: 112/112
- Codebase health: 0 failures / 0 warnings
- Package integrity: 206 required files PASS
- Shopify production readiness smoke: 20/20 PASS
- Production runtime validation smoke: PASS
- Database unchanged from v2.5.102: `33957506704f2567ac8c028ac5e4ddbe4895f0477733310a59a9ccc38f5797ec`

The package contains no provider credentials and no live provider API calls were made during release QA. Provider network behavior is covered by static contracts and deterministic service checks; real connection tests run after the merchant saves provider credentials.
