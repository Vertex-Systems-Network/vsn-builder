## v2.5.107 — Q.6.4 Hydration, UI Theme, Maps & Form Security
- Fixed Suspense hydration-time urgent state updates in the embedded app shell with React transitions and a non-Suspense default Home path.
- Added VSN UI color schemes and a custom accent picker backed by shared CSS variables.
- Added encrypted Google Maps API settings and keyed Map widget rendering.
- Added Google reCAPTCHA v2/v3 Forms settings, storefront runtime and server verification.
- No Prisma migration; Shopify billing handles remain free/sliver/gold/platenium.

## 2.5.102 — Milestone Q.6.3.1: Stock Image Credential & Settings UI Hotfix

- Fixed Stock Image credential paste/autofill runtime recovery by removing stale SyntheticEvent/currentTarget reads from functional state updates.
- Added separate encrypted Unsplash Access Key + Secret Key fields with legacy Access Key compatibility and `UNSPLASH_SECRET_KEY` environment fallback.
- Rebuilt Stock image integrations Settings UI into responsive full-width provider cards with stable password fields, visibility controls and provider option layouts.
- Hardened Stock Images advanced option handlers against the same stale-event class of client error.
- No Prisma migration; exact Shopify billing handles `free / sliver / gold / platenium` remain unchanged.

## 2.5.101 — Milestone Q.6.3: Stock Image Hub & Persistent View Settings

- Added a unified Stock Images workspace for Unsplash, Pexels, and Pixabay with aligned normalized results, provider-aware filters, favorites, import/update/delete workflows, attribution links, and rate/cache visibility.
- Added server-only encrypted provider credentials in Settings with optional environment fallbacks and connection tests. API keys are never returned to the browser.
- Added secure stock-to-Shopify Files transfer using stagedUploadsCreate + fileCreate, READY-gated fileUpdate, permanent fileDelete confirmation, source-host/MIME/size validation, and the `write_files` scope.
- Added provider compliance guards: Unsplash hotlinked discovery previews + download tracking, Pexels attribution, and 24-hour Pixabay search caching without permanent Pixabay hotlinking in favorites/imports.
- Persisted Templates List/Grid, columns, widgets, and records-per-page in BuilderShopSetting; corrected Dashboard preference schema v2 so dashboard settings survive reloads.
- Raised the dashboard aside to z-index 99 and standardized Templates view toggle order as List then Grid.
- Added one additive Prisma migration for Templates view preferences and stock-search cache. No destructive schema/data operations.
- Preserved exact Shopify App Pricing handles: `free`, `sliver`, `gold`, `platenium`.

# v2.5.99 — Milestone Q.6.1 Reusable Data View + App Shell QA

- Fixed the Templates Trash `fallbackFiles is not iterable` runtime regression by normalizing persisted fallback asset lists at the theme-asset service boundary.
- Promoted Grid/List toggle, separate field/direction sorting, pagination, bulk actions, portal row actions and Settings popup behavior into a configurable reusable UI kit.
- Added dismissible notices, viewport-aware portal menus, custom records-per-page values and common Settings popovers for Templates and Dashboard.
- Refined Templates labels/image fallback, added active Shopify resource featured-image reuse, and changed soft-delete wording to Trash.
- Refined app-shell branding/profile actions, added owner-confirmed Shopify self-uninstall from Profile and Settings, and fixed sidebar collapse clipping.
- Kept Shopify-owned pin/logout controls native instead of simulating unsupported App Bridge operations. No Prisma migration.

# v2.5.98 — Milestone Q.6 Templates Management Final QA

