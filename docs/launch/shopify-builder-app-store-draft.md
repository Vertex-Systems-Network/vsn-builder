# VSN | Builder — Shopify App Store Listing (DRAFT, NOT PUBLISHABLE)

**One** public Shopify app: **VSN | Builder**, developed by Vertex Systems Network (Pvt.) Ltd. Development and Staging are internal testing configurations, not separate public App Store products.

**Status (15 October 2026):** Copy prepared; public Shopify Partner listing, merchant installation, real screenshots, privacy URL, support inbox and public support page are **not verified**. This is NOT proof of a live app or App Store acceptance. Do not publish or submit until every mandatory release prerequisite passes.

## Merchant-facing listing copy — pricing does NOT belong here

**App name:** VSN | Builder

**Suggested app card subtitle:** Visual page building, templates and storefront sections

**Overview (English draft):**

Design and manage Shopify storefront pages with a visual editing workspace. Organize reusable layouts, place content and commerce widgets, and prepare page designs for your store's theme.

Explore page templates, adjust responsive layouts, configure form components, and work with publishing controls from one app dashboard. Available capacity and advanced tools depend on the subscription plan you select.

**Feature highlights (publish only after merchant E2E proves each claim):**
- Build and organize Shopify page layouts in a visual editor
- Start from templates and reusable sections
- Add text, images, product widgets and supported storefront blocks
- Prepare responsive layouts and preview changes before publishing
- Use forms, collaboration and advanced features according to the selected tier

Avoid unsupported performance, AI quality, compatibility, revenue-impact or conversion guarantees; do not mention ratings/reviews, certifications or merchant testimonials that have not been earned.

## Dedicated Shopify pricing section — eight paid plans

| Public plan / canonical handle | Monthly USD | Yearly USD | Shopify-managed trial |
| --- | ---: | ---: | ---: |
| Starter / `starter` | $30 | — | 10 days |
| Solo / `solo` | $59 | — | 10 days |
| Silver / `silver` | $100 | — | 10 days |
| Gold / `gold` | $150 | — | 10 days |
| Business / `business` | $249 | — | 10 days |
| Platinum / `platinum` | $350 | $3,000 | 10 days |
| Agency / `agency` | $599 | — | 10 days |
| Scale / `scale` | $999 | — | 10 days |

No Free tier, no extra public app/listing. Solo, Business, Agency and Scale amounts reflect the latest proposed app catalog; all eight prices and handles remain subject to direct confirmation in the Shopify Partner Dashboard. Repo config is NOT published Partner pricing. Do not include plan prices in screenshots, subtitle or other non-pricing fields.

## Five real, distinct screenshots REQUIRED before listing can be published

Use the **actual running, approved Shopify embedded application** at the exact certified release SHA. Crop to the app UI (no browser chrome, desktop backgrounds, customer PII, store secrets or token URLs). Do not fabricate/mock the screenshots, place only a logo on them, reuse one image or portray an unimplemented workflow as working.

| Required capture | Different real feature to demonstrate | Evidence needed |
| --- | --- | --- |
| 01 Dashboard | Pages/template overview with safe fixture data | Exact version/SHA, store ID kept private |
| 02 Visual editor | Builder canvas and widget selection | Native editor response and no overlap |
| 03 Templates | Template gallery and choice UI | Safe test template installed and opened |
| 04 Forms | Form widget settings / fields and safe sample data | Verified save + reload |
| 05 Theme preview | Real page/section preview on an approved Shopify test theme | Installation and rendering evidence |

