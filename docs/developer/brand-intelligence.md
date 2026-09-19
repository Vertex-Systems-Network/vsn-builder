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

## Owned-site extraction

P1.2b adds optional AI-assisted extraction from a merchant-owned, controlled, or otherwise authorized public website.

The extraction flow is intentionally preview-only:

1. the merchant enters a public HTTPS URL;
2. the merchant explicitly confirms ownership/control/authorization;
3. VSN reads a bounded public source through the shared DNS-pinned outbound transport;
4. the source is reduced to bounded readable text and treated as untrusted model input;
5. the shared AI provider returns a strict Brand Profile suggestion;
6. the suggestion is normalized through Brand Profile v1;
7. the merchant chooses **Use suggestions** to fill the local Brand Kit form;
8. the merchant reviews the fields and uses the existing Brand Kit Save action if they want to persist them.

Extraction never calls the Brand Kit persistence service, never changes the default Brand Kit, never applies Global Design, and never mutates page or storefront content.

### Network and source limits

- HTTPS only;
- embedded URL credentials are rejected;
- private, local, reserved and other non-public targets are rejected by the shared outbound security layer;
- DNS resolution is pinned per request;
- every redirect is revalidated;
- redirects are capped at 3;
- source responses are capped at 256 KB;
- provider input text is capped at 18,000 characters;
- only HTML, XHTML and plain-text pages are accepted;
- script, style, template, SVG and markup source is removed before AI input;
- raw source HTML/text is not returned to the browser or persisted.

### Provider and human-control boundary

Extraction uses the same shared AI provider, timeout/retry policy and AI quota metering as the rest of VSN. Provider credentials remain isolated in the provider adapter.

The extraction output is advisory. It does not create executable Agent commands and cannot publish or save automatically.

P1.2b also has an independent default-off kill switch:

```bash
VSN_FEATURE_BRAND_INTELLIGENCE_EXTRACTION=false
```

The behavior contract is independently versioned with:

```bash
VSN_AI_BRAND_BEHAVIOR_VERSION=brand-extract-v1
```

## QA

In addition to the P1.2 profile audit, run:

```bash
npm run qa:p12b-brand-extraction
npm run qa:release
```

The P1.2b audit is network-free. It verifies source stripping, HTTPS-only input, private/local rejection, redirect limits, response bounds, strict structured output, Brand Profile normalization, raw-source non-disclosure, the independent kill switch, and the absence of automatic Brand Kit/page/storefront mutation paths.