- Rebuilt the Pages workspace as a DB-backed Templates management screen with 12-record pagination, List/Grid parity and two-row filter/search controls.
- Added smart loaded-first search with automatic database fallback, loading state, DB sorting/filtering, dynamic SEO/author/template facets and custom date ranges.
- Added master/grid selection, icon-based bulk actions, scheduled date/time UI, custom rename flow, top/bottom pagination and persisted screen settings/column visibility.
- Added template image selection in the editor with Shopify Files support and persisted template-image metadata shared by List and Grid views.
- Added persisted Author, Created Date, SEO Score, Views, Page Count and scheduled-at metadata with additive migration `20260810013000_templates_management_final_qa`.
- Kept collaboration locks/approval rules on bulk publish, preserved all Q5 billing contracts, and removed campaign types only from the Templates Create list.

# v2.5.97 — Milestone Q5.5 Billing Production Lifecycle QA

- Kept Shopify App Pricing handles exactly `free`, `sliver`, `gold`, and `platenium`.
- Made Partner API `activeSubscription` the canonical current-plan authority; historical events now provide lifecycle context without overriding an active contract handle.
- Added bounded retry/recovery for temporary Partner API `429/5xx`, GraphQL throttling/service errors and transient network failures.
- Locked install, plan upgrade/downgrade, cancellation, frozen/unfrozen, trial and reinstall billing flows in the dedicated Q5.5 audit.
- No Prisma migration.

# v2.5.96 — Milestone Q5.4 Billing Lifecycle UX

- Mapped merchant-facing plans to Free, Silver, Gold and Platinum while preserving stable internal entitlement IDs (`core`, `pro`, `cro`, `agency`).
- Set the exact Shopify App Pricing handles to `free`, `sliver`, `gold`, and `platenium`, with public environment variables and backward-compatible legacy aliases.
- Added centralized billing lifecycle presentation for active, trialing, pending upgrade/downgrade, scheduled cancellation, frozen/canceled and verification-error states.
- Added manual `Refresh Shopify status` recovery from both dashboard and Plans routes without granting billing-change permission.
- Added cache compatibility checks so mirrors created under old plan-handle mappings are automatically re-verified instead of remaining incorrectly cached.
- Kept Shopify App Pricing authoritative, retained server-side Entitlement Engine enforcement, and added no Prisma migration.

# v2.5.95 — Milestone Q5.3 Entitlement Engine 2.0

- Added a centralized server-side registry for named commercial features, quotas and minimum-plan decisions.
- Moved Pages, Marketplace, AI, CRO, collaboration seats, backups, Global Library, Developer SDK and enterprise mutations to the same entitlement authority.
- Made production paid access fail closed to the trusted Q5.2 Shopify subscription mirror; `VSN_DEFAULT_PLAN` cannot grant production paid access.
- Added stable quota usage semantics, including persisted collaboration seats and UTC monthly AI resets.
- Exposed a redacted entitlement snapshot to Dashboard, Plans and License UI so UI state matches server enforcement.
- Kept `app/utils/plan.server.js` as a backward-compatible facade; no Q5.3 Prisma migration.

# v2.5.94 — Milestone Q5.2 Verified Shopify Subscription Sync

- Added server-only Shopify Partner API verification using `activeSubscription` plus historical subscription lifecycle events.
- Added authoritative mapping for active/trialing/canceling subscriptions and fail-closed handling for canceled, frozen, inactive and unknown-plan states.
- Added billing-period, cycle, pending-plan, cancellation and verification diagnostics to the local subscription mirror.
- Kept `plan_handle` redirects untrusted; they only force a live contract refresh.
- Added bounded cache/stale behavior, per-shop sync deduplication and redacted browser configuration.
- Added additive Prisma migration `20260809030000_milestone_q52_subscription_sync`; no merchant/developer data reset.
- Preserved Developer Mode local plan simulation; live Partner sync remains opt-in during development.

# v2.5.93 — Milestone Q5.1 Shopify App Pricing Foundation

