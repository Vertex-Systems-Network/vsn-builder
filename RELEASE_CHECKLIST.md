# VSN Builder — Production Release Checklist

## Before deploy
- Use Node version supported by package.json.
- Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL and SCOPES.
- Replace example.com URLs in shopify.app.toml for production config.
- Run `npm ci`, `npm run setup`, `npm run qa:release`, `npm run migration:check`.
- Run `npm run e2e`; optionally set `VSN_E2E_STORE_URL=https://your-store.myshopify.com` for live storefront checks.

## Shopify readiness
- Verify requested scopes are the minimum required for enabled features.
- Confirm app proxy `/apps/vsn-builder` responds on an installed development store.
- Confirm app/uninstalled and app/scopes_update webhooks are registered.
- Verify privacy/GDPR requirements for the chosen distribution and data stored by the app.
- Confirm billing/plan gates before enabling paid plans (no billing gate is forced by this package).

## Storefront matrix
- Home, page, collection, product, search, blog and article builder templates.
- Specific → default → original Shopify theme fallbacks.
- Load More, sorting, filters, variant selection, Add to Cart, Buy Now and cart drawer.
- Header/footer/global section assignments.
- Desktop/tablet/mobile and keyboard/reduced-motion checks.

## Operational
- Review Release & Diagnostics Center after deploy.
- Schedule `npm run cleanup` daily/weekly with the hosting scheduler, or POST `/internal/cleanup` with `Authorization: Bearer $CLEANUP_SECRET`.
- Retain production database backups before migrations.
- Monitor structured `vsn.request` and `vsn.error` log events.

## Milestone D — Phase 14 Developer SDK (v2.5.50)
- [x] Public Widget SDK / plugin manifest v1
- [x] Existing Editor control reuse through Control Schema API
- [x] Editor + Storefront Renderer APIs
- [x] Capability + style-profile hooks
- [x] mount / unmount / preview / save lifecycle hooks
- [x] Shopify + third-party Data Provider API
- [x] Query/Loop SDK provider source
- [x] Semantic plugin compatibility/versioning
- [x] Permission checks + safe render descriptors + source validation contract
- [x] Plugin renderer/provider crash isolation and failed-upgrade rollback
- [x] Owner-only Builder Plugin SDK dashboard
- [x] Developer docs, examples, validation CLI and test harness
- [x] Internal Spacer migrated to SDK registry/control lifecycle without changing legacy renderer output
- [ ] Remote plugin installation/signing/review (deferred; remote JS execution disabled)

## Milestone E — Phase 15 Enterprise Hardening (v2.5.53)
- [x] Accessibility scanner: contrast, heading order, alt text, labels, focusability, keyboard risks, tap targets
- [x] SEO scanner: H1, metadata, canonical conflicts, indexability, JSON-LD validation
- [x] Performance health: DOM, CSS, custom JS, known image weight, font weight, third-party blocks
- [x] Used-assets-only dependency manifests with compatibility mode
- [x] Critical CSS and safe generated-CSS deduplication
- [x] Responsive Shopify Image srcset and lazy-loading policy
- [x] Custom-font variant pruning and preload policy controls
- [x] Custom JavaScript/security warnings and Safe Mode
- [x] Store-scoped enterprise hardening settings
- [x] Backup age/count retention
- [x] Sanitized Health/Audit export
- [x] Developer-mode environment promotion preview (dry run only)
- [x] Actionable unified System Health dashboard

## Milestone E — Phase 16 Packaging, Monetization & Go-to-Market (v2.5.54)
- [x] Core, Pro, CRO and Agency / Enterprise plan architecture
- [x] Same widget library on every plan; plans differentiate systems and capacity
- [x] Builder page/template quota enforcement
- [x] Marketplace install quota + Pro catalog entitlement
- [x] Monthly AI quota enforcement
- [x] CRO experiment quota enforcement
- [x] Collaboration availability and team-seat assignment limits
- [x] Agency / Enterprise hardening entitlement
- [x] Shopify App Pricing production billing handoff
- [x] Developer Mode local plan simulation without merchant charges
- [x] Landing Page, Product Page, Full Theme, CRO Test and Campaign onboarding tracks
- [x] Developer-safe local sample/demo workspace seeding
- [x] Canvas → Native Section, Loop Builder, CRO and AI editable-output demo guides
- [x] PageFly, GemPages and Replo migration guides
- [x] Internal capability-comparison guidance without unverified competitor pricing
- [x] Existing Support Ticket + System Health diagnostic workflow documented
- [x] Public in-app changelog source updated
- [x] System Health Plans & Launch reporting
- [ ] Production plan activation / pricing configuration (external to Developer Mode; configure Shopify App Pricing and verify plan handles)

