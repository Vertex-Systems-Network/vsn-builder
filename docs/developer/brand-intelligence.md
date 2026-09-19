# Brand Intelligence profile

P1.2 extends the existing Brand Kit system with a versioned, optional Brand Profile. The profile is advisory context for VSN AI and does not replace Global Design, storefront rendering, or deterministic validation.

## Storage

Brand Profile data is stored in `BuilderBrandKit.profileJson`.

The migration is additive only:

- no existing column is changed;
- no Brand Kit row is rewritten;
- no new table is introduced;
- legacy Brand Kits deserialize as an empty Brand Profile v1.

The existing color, typography, spacing, radius and shadow JSON fields remain unchanged.

## Version 1 fields

Brand Profile v1 contains bounded plain-text guidance for:

- brand summary;
- primary audience;
- tone and voice;
- imagery direction;
- merchandising rules;
- CTA rules;
- reusable component guidance;
- do rules;
- don't rules.

Executable/template syntax is stripped from stored guidance. Rule lists are deduplicated and bounded.

## Builder behavior

The Brand Kits workspace continues to manage the existing visual tokens exactly as before.

Brand Intelligence fields are optional and live in an extracted `BrandProfileFields` component. Saving a Brand Kit persists the profile alongside the existing token JSON fields.

Applying a Brand Kit as Global Design still writes only the existing visual token contract. Brand Profile data is **not** copied into `designTokensJson`, page `global-styles`, storefront assets, or page content.

## Agent context

The P1.1 Editor Agent receives read-only Brand Intelligence for the authenticated shop:

- the default Brand Kit when present, otherwise the most recently updated active kit;
- known visual tokens only;
- normalized Brand Profile v1 guidance.

Brand text is treated as untrusted application data. It is a preference layer only and cannot override:

- merchant instructions;
- safety constraints;
- widget/schema constraints;
- deterministic quality checks;
- command authorization;
- no-publish policy.

No `brand.*` mutation command exists in the Agent command allowlist.

## Backup and lifecycle

Existing backup/export already serializes complete `BuilderBrandKit` rows, so `profileJson` is preserved automatically after the schema migration. Restore recreates the same row field.

Shop uninstall/data lifecycle cleanup already deletes Brand Kit rows as part of the existing lifecycle.

## QA

Run:

```bash
npm run qa:p12-brand-profile
npm run qa:release
```

The P1.2 audit verifies legacy compatibility, plain-text sanitization, token invariance, additive-only migration, backup/restore preservation, read-only Agent integration and absence of brand mutation commands.

## Follow-up

AI-assisted brand extraction from an owned/authorized website is intentionally not part of this first storage/context slice. When added, extraction must transform observed patterns into Brand Profile rules and must not retain copied HTML, CSS, scripts, or proprietary page code.