**Internal screenshot ingestion contract (source-only validation):** exactly five **1600×900 PNG** application captures under `docs/launch/evidence/<unique-capture>.png`, with distinct SHA-256 file bytes. This stricter internal evidence format follows Shopify's recommended 16:9 desktop screenshots. The validator rejects missing files, symlinks, path traversal, renamed non-PNG files, mismatched dimensions, byte-identical duplicates, embedded PNG text/EXIF/ICC/private/animation chunks and hidden bytes after the IDAT compression stream. Allowed fixed-width color metadata is limited to pre-image sRGB/gAMA/cHRM/pHYs chunks. Export a flat browser screenshot instead of merely renaming a metadata-bearing file. Keep raw originals in controlled storage; **do not manufacture screenshots or alter a capture's content to bypass uniqueness**. Binary/dimension checks do **not** prove an authentic Shopify app UI, distinct views, no PII in visible pixels, or a successful feature, so independently certified real browser/install/merchant E2E and Partner acceptance remain required.

Record original untouched source captures privately for QA; public crops must accurately show actual app. Do not upload an image or video until it can be connected to a passed merchant E2E test. Existing listed themes Dawn, Horizon, Prestige, Impulse and Custom are **targets only**, not certified fixture tests.

## Privacy and data mapping — legal review required

Before publishing, draft a merchant-readable privacy policy **for this app**, review it with a qualified professional, host it at a stable public HTTPS URL and verify its accessibility. The code includes potential handling of Shopify sessions/access tokens, shop domains, builder page content/assets, storefront form submissions and uploads, wishlist/customer identifiers, analytics/experiment events and order attribution. Disclose **actual** data uses, retention/deletion, subprocessors, hosting geography, user rights, international transfers and contact route only after verified.

Mandatory Shopify compliance webhooks configured in repository: `customers/data_request`, `customers/redact`, `shop/redact`. Also `app/uninstalled`, `app/scopes_update` and `orders/paid` for product workflows. Confirm production implementation and signed delivery using actual Shopify tests; source routes alone are not privacy compliance proof.

**Public privacy policy URL: NOT VERIFIED.** Do not invent or reuse another product's policy.

## Support and public contacts — all unverified

Shopify requires an actual working merchant support channel with a valid support email. Current repository describes in-app support tickets, but no verified public support email or external support URL was established. Before publish, verify a staffed email inbox, response process, optional support portal page and the merchant's in-app Support flow. Do not expose a private phone or fabricate a contact address.

**Support email: NOT VERIFIED. Support URL: NOT VERIFIED.**

## Partner submission / reviewer instructions (not executable yet)

1. Confirm one public app exists under the authorized VSN Partner organization, with internally isolated Dev/Staging. Never create three public apps.
2. Confirm HTTPS origin, authorized OAuth callbacks, App Bridge session authentication, latest required permissions and Shopify privacy webhooks.
3. Confirm one exact certified Live commit, production secrets and database migration/backups, deployed Worker readiness, rollback and no error logs.
4. Provide a real nonproduction test store and reviewer installation path/access as permitted by Shopify, without putting secrets in this public document.
5. Demonstrate install → official Shopify OAuth → 10-day paid trial → create/edit/save/reload → theme embed/publish → upgrade/downgrade/cancel/frozen → webhook uninstall/reinstall handling using E2E evidence.
6. Confirm all eight Partner-managed prices, handles and trials, and no Free fallback. Capture exact reviewed plan handles and invoices privately.
7. Only after T011, T025, T029, T035, T039 and T040 acceptances, **attempt** submission; log Shopify's actual response and any required fixes. Do not claim submission or approval from draft copy.

## Official documentation verified 15 October 2026

- Privacy policy and privacy obligations: https://shopify.dev/docs/apps/launch/privacy-requirements
- Support email/channel requirements: https://shopify.dev/docs/apps/launch/distribution/support-your-customers
- Distinct real UI image rules (March 2026): https://shopify.dev/changelog/posts/clearer-standards-for-app-listing-images
- Session token and listing pre-submission checks: https://shopify.dev/changelog/posts/session-tokens-and-app-listings-automatically-checked-before-submitting-for-app-review

**Release status:** Marketing COPY DRAFTED; actual listing acceptance **BLOCKED**. No submitted review, uploaded assets or live merchant claims.
