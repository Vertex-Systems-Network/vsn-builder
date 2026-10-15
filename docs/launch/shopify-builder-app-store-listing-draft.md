# VSN | Builder — Shopify App Store listing draft (NOT submitted)

**Status: DRAFT / NOT RELEASE-READY — 15 Oct 2026.** This is copy-and-asset preparation for ONE eventual public `VSN | Builder` app. Development and Staging are internal tiers, NOT separate App Store listings. No Partner Dashboard listing, submitted app, published plan, reviewer URL or installed merchant store is attested here. The source-only release candidate still fails the hosted merchant /app and /auth readiness gates.

## Merchant-visible listing copy — proposed, not published

**App name:** VSN | Builder

**Intro (under 100 characters):**
Build and customize storefront pages with visual layouts, templates and widgets.

**Overview draft:**
Design and manage storefront pages with VSN | Builder. Work with reusable page layouts, templates, widgets and theme app blocks to organize your store experience. Edit your pages, preview changes and prepare them for publication through your Shopify store. This copy must be reviewed against the **actual deployed merchant UI** before submitting; do not advertise any features that are unimplemented or unavailable to the paid tier.

**Candidate benefit highlights (subject to merchant acceptance):**
- Build reusable page designs with page-builder tools and templates
- Place supported widgets and Shopify theme app blocks in storefront layouts
- Preview drafts and organize page content
- Manage page layouts within the merchant store context

Do not claim guaranteed conversion lift, unique superiority, specific integrations not verified on a real Shopify test store, or Built for Shopify approval.

## Pricing details — enter ONLY in the designated Partner pricing section

One public app, four Shopify-managed subscription plans, no Free public plan. Plan titles and handles are exact and case-sensitive as recorded below. App trial terms must be defined and verified in Shopify Partner Dashboard, **not just in this source file**.

| Name | Canonical plan handle | Monthly USD | Annual USD | Trial |
| --- | --- | ---: | ---: | --- |
| Starter | `starter` | 30 | — | 10 days |
| Sliver | `sliver` | 100 | — | 10 days |
| Gold | `gold` | 150 | — | 10 days |
| Platinum | `platinum` | 350 | 3000 | 10 days |

Do not include prices, discounts, testimonial quotes or trial text in screenshots, feature images, app icon, subtitle, or other undesignated listing areas. Do not call Sliver “Silver” in the public title or Shopify plan handle.

## Actual UI asset capture requirements (all pending)

The screenshots **must come from the real installed, working version** after protected Staging/live QA; synthetic mockups, static renderings, demo text-only cards or unrelated marketing banners cannot substitute for the application UI. Strip browser chrome, test-store private data, access tokens, real customer data and any personal information.

| Artifact | Required content | Target pixels | Present | Evidence |
| --- | --- | --- | --- | --- |
| App icon | Original VSN Builder identity; no Shopify trademark/pricing | 1200 × 1200 PNG/JPEG | NO | Pending |
| Desktop screenshot 1 | Actual visual page editor (drag/drop and canvas) | 1600 × 900 | NO | Pending |
| Desktop screenshot 2 | Actual template library and preview flow | 1600 × 900 | NO | Pending |
| Desktop screenshot 3 | Actual widget/customization controls | 1600 × 900 | NO | Pending |
| Desktop screenshot 4 | Actual page settings, revisions or draft preview | 1600 × 900 | NO | Pending |
| Desktop screenshot 5 | Actual installed theme app block and storefront page | 1600 × 900 | NO | Pending |
| Demo walkthrough | Real install → editor → save → preview → published storefront, no simulated billing | As accepted by Shopify | NO | Pending |

Prepare 3–6 distinct desktop screenshots at minimum, each representing a different actual flow; include responsive view only after verified. Copy alt text reflecting what the actual screenshot shows, not promises.

## Privacy, support and compliance — cannot be checked from repository code alone

- **Privacy Policy public HTTPS URL:** NOT VERIFIED. Must describe merchant/customer data purposes, retention, deletion, contact, subprocessors, and access as actually implemented; reviewed for applicable laws.
- **Support landing public HTTPS URL:** NOT VERIFIED. Test that merchants can open it without logging into a private system.
- **Support email/contact:** NOT VERIFIED. Use an actively staffed address; do not infer a support inbox from the company domain.
- **Emergency technical contact:** NOT VERIFIED. Set privately in the Partner Dashboard.
- **App ownership:** NOT VERIFIED. Partner organization must own the single VSN | Builder public listing.
- **App domain and OAuth callback(s):** NOT VERIFIED. Verify HTTPS, origin integrity and real installed test-store sessions.
- **Compliance webhooks:** NOT VERIFIED on a hosted app. Shopify's mandatory privacy webhooks, signed verification, retention/deletion handling and merchant reinstall safety need actual acceptance.
- **Scopes and protected customer data:** NOT VERIFIED against current Partner/Shopify records.
- **Accessibility/responsiveness and functionality:** NOT VERIFIED on installed Staging/Live Shopify store.
- **Billing:** Source-only plan contract; Partner Dashboard plan handles, trial/upgrade/downgrade/cancel/reinstall lifecycle still NOT VERIFIED.

## Shopify reviewer instructions — pending real merchant proof

1. Provide **one** test store and actual install path for the single public VSN | Builder app; never offer invented credentials.
2. Verify signed OAuth/embedded session and load the merchant dashboard.
3. Enter visual editor, create a page, save, reload, preview and publish. Include a unique unpublished fixture page for isolation tests.
4. Add actual app block in theme editor and verify storefront/mobile rendering.
5. Demonstrate each Shopify-approved plan/trial and upgrade/downgrade/annual pricing, without charging real customer accounts in unsafe test mode.
6. Demonstrate uninstall/reinstall, data privacy flows and handling of unauthorized mutations.
7. Attach exact source SHA, no-downtime rollback, CI report and screenshots captured from that same tested release.

**Submission MUST remain blocked** until T011, T015, T020–T029, T035, T039 and T040 are genuinely accepted and the Shopify Partner Dashboard confirms review readiness. Preparing this document does not authorize submission, Staging deployment, Live rollout or creation of extra public apps.

## Policy references (checked 2026-10-15)

- Shopify app requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Shopify review procedure: https://shopify.dev/docs/apps/launch/app-store-review/review-process
- Shopify submission setup (app icon and contact): https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review
- Shopify privacy requirements: https://shopify.dev/docs/apps/launch/privacy-requirements
- Shopify App Store best practices (screenshot sizing): https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