- Replaced the old plan/interval query-string billing handoff with Shopify's hosted App Pricing URL contract.
- Added safe store/app-handle URL generation, plan-handle normalization/mapping and production configuration diagnostics.
- Added `plan_handle` return parsing with authenticated-shop matching; return parameters are explicitly untrusted for entitlements until Q5.2 Partner API verification.
- Blocked every production local plan mutation, including downgrades to Core; production plan changes now stay Shopify-authoritative.
- Preserved Developer Mode local plan simulation and legacy `SHOPIFY_MANAGED_PRICING_URL` as a transitional fallback only.
- Added production app-handle generation support and runtime commercialization checks.
- No Prisma migration.

# v2.5.92 — Milestone Q.4.8 Email Studio 2.2

## Email Studio 2.2
- Added reusable linked email symbols and merchant saved content blocks.
- Added authenticated Shopify Products + Collections commerce browser for Product/Product Grid authoring.
- Added per-block desktop/mobile visibility controls with renderer/MJML parity and diagnostics.
- Added persistent before-save Email version history using the existing BuilderRevision model.
- Added curated, plan-aware VSN Email Marketplace templates.
- Added server-only structured AI Email generation/rewrite/subject assistance using existing VSN AI quotas.
- Advanced Email Document to v4 and renderer capability to v6 without a Prisma migration.
- Preserved Email Studio 2.0/2.1, N.1/N.2/N.3 compatibility and Outlook/Gmail export safeguards.

# v2.5.91 — Milestone Q.4.7 Email Studio 2.1

- Added Shopify Files/external image Asset Manager with reusable document assets.
- Added sanitized email-safe rich text with formatting, lists, links, alignment and merge-tag insertion.
- Added visual block conditions and repeat collections for products, order line items and cart items.
- Added drag-resizable responsive columns, presets, normalization and mobile stacking.
- Advanced Email Document JSON schema to v3 without a Prisma migration and preserved N.1–N.3 renderer compatibility.

# v2.5.90 — Milestone Q.4.6 Email Studio 2.0

- Rebuilt the constrained modal Email Builder as a full-screen three-surface Email Studio with Blocks/Layers/Data/Setup navigation, a larger live canvas and a dedicated Content/Style inspector.
- Expanded the email-native catalog from 14 to 19 blocks with Logo, Navigation, Image + Text, Testimonial and Product Grid while keeping Email Document schema v2 backward compatible.
- Added undo/redo history, keyboard shortcuts, inline canvas editing, desktop/mobile canvas controls, zoom, inbox preview, light/dark preview, diagnostics and source workspaces.
- Added document-level global styles, richer per-block styling, Shopify dynamic-token browsing and token-safe editing so preview values do not overwrite saved merge tags.
- Expanded deterministic HTML/MJML/plain-text rendering and compatibility diagnostics for the new block types while preserving classic Outlook VML buttons and legacy N.2/N.3 documents.
- The proprietary GrapesJS Studio SDK is not bundled; VSN keeps its native Shopify-aware document/runtime and may evaluate the BSD `grapesjs-mjml` adapter separately. No Prisma migration is required.

# v2.5.89 — Milestone Q.4.5 Embedded Mutation Origin Hotfix

- Fixed create/update/delete actions being rejected with `Mutation request origin does not match this app.` inside Shopify Admin and Shopify CLI reverse-proxy/tunnel development.
- Mutation trust now resolves the effective app origin from the request URL, `SHOPIFY_APP_URL`, standard `Forwarded`, and `X-Forwarded-Host` / `X-Forwarded-Proto`.
- Trusted Shopify-controlled HTTPS admin origins (`admin.shopify.com` and merchant `*.myshopify.com`) are allowed for embedded requests; every guarded action still authenticates with `authenticate.admin`.
- Arbitrary cross-site, malformed and lookalike Shopify origins remain rejected.
- Added an 18-case embedded mutation-origin regression matrix. No Prisma migration is required.

# v2.5.88 — Milestone Q.4.4 SQLite Migration History Serialization Fix