## Milestone F — Reliability & UX Foundation

- [ ] Existing VSN workspace visual language is preserved; Polaris is not forced where it conflicts with the product UI.
- [ ] Workspace and Editor use explicit visual profiles while sharing primitives/contracts.
- [ ] SVG upload/update/trash/restore refresh the current list without a full-screen reload.
- [ ] SVG previews render authored fill/stroke/currentColor on checker, light and dark backgrounds.
- [ ] SVG edit uses the shared code workspace with suggestions and sandboxed live preview.
- [ ] Every permanent destructive action covered by Milestone F asks for explicit user confirmation.
- [ ] System Health findings include Why, Impact, Fix steps and Verify guidance.
- [ ] Hidden/offline editor tabs do not keep collaboration heartbeat traffic active.
- [ ] Global interaction loader recovers from a missed explicit stop event.
- [ ] Canvas supports 25–200% zoom, Fit, Space-drag pan and zoom-aware width resize.
- [ ] Content, Style and Advanced inspector groups do not leak controls across tabs.
- [ ] `npm run qa:milestone-f` passes.

## Milestone H — Library / Marketplace / Resource Packages

- [ ] Saved Library returns merchant-owned `source=local` resources only.
- [ ] Legacy VSN supplied default rows are absent from Saved Library and available in Marketplace.
- [ ] Editor Template Browser keeps My Library and Marketplace as separate sources.
- [ ] Library Resource Package v4 inspection reports checksum/dependencies/conflicts before import.
- [ ] Library package import runs transactionally and remaps internal references.
- [ ] Page Package v3 imports reusable section dependencies transactionally.
- [ ] Dashboard Pricing Plans remains the authoritative billing/plan screen.
- [ ] `npm run qa:milestone-h` passes.

## Milestone I — Motion Engine 2.0 & Workspace Stabilization (v2.5.62)

- [x] Existing Phase 6 Interaction Engine remains the single motion runtime.
- [x] Reusable Motion Library supports built-in and merchant-created animations.
- [x] Custom animations support create/edit/duplicate/favorite/trash/restore/permanent-delete.
- [x] Interaction schema v4 supports intermediate keyframes and reduced-motion policy.
- [x] Canvas/Preview and storefront runtime consume the same keyframe model.
- [x] Editor can apply Motion Library presets and save selected timelines back to the library.
- [x] Global Settings expose Page Motion Defaults.
- [x] Motion presets are covered by backup/restore and uninstall cleanup.
- [x] Dashboard drag is handle-owned, live-reordered and single-commit.
- [x] Dashboard Settings is an icon-only floating cog with tooltip.
- [x] Collapsed sidebar navigation exposes non-clipped tooltips.
- [x] Settings contains only real VSN/Shopify-backed controls; pseudo API/reset/import controls are removed.
- [x] Light/Dark/System appearance persists per browser and management dark styling is normalized.
- [x] Owner profile has authenticated staff fallback for name/email and initials fallback for unavailable avatar.
- [x] Documentation uses the VSN management design system.
- [x] `npm run qa:milestone-i` passes.

## Milestone J — Widget Platform 2.0 & UI Stabilization (v2.5.63)

- [x] Motion Library imports every rendered icon and no longer crashes on Create animation.
- [x] Brand Kit navigation count is loaded from the current shop.
- [x] Library/Marketplace pagination returns smoothly to the first item on Next/Previous.
- [x] Editor exposes an appearance toggle and dark styling is limited to editor chrome, not merchant page colors.
- [x] Loader follows the resolved VSN Light/Dark appearance.
- [x] Only a verified enabled Theme App Embed displays `Theme Active`; other states are danger styled with Theme Editor recovery.
- [x] Role Manager uses toggles and exposes system-level access including Widget Studio.
- [x] Shopify-owned Settings rows link to the relevant Shopify management screen.
- [x] Support can create tracked Bug Report and Feature Request tickets and FAQ opens Documentation → FAQs.
- [x] Management button typography follows VSN compact tokens.
- [x] Widget Template Lab validates protected slots and uses one Canvas/Preview/Storefront contract.
- [x] Visual Custom Widgets are tenant-scoped, lifecycle-managed and registered in the shared editor/storefront registry.
- [x] SDK 2.0 exposes categories, field types, controls, template types and inspector panels through the plugin setup API.
- [x] Widget Platform migration is applied to packaged development SQLite and checksum matches.
- [x] `npm run qa:milestone-j` passes.

## Milestone K.3 — Client/server boundary stabilization

