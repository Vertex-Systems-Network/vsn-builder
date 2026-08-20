# VSN Milestone Q.4.7 — Email Studio 2.1 Report · v2.5.91

## Delivered

- Added a dedicated Assets workspace with Shopify Files selection, external HTTPS assets, search, reusable document storage and one-click assignment to image-capable blocks.
- Added a sanitized email-safe rich-text editor with bold/italic/underline/strike, lists, links, alignment, clear-formatting and merge-tag insertion.
- Added per-block visual conditional visibility and repeat collections for products, recent order line items and cart items.
- Added loop aliases and loop metadata tokens for repeat-aware content.
- Added direct pointer resizing for 2/3-column email layouts, mobile stacking policy, width presets and normalization.
- Expanded live Shopify preview product data to multiple products and recent order line items so repeated blocks can preview realistic Admin data.
- Advanced Email Document schema to v3 using JSON normalization only; no relational/Prisma migration was required.

## Compatibility preserved

- N.1 Email Builder persistence.
- N.2 visual editor storage/export contracts.
- N.3 Gmail/Outlook/Apple Mail/Yahoo diagnostics and Outlook VML CTA fallback.
- Email Studio 2.0 full-screen shell, history, direct editing, source exports and dark preview.
- Existing v2 documents normalize forward without database reset.

## Security

Rich text uses an explicit allowlist sanitizer. Scriptable tags, event attributes, unsafe protocols and unsafe inline CSS constructs are removed. Resolved binding values are escaped before insertion.

## Deliberate boundaries

VSN does not bundle the proprietary GrapesJS Studio SDK, does not claim full plugin-ecosystem parity, and does not enable production email sending. A future Email Studio phase can add template/component symbols, richer asset transforms, send-provider integrations and AI-assisted generation behind explicit permissions.

## Verification

- Q.4.7 targeted Email Studio 2.1 audit: **35/35 PASS**.
- N.1 Email Builder regression: **17/17 PASS**.
- N.2 Visual Email Editor regression: **22/22 PASS**.
- N.3 Email Compatibility regression: **25/25 PASS**.
- Q.4.6 Email Studio 2.0 regression: **25/25 PASS**.
- Milestone O Documentation/Ecosystem audit: **41/41 PASS**.
- Full dependency-free Phase 0 → Q.4.7 release chain: **61/61 command stages PASS**.
- `qa.mjs`: **293 JS/JSX files**, zero blocking syntax errors; one pre-existing non-blocking remote-image warning in `PropertiesPanel.jsx`.
- Security audit: **0 high-priority findings**.
- Codebase health: **0 failures / 0 warnings**.