- Fixed Email Builder migration-history rows that could be physically inserted into `_prisma_migrations` but then disappear from Prisma raw-query verification because SQLite `DATETIME` text used a legacy `CURRENT_TIMESTAMP` shape.
- Migration-history reads now cast timestamp columns to text and no longer silently convert non-table query errors into an empty history.
- Deterministic migration-history writes and rollback markers now use Prisma-compatible SQLite timestamp formatting.
- Existing v2.5.87 baseline rows with correct checksums but legacy timestamps are normalized in-place; merchant data and `prisma/dev.sqlite` are never reset.

# v2.5.85 — Milestone Q.4.1 Prisma CLI Resolution & Database Bootstrap Hotfix

- Fixed Windows `db:prepare` failures caused by resolving Prisma package main/type metadata instead of `package.json#bin.prisma`.
- Prisma CLI now resolves through `prisma/package.json` and executes the declared local CLI entry with Node.
- Pinned `prisma` and `@prisma/client` to the same 6.19.3 version to prevent CLI/client drift.
- Added `npm run prisma:verify`, a main-vs-bin regression fixture, shared postinstall generation and safe `npm run prisma:repair` dependency recovery that never deletes `prisma/dev.sqlite`.
- Preserved Q.4 Shopify production integration and all existing database migrations.

# v2.5.84 — Milestone Q.4 Shopify Production Integration

- Added a separate production Shopify configuration workflow while keeping `shopify.app.toml` as the safe development config.
- Added `config:production`, `release:production:check` and `deploy:production` commands with HTTPS URL, callback, proxy, scopes and webhook validation.
- Added live Admin API version support/fall-forward diagnostics for the `2026-07` stable target.
- Unified `app/uninstalled` and mandatory `shop/redact` cleanup through one idempotent full-shop data lifecycle service.
- Added production runtime env validation and Q4 user/developer documentation.
- No Prisma migration is required.

# v2.5.79 — Milestone P.1.1 Runtime Parse & GraphQL Hotfix

- Fixed the Documentation FAQ JSX fallback so it cannot fail with an unclosed fragment parse error.
- Fixed malformed `#graphql query` / `#graphql mutation` same-line markers across Email preview and other Shopify Admin GraphQL call sites.
- Added a targeted runtime parse/GraphQL audit to prevent recurrence.
- No Prisma migration or feature-schema change.

# v2.5.78 — Milestone P.1 Platform Intelligence & Control

- Added dependency/usage intelligence across VSN pages, library resources, managed assets, Motion, dynamic bindings, conditions, email tokens, experiments and Global Code targets.
- Added Design Tokens 2.0 with semantic aliases, dark-mode overrides and storefront semantic CSS variables while preserving legacy flat-token compatibility.
- Added the app-wide Ctrl/Cmd + K command palette and role-aware Platform Intelligence navigation/permissions.
- Added Dynamic Binding Inspector and expanded State/Condition rules with cart and product-inventory thresholds across editor and storefront runtimes.
- Added Platform Intelligence user/developer documentation and a Milestone P.1 release audit.

# v2.5.77 — Milestone O Documentation & Ecosystem QA

- Completes task-based merchant documentation and the packaged developer reference set.
- Adds a source-generated ecosystem manifest for widgets, Motion, email blocks, field types, permissions, migrations, routes and documentation coverage.
- Expands the in-app Documentation center across Builder, Growth, Commerce, Assets, Developer, System and Release workflows.
- Adds Documentation/Ecosystem readiness to System Health and a Milestone O drift audit to the release gate.
- Synchronizes the in-app changelog through v2.5.77 and records v2.5.75/v2.5.76 releases that were previously missing from UI data.
- No Prisma migration is required for Milestone O.

# v2.5.76 — Milestone N.3 Email Compatibility & MJML Export

- Added Light/Dark email preview and configurable authored dark-mode palette.
- Added static Gmail, Outlook Classic, modern Outlook, Apple Mail and Yahoo compatibility diagnostics.
- Added Gmail compiled-size clipping risk and accessibility contrast checks.
- Added classic Outlook MSO/VML fallback markup for CTA buttons.
- Added HTML, MJML and plain-text export from the visual editor and email library.
- Added compatibility badges/scores without changing Email Document schema v2.
- Production email delivery and real inbox screenshot testing remain disabled in Developer Mode.