- [x] Shared permission definitions/helpers are client-safe and isolated from database/server imports.
- [x] DB-backed permission checks remain in `builder-permissions.server.js`.
- [x] Parent App, Pages and Builder routes have no unused `canAccessBuilderEditor` server import.
- [x] Route scan reports no unused named `*.server` imports.
- [x] Sidebar and TopNav preserve SPA navigation/loader transition behavior.
- [x] Temporary v2.5.65/v2.5.66 hydration fallback layers are excluded from this clean package.
- [x] `npm run qa:k3` passes.

## Milestone L — Permissions 2.0 + Idle Runtime Stabilization (v2.5.68)

- [x] Dashboard widget list renders mapped widgets through a stable keyed boundary.
- [x] Shell identity no longer queries Shopify `accountOwner` / `read_users`-restricted fields.
- [x] Passive Dashboard and collaboration requests obtain fresh App Bridge ID tokens, reject overlap, time out and pause hidden/offline tabs.
- [x] Visible embedded sessions are proactively refreshed on mount/focus/page-show/visibility return and at a bounded 60-second cadence.
- [x] Client render failures surface VSN Retry/Reload recovery instead of a blank iframe.
- [x] Pages permissions cover view/create/edit/publish/delete/restore/import with server enforcement.
- [x] Marketplace permissions cover browse/favorite/install/rollback with server enforcement.
- [x] GraphQL Studio separates read/run/save/mutation permissions; mutations remain confirmation-gated.
- [x] Global CSS/JS separates view/edit/publish/delete permissions.
- [x] Plugin SDK and Billing expose distinct action permissions.
- [x] Developer Studio / Plugin SDK require explicit non-owner grants; store owner remains full-access.
- [x] Role Manager persists backward-compatible action matrices in `roleAccessJson` without a destructive migration.
- [x] Milestone G giant-file debt ceilings remain green after extracting passive collaboration heartbeat logic.
- [x] `npm run qa:milestone-l` passes.

## Milestone O documentation / ecosystem gate

- Run `npm run docs:generate` after changing documented platform contracts.
- Run `npm run qa:milestone-o` and confirm no manifest/documentation drift.
- Confirm in-app Documentation version/counts match the packaged baseline.
- Confirm `npm run qa:release` includes the Milestone O audit.

## Milestone Q.1-Q.2 runtime/security gate
- Run `npm run db:prepare` and confirm the required-table check passes before application startup.
- Confirm System Health reports the expected migration applied and no required feature tables missing.
- Run `npm run qa:milestone-q12` and `npm run security:audit`.
- Verify client runtime failures show recovery UI rather than a blank iframe.
- Verify app proxy/webhooks retain Shopify signature/HMAC authentication; do not add same-origin checks to storefront/webhook traffic.

## Milestone Q.3 performance / editor UX gate
- Run `npm run qa:milestone-q3`, `npm run performance:q3` and `npm run db:index-audit`.
- Confirm secondary Dashboard pages and heavy Builder panels are lazy-loaded rather than part of the initial management bundle.
- Confirm built-in Motion Library initial JSON remains below the 800 KB budget and full timelines load only for editing.
- Confirm code suggestions render through viewport-level portals and remain visible inside scrollable editor/dashboard containers.
- Confirm Motion Editor supports live preview/playhead, multiple actions, full transform/filter frames and intermediate keyframes.
- Confirm storefront Theme App Extension JavaScript/CSS stays within the packaged payload budget.

## Milestone Q.4 — Shopify production integration

- [ ] Keep `shopify.app.toml` as the development configuration.
- [ ] Set a stable HTTPS `SHOPIFY_PRODUCTION_APP_URL` (not Cloudflare/ngrok/localhost).
- [ ] Set `SHOPIFY_PRODUCTION_CLIENT_ID`, or explicitly opt into the current app client ID.
- [ ] Run `npm run config:production`.
- [ ] Run `npm run release:production:check` and resolve every failure.
- [ ] Confirm Admin/Webhook API `2026-07` is supported and System Health reports no API fall-forward.
- [ ] Confirm all required/compliance webhooks are declared and deployed.
- [ ] Confirm the published theme app embed reports Theme Active.
- [ ] Confirm app proxy remains `/apps/vsn-builder` for new installs; do not assume existing merchant-customized proxy paths changed.
- [ ] Deploy with `npm run deploy:production` so the named production config is used.
- [ ] On the hosting service, set `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`; keep `VSN_DEFAULT_PLAN` blank.
- [ ] Set `SHOPIFY_APP_HANDLE` (or a validated `SHOPIFY_APP_PRICING_URL`) for Shopify-hosted plan selection.
- [ ] Confirm Partner Dashboard plan handles match Core/Pro/CRO/Agency mapping before production commercialization.

## Milestone Q.4.1 — Prisma CLI/bootstrap reliability

