# VSN Builder v2.5.49 — Phase 13 Developer Mode (Stabilized)

Milestone D Phase 13 adds Templates, Marketplace and Brand Kits while keeping the app in developer mode. v2.5.49 is the pre-Phase-14 stabilization release for this Phase 13 baseline.

## Development flags

```env
VSN_FEATURE_MARKETPLACE_BRAND_KITS=true
```

Optional remote catalog source:

```env
VSN_TEMPLATE_CATALOG_URL=
```

When the remote URL is empty or unavailable, the built-in catalog continues to work. No production catalog, billing switch, creator payouts or irreversible deployment assumptions are required for this phase.

## Catalog baseline

- 120 editable VSN page templates.
- 320 editable VSN sections.
- Fashion, Beauty, Electronics, Food, SaaS, Luxury, Real Estate, Single Product, B2B and Landing/CRO industries.
- Search and Category / Industry / Style / Plan / Color / Layout filters.
- Favorites, Recent and Recommended views.
- Live preview from the same editable VSN schema that is installed into Saved Library.

## Safe install model

Marketplace installs are version-aware and compatibility-checked. Installed items keep a source key/version, content hash, unique asset manifest and a rollback snapshot. Reinstall/update targets the Marketplace-managed Library item rather than matching unrelated merchant-created content.

Remote catalog fetch is optional and falls back to the built-in catalog on timeout or invalid data.

## Brand Kits

Brand Kits manage:
- logo
- six core colors
- body/heading typography
- heading scale
- spacing base and container width
- small/medium/large/button radii
- small/medium/large shadows

Font selectors use the existing System + Google + active Custom Font registry. A Brand Kit can be applied as the store Global Design or to a Saved Library page/section without flattening the VSN widget structure.

## Persistence and recovery

Phase 13 adds Prisma persistence for Brand Kits, Marketplace favorites and installs, and Marketplace metadata on Library items. Backup/restore, app uninstall cleanup and Diagnostics include the new Phase 13 state.

The packaged `prisma/dev.sqlite` is migrated through `20260807030000_phase13_marketplace_brand_kits` for developer-mode extraction/testing.

## Deferred by roadmap

Creator marketplace onboarding, creator signing/review, revenue share and commercial payouts remain deferred. The roadmap explicitly marks those as later work; Phase 13 does not pretend those production systems are active.