# v2.5.75 — Milestone N.2 Visual Email Editor & Dynamic Bindings

- Adds a three-pane visual Email Editor with drag/drop block palette, reorder, duplicate/delete controls, document settings, block inspector and desktop/mobile preview.
- Adds Section and Columns email blocks alongside Header, Hero, Text, Image, Button, Product, Order Summary, Coupon, Social, Divider, Spacer and Footer.
- Adds Shopify-aware dynamic data tokens for Shop, Product and recent Order preview data, with Customer, Cart, Discount, Campaign and Form safe preview samples.
- Keeps exported HTML tokenized for future send-time resolution while visual preview resolves tokens against live/sample data.
- Moves the pure email renderer into a client/server shared module so preview and persisted compilation use one rendering contract.
- Adds responsive column stacking for narrow email clients and keeps the existing table-safe renderer.
- No Prisma migration is required; N.2 reuses the N.1 `BuilderEmailTemplate.documentJson` contract.

# v2.5.74 — Milestone N.1 Email Builder Foundation

- Starts Milestone N with a separate email document schema and email-safe table renderer instead of reusing the web page renderer.
- Adds Email Builder navigation, role/system access, My Emails / Starter Templates / Trash management, preview, HTML export and plain-text export.
- Ships seven starter email layouts: Welcome, Newsletter, Promotion, Product Launch, Abandoned Cart, Order Update and Back In Stock.
- Adds `BuilderEmailTemplate` persistence, Prisma migration, backup v9 support and uninstall cleanup.
- Keeps the v2.5.73 Theme Runtime / Motion cleanup: Shopify-hosted Global Code loader, no `shamefully-hoist` npm warning, and 1,061 unique built-in Motion presets.
- N.2 will add full visual block editing, responsive/mobile preview controls and deeper dynamic Shopify bindings.

# v2.5.73 — Milestone M.2.2 Runtime & Motion Catalog Cleanup

- Replaced direct app-proxy Global CSS/JS `<link>` / `<script>` tags with a Shopify-hosted theme-extension loader asset, eliminating Theme Check `RemoteAsset` warnings without removing dynamic Global Code delivery.
- Removed the pnpm-only `shamefully-hoist` npm config that produced an npm startup warning.
- Removed duplicate built-in `Fade In` and `Zoom In` Motion presets while preserving all 97 Animate.css presets and all 960 VSN generated presets.
- Repaired compound Animate.css direction parsing so diagonal fade/rotate variants generate distinct timelines instead of duplicate motion behavior.
- Added a release audit that rejects duplicate built-in motion names, duplicate Animate.css timeline signatures, direct RemoteAsset runtime tags, and accidental React Router v8 future-flag opt-ins.
- No Prisma migration is required.

# v2.5.72 — Milestone M.2.1 Compliance Webhook Configuration Hotfix

- Fixes Shopify CLI `app-preview` rejection of the three mandatory privacy webhook subscriptions.
- Uses `compliance_topics` instead of normal `topics` for `customers/data_request`, `customers/redact`, and `shop/redact`.
- Keeps the existing authenticated webhook routes and Wishlist privacy cleanup behavior unchanged.
- Tightens the Milestone M.2 audit so this configuration regression cannot falsely pass again.
- No Prisma migration is required for this hotfix.

# v2.5.71 — Milestone M.2 Wishlist Commerce & Motion Catalog