- [ ] `npm run prisma:verify` resolves `package.json#bin.prisma`, not Prisma package main/type metadata.
- [ ] `prisma` and `@prisma/client` are pinned to the same release.
- [ ] `npm run db:prepare` completes without Windows `.cmd` launching or `build/types.js` resolution.
- [ ] If dependencies are corrupt, `npm run prisma:repair` repairs only Prisma dependency folders and preserves `prisma/dev.sqlite`.
- [ ] Main-vs-bin fixture regression audit passes.

## Q.4.5 embedded mutation-origin hotfix

- Authenticated embedded mutations must accept the effective public app origin behind Shopify CLI/reverse proxies and Shopify-controlled Admin origins.
- Every guarded mutation module must continue to authenticate with `authenticate.admin`.
- Arbitrary cross-site, malformed and Shopify-lookalike origins must remain rejected.
- Q.4.5 adds no database migration.


## Q.4.8 Email Studio 2.2
- [ ] Reusable symbols propagate and detach correctly.
- [ ] Saved blocks persist per shop.
- [ ] Commerce browser loads with read_products and fails gracefully.
- [ ] Desktop/mobile visibility is identical in HTML and MJML.
- [ ] Email revisions restore without overwriting until save.
- [ ] Marketplace plan gates are enforced server-side.
- [ ] AI output is structured, server-only and quota-gated.

## Milestone Q.5.2 — Verified Shopify Subscription Sync

- [ ] `SHOPIFY_PARTNER_ORGANIZATION_ID` is set in production.
- [ ] `SHOPIFY_PARTNER_API_TOKEN` is stored server-side and the Partner API client has the required app-management access.
- [ ] Shopify App Pricing app and plan handles match the production pricing configuration.
- [ ] A real development/test store completes plan approval and the returned `plan_handle` triggers a successful Partner API verification.
- [ ] Active, trial, scheduled-cancel, canceled and frozen lifecycle states are verified against Shopify before public launch.
- [ ] `VSN_DEFAULT_PLAN` remains blank in production and Developer Mode sync override is disabled unless explicitly testing.

## Milestone Q.5.3 — Entitlement Engine 2.0
- [x] Production paid tiers require trusted Shopify subscription authority.
- [x] `VSN_DEFAULT_PLAN` is development-only and cannot grant production paid access.
- [x] Pages, Marketplace, AI, CRO and collaboration-seat quotas use one server-side decision engine.
- [x] Backups, Global Library, Developer SDK and Enterprise controls use named feature decisions.
- [x] Plans, License and Dashboard consume the redacted entitlement snapshot.
- [x] Direct legacy `quotaAllows` enforcement is absent from mutation routes/services.
- [x] No Q5.3 Prisma migration.
- [x] `npm run qa:q53` passes.

## Milestone Q.5.4 — Billing Lifecycle UX
- [x] Public plans are Free / Silver / Gold / Platinum.
- [x] Exact Shopify handles are `free` / `sliver` / `gold` / `platenium`.
- [x] Stable internal entitlement IDs remain `core` / `pro` / `cro` / `agency`.
- [x] Active, trial, pending plan, cancellation and verification states have merchant-readable UX.
- [x] Manual Shopify subscription refresh is server-authenticated and permission-aware.
- [x] Old/mismatched fresh subscription cache handles force re-verification.
- [x] Production billing changes remain Shopify-hosted and role-restricted.
- [x] No Q5.4 Prisma migration.
- [x] `npm run qa:q54` passes.


## Milestone Q.5.5 — Billing Production Lifecycle QA

- [x] Exact Shopify handles remain `free` / `sliver` / `gold` / `platenium`.
- [x] `activeSubscription` is canonical for current plan authority.
- [x] Historical events cannot override an active contract into a paid tier.
- [x] Temporary Partner API 429/5xx/throttling/network failures use bounded retry.
- [x] 401/permission failures are not retried.
- [x] Install, Free, Silver, Gold, Platinum, upgrade, downgrade, cancellation, freeze/unfreeze, trial and reinstall flows are covered by `qa:q55`.
- [x] Reinstall rebuilds the disposable local subscription mirror from Shopify.
- [x] No Q5.5 Prisma migration.
## Q.6.4 — Hydration, UI Theme, Maps & Form Security
- [x] Hydration-time shell/view updates use React transitions; default Home is not behind lazy Suspense.
- [x] UI scheme presets/custom accent persist and publish shared management CSS variables.
- [x] Google Maps key is encrypted server-side and the Map widget uses the keyed Embed API route.
- [x] reCAPTCHA v2/v3 credentials are encrypted, rendered on storefront forms and verified server-side.
- [x] No destructive database change; exact Shopify billing handles preserved.