- Completed logged-in customer wishlist persistence using the signed Shopify app proxy, with anonymous/local → authenticated/server merge and cross-device state.
- Added Wishlist Grid and Wishlist Empty State widgets plus an editable Marketplace Wishlist Page starter.
- Added storefront live product/variant refresh for wishlist cards and locale/currency-aware price formatting.
- Added customer/shop privacy-redact webhook handling for persisted wishlist records, backup/restore support and uninstall cleanup.
- Added the complete 97-name Animate.css catalog as VSN-native Motion presets without requiring the Animate.css stylesheet at runtime.
- Added 960 additional VSN-native Modern, Spring, Elastic, Robust, Pop, Zoom, Rotate, Drift and Reveal preset combinations; Motion Library now ships 1,063 built-ins including the legacy six.
- Added incremental Motion Library rendering so the 1,000+ preset catalog does not mount every preview card at once.
- Fixed Developer Studio light-mode code editor contrast across GraphQL, JSON, CSS, JavaScript, read-only responses and suggestions.

# v2.5.69 — Milestone L.1 UI & Runtime Refinement

## 2.5.70 — Milestone M.1 Wishlist Foundation (Developer Mode)

- Starts Milestone M without destabilizing the v2.5.69 runtime refinement baseline.
- Adds first-class `Wishlist Button` and `Wishlist Count` VSN Core widgets to the shared SDK/Widget Registry.
- Adds anonymous/local wishlist persistence with product/variant snapshots, cross-tab synchronization and DOM hydration for asynchronously rendered VSN pages.
- Adds theme-extension `vsn-wishlist.js` / `vsn-wishlist.css` runtime assets through the Page Renderer app embed.
- Logged-in server persistence, local → server merge, Wishlist Grid, Empty State and Wishlist Page template remain Milestone M.2.


- Fixed the Motion Library runtime crash caused by the missing `humanLabel` import.
- Reworked Theme App Embed verification to use App Bridge `shopify.app.extensions()` as the primary published-theme activation source, with the existing server theme inspection kept as a fallback.
- Added live sidebar counts for Campaigns, CRO Experiments, Floating Elements, Custom Fonts and SVG Library.
- Migrated Dashboard default ordering so compact/stat widgets appear before medium/wide widgets while preserving user drag order after migration.
- Expanded Custom Widget Studio to human-readable grouped field types with type-specific configuration for choices, numbers, media, design controls, date/time and SDK-defined field types.
- Extended the shared custom-widget renderer/control contract so the new field types render through their native VSN editor controls.
- Refined Dashboard/management dark-light surfaces plus editor portal dark mode, normalized close/delete icon sizing and added explicit danger styling for destructive editor actions.
- Synchronized Dashboard/Editor theme state in the same browser context and replaced raw JSON defaults for complex Custom Widget fields with human-readable configuration controls.
- Fixed latent `gridSettings`, `escapeAttr` and `dimensions` runtime references found during the full identifier scan.

# v2.5.68 — Milestone L Permissions 2.0 + Idle Runtime Stabilization

- Added server-enforced resource/action permissions for Pages, Marketplace, GraphQL Studio, Global CSS/JS, Plugin SDK and Billing while keeping store-owner access guaranteed.
- Expanded Roles & Permissions with owner-configurable action toggles and explicit grants for Developer Studio / Plugin SDK.
- Updated page/editor, Developer Studio and billing UI controls to reflect action capabilities instead of relying only on coarse roles.
- Fixed the Dashboard widget React key warning.
- Removed the restricted `accountOwner` GraphQL lookup and its `read_users` warning path.
- Hardened idle background requests with fresh App Bridge ID tokens, hidden/offline suspension, overlap protection, timeouts, proactive visible-session refresh, session recovery UI and a root client render recovery boundary.

# v2.5.67 — Milestone K.3 Client/Server Boundary Stabilization

- Fixed the React Router/Vite `Server-only module referenced by client` regression present in the v2.5.63 baseline.
- Split browser-safe permission contracts from database-backed server authorization.
- Removed unused `.server` permission imports from the parent App, Pages and Builder routes.
- Restored the established SPA Sidebar/TopNav navigation behavior; the temporary v2.5.65/v2.5.66 fallback-link/hydration-warning approach is not part of this package.
- Added a route boundary audit that rejects unused named imports from `*.server` modules.

# v2.5.63 — Milestone J Widget Platform 2.0 & UI Stabilization

- Added Widget Template Lab with protected root/content tokens, safe HTML parsing, widget-scoped CSS and shared Canvas/Preview/Storefront rendering.
- Added Visual Custom Widget Builder with reusable fields, live preview, activation, duplication, Trash/restore and explicit permanent-delete confirmation.
- Expanded SDK 2.0 with category, field-type, control, template-type and inspector-panel extension registries; SDK field types map safely onto VSN-native editor controls.
- Fixed the Motion Library `Plus` runtime crash, restored Brand Kit navigation count and made management pagination return smoothly to the first item.
- Completed editor/loader dark-mode support, collapsed-sidebar tooltips, Theme App Embed verification and danger state when the published embed cannot be confirmed.
- Expanded Roles & Permissions to per-system toggles, including separate Widget Studio access and owner-only Role Manager / Plugin SDK controls.
- Added Shopify management links in Settings, tracked Bug Report / Feature Request support flows and Documentation FAQs.
- Normalized management button typography to the VSN compact UI scale.

# v2.5.61 — Milestone H.3 Dashboard & UI Consistency

- Merged Plans and License into one Plans & License screen while preserving Monthly / Yearly plan switching and the established pricing-card UI.
- Added live menu counts for Pages, Saved Library, Marketplace catalog templates and Widgets.
- Restored Widgets summary cards for Total, Active, Disabled and Inactive widgets with page-usage-aware inactive status.
- Rebuilt Home as the configurable Dashboard with published pages, campaign graph, System Health, live runtime monitor and VSN storefront visitor map widgets.
- Added drag-to-reorder dashboard widgets plus a sticky settings drawer with show/hide and additional optional widgets.
- Normalized application form-control typography and select/input value colors to the VSN UI tokens without overriding code-editor typography.
- Added lightweight privacy-conscious storefront session analytics for the Dashboard visitor map; no IP address is stored.

# v2.5.60 — Milestone H.2 Single-Shell Correction

- Corrected the H.1 navigation interpretation: Dashboard and Builder management surfaces now share one persistent VSN Builder shell.
- Moved the single Sidebar and TopNav to the parent `/app` route so child Dashboard and Builder routes cannot render competing shells.
- Restored Dashboard Widgets management in the unified Build navigation alongside Pages, Saved Library, Marketplace and Brand Kits.
- Classified Campaigns/CRO/Floating, Fonts/SVG, Forms, Localization, Developer tools, System tools and account management in the same sidebar.
- Removed the rendered `AppSidebar` from `/app/pages`; the visual editor remains the only intentionally separate `s-app-window` surface.
- Kept legacy URLs and panel actions backward compatible while preventing parent shell revalidation during normal in-app navigation.

# v2.5.59 — Milestone H.1 Runtime Stabilization

- Hardened Marketplace catalog normalization so malformed/partial supplied rows are skipped instead of crashing the Builder panel.
- Hardened Marketplace favorites/install metadata joins against incomplete database rows.
- Replaced technical Builder panel error copy with VSN-native human-readable recovery UI.
- Technical exceptions remain in server logs; end users get Try again and System Health actions instead of stack-oriented instructions.

# v2.5.58 — Milestone H.1

- Renamed the active product UI to **VSN Builder**.
- Unified Shopify app navigation around Home, Builder, Library, Marketplace, Growth, Plans and Settings.
- Reclassified Home and Builder navigation without merging their distinct visual profiles.
- Added live Home control-center summaries and recent-page continuation through the existing `s-app-window` editor flow.
- Made Builder panel selection URL-addressable and refresh-safe while preserving direct legacy resource routes.

# v2.5.57 — Milestone H

- Separated merchant-owned Saved Library resources from VSN/remote Marketplace catalog resources.
- Moved legacy VSN starter/default pages and sections out of Saved Library and into Marketplace.
- Added separate My Library / Marketplace sources in the editor Template Browser with independent filters, favorites and pagination.
- Added Resource Package v4 with manifest, checksum, dependency inspection, conflict preview, ID remapping and transactional import.
- Added Page Package v3 with reusable-section dependency bundling and transactional remapping on import.
- Kept Dashboard Pricing Plans as the single authoritative commercial screen; Builder now shows plan usage only.

# v2.5.56 — Milestone G

- Restored Dashboard Plans Monthly / Yearly switching and the accepted pricing-page visual structure.
- Added mandatory `SRS.md` and engineering architecture/UI/error/testing/security standards.
- Extracted shared Builder panel helpers and added code-size debt ceilings.
- Removed exact duplicate release documents while preserving runtime files, migrations and compatibility reports.

# Changelog

## 2.5.54 — Milestone E / Phase 16
- Added four system-based commercial tiers: Core, Pro, CRO and Agency / Enterprise; all plans retain the full widget library.
- Added centralized usage quotas for builder pages, Marketplace installs, AI, CRO experiments and collaboration seats.
- Added Builder Launchpad onboarding for Landing Page, Product Page, Full Theme, CRO Test and Campaign workflows with developer-safe local demo drafts.
- Added Shopify-managed production billing handoff plus local Developer Mode entitlement simulation.
- Added launch/demo documentation, PageFly/GemPages/Replo migration guides, capability comparisons and public changelog workflow.
- Expanded System Health with Plans & Launch status and commercialization usage.

## 2.5.53 — Milestone E / Phase 15
- Added unified Accessibility, SEO, Performance and Security health scanner.
- Added enterprise Safe Mode, asset optimization controls, backup retention and dry-run environment promotion.
- Added critical CSS, used-assets-only dependency manifests, responsive image srcset and font preload/variant-pruning controls.
- Expanded System Health with page health scoring, categorized findings and audit export.

## 2.5.80 — Milestone P.2
- Added Platform Quality & Release tools: visual baselines, performance budgets, extension permission sandbox, command architecture foundation and migration simulator.
- Added 12 reference animation catalogs as VSN-native Motion timelines with canonical duplicate removal and accessibility-safe strobe/flicker adaptations.


## 2.5.83 — Milestone Q.3.1

- Fixed Windows `npm run db:prepare` failures caused by launching `npx.cmd` through `spawnSync` with `shell:false`.
- Prisma CLI commands now run through Node using the locally installed Prisma module, including legacy migration-history repair.
- Added explicit five-stage database preparation logs and real child-process startup/exit diagnostics.
- No database schema migration was added.

## 2.5.82 — Milestone Q.3

- Fixed clipped/invisible code suggestion UI by moving editor and Developer Studio suggestion menus into viewport-level overlay portals.
- Rebuilt Motion editing as a left live-preview / right inspector workspace with playhead scrubbing, multi-action editing, full transform/filter frames and intermediate keyframes.
- Expanded Dashboard workspace widths on large Shopify Admin viewports while preserving responsive gutters.
- Added lazy loading for secondary Dashboard screens and heavy Builder panels.
- Reduced initial built-in Motion Library JSON from roughly 1.72 MB to about 0.65 MB by sending compact preview records and fetching full built-in timelines only when edited.
- Added storefront payload budgets and Prisma hot-path index audits.

## 2.5.81 — Milestone Q.1-Q.2

- Fixed stale packaged Prisma migration state that could leave `BuilderEmailTemplate` unavailable after a package update.
- Added fail-fast database preparation, legacy migration-history repair, feature schema guards and System Health schema readiness.
- Added app-level runtime recovery/error reporting and hardened sensitive admin mutation request boundaries.
- Hardened SVG and Global Code execution safety while retaining Shopify-authenticated app proxy and webhook contracts.
