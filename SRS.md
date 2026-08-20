# VSN Builder — Software Requirements & Engineering Standard

**Status:** Mandatory for human and AI-assisted development  
**Applies to:** application UI, editor, storefront renderer, Shopify integrations, database, SDK/plugins, scripts and release packages.

## 1. Product intent
VSN is a Shopify-native visual commerce builder. Every change must preserve editable VSN schema, backward compatibility and a predictable merchant workflow. New features may extend the platform but must not create a second competing architecture for an existing engine.

## 2. Non-negotiable engineering rules
1. **One source of truth.** A domain concept has one canonical registry/service/schema. UI copies are views, not alternate stores.
2. **Shared renderer contract.** Canvas, preview and storefront must resolve the same document model unless an explicitly documented editor-only behavior is required.
3. **Server authorization is mandatory.** Hiding a button is not permission enforcement.
4. **No silent destructive behavior.** Reversible Trash is preferred. Permanent delete requires explicit consent.
5. **No raw technical errors for merchants.** User-facing errors state what failed, why it matters, what the user can do and how to verify the fix. Technical context belongs in logs/System Health.
6. **No unbounded async work.** Requests require loading, success, failure, timeout/abort and stale-response handling where relevant.
7. **No feature-by-feature UI invention.** Use the appropriate VSN UI profile and existing primitives before adding new visual patterns.
8. **No schema break without migration.** Document, widget, style, query, component, localization and database changes require versioned migration/compatibility logic.
9. **No production assumptions in Developer Mode.** Billing, domains, deployment and irreversible production changes stay gated until explicitly enabled.
10. **No dependency added for convenience alone.** Explain the runtime/bundle/security tradeoff before adding a dependency.

## 3. UI profiles
### Workspace / Dashboard
Use the established VSN admin visual language: comfortable spacing, resource cards/tables, human-readable status, clear actions and Shopify-compatible interaction behavior. Polaris may be used only when it visually fits without forcing a redesign.

### Editor
Use the compact canvas-first VSN editor profile: high information density, stable panels, clear Content/Style/Advanced boundaries, minimal layout movement and no admin-card styling inside inspector controls.

The two profiles may share field schemas, validators, modal mechanics, error contracts and tokens. They must not be visually mixed.

## 4. Component and module boundaries
- Route loaders/actions authenticate and translate HTTP input/output.
- Domain services own database/API behavior.
- Registries own definitions/capabilities.
- Renderers render; they do not become persistence layers.
- UI components do not call Prisma or Shopify Admin clients directly.
- Cross-feature helpers live in `app/utils` only when genuinely shared.
- Feature-only helpers remain beside the feature.

## 5. State ownership
Prefer state at the narrowest owner. Derived state should be computed rather than duplicated. Effects must not mirror props into state unless there is a documented reason. Any effect that calls `setState` must have stable dependencies and a defined termination condition.

## 6. Async and loading contract
Every mutation/resource workflow must define:
- owner screen/panel;
- pending entity/intent where applicable;
- abort/stale-response behavior;
- success refresh strategy;
- readable error state;
- retry/recovery path.

A request from one screen must never leave another screen permanently loading.

## 7. Error standard
User error copy should follow:
**Problem → Cause (when known) → Impact → Fix → Verify.**
Never display Prisma/GraphQL/React stack traces directly to merchants.

## 8. Naming and readability
Names should describe the domain, not implementation trivia. Avoid generic names such as `data2`, `handlerX`, `thing`, `utils2`. Comments explain **why**, constraints and tradeoffs—not obvious syntax. Prefer small cohesive functions and explicit contracts over clever abstractions.

## 9. Human-quality code standard
Code must read like deliberate engineering work regardless of whether written by a human or AI:
- no repetitive generated boilerplate;
- no unnecessary headings/comments inside source files;
- no speculative abstractions with one caller;
- no giant catch-all helper modules;
- no unexplained magic constants;
- no fake success states;
- no invented API capabilities;
- no inconsistent naming between UI, DB and services;
- tests verify behavior and regressions, not string snapshots alone when runtime tests are practical.

## 10. File-size/decomposition policy
New UI/domain modules should normally stay below 500 lines. Existing legacy editor files above that limit are **debt budgets**, not examples. They may be reduced incrementally but should not grow without an explicit exception documented in the pull request/release report.

## 11. Security
Sanitize user-controlled HTML/SVG, validate URLs, protect secrets, sign external webhooks where supported, rate-limit public writes and isolate plugin failures. Custom JS and GraphQL mutation capabilities require explicit permissions and Safe Mode compatibility.

## 12. Accessibility
Interactive controls require keyboard access, visible focus, readable labels and appropriate semantics. New UI must not rely on color alone for state.

## 13. Release requirements
Every release must:
1. update version/baseline/release notes;
2. run applicable regression audits;
3. verify package integrity and migration checksums;
4. document any gate not executed and the exact reason;
5. never claim a production build passed when dependency/runtime execution did not run;
6. preserve Developer Mode guardrails unless explicitly changed by the product owner.

## 14. Definition of done
A feature is complete only when its happy path, empty/loading/error states, permissions, deletion lifecycle, persistence, refresh behavior, backward compatibility and documentation are covered where applicable.

## Documentation contract (Milestone O)

User-facing platform changes must update task-based documentation when behavior changes. Developer-facing contract changes must update the relevant developer/engineering reference. Source-derived counts/version inventory are tracked by `app/config/ecosystem-manifest.json`; release QA must fail when that manifest drifts from runtime contracts.

## Q.1-Q.2 production-readiness rules
- Package startup MUST fail fast when required database migrations/tables are missing.
- Known migration-history repairs MAY mark a migration applied only after proving its exact schema changes already exist; they MUST NOT replay SQL or reset data.
- Sensitive embedded-admin mutations MUST pass Shopify authentication and request-origin/fetch-metadata checks.
- Storefront app-proxy and webhook endpoints MUST continue using Shopify signature/HMAC authentication instead of embedded-admin origin rules.
- Critical executable code constructs blocked by the Global Code security policy MUST NOT be delivered to storefront runtime.
- Client/runtime diagnostics MUST minimize persisted navigation data and MUST NOT expose database/internal stack details as end-user action errors.

## Q.3 performance hardening rules
- High-cardinality built-in catalogs SHOULD transfer compact list/preview records and load full editable detail on demand.
- Secondary management screens and heavyweight editor systems SHOULD use code-split lazy boundaries where SSR/runtime behavior remains deterministic.
- Autocomplete/suggestion surfaces MUST render outside scroll-clipped inspector/card containers.
- Dashboard workspace width SHOULD scale to large Shopify Admin viewports while retaining bounded responsive gutters.
- Storefront runtime JavaScript/CSS and high-frequency database query indexes MUST be enforced by automated budgets/audits.

## Q.4 Shopify Production Integration Requirements

- The default Shopify CLI configuration shall remain development-safe and must not be overwritten with production URLs during local development.
- Production deployment shall use a named Shopify CLI configuration generated from an explicit stable HTTPS application URL and production Client ID.
- The production OAuth redirect shall resolve to `<application_url>/auth/callback`.
- The Admin/Webhook API target shall be versioned and System Health shall detect Shopify API fall-forward.
- App-specific webhooks and mandatory compliance topics shall remain TOML-declared and authenticated by Shopify's webhook authenticator.
- `app/uninstalled` and `shop/redact` shall invoke one idempotent full-shop VSN data deletion lifecycle.
- Production runtime startup shall reject missing Shopify credentials, development tunnel URLs and developer-only plan overrides.
- Production deployment shall explicitly select the production Shopify config rather than relying on the current CLI default.

## Q.4.1 Prisma CLI Resolution Requirements

1. Database bootstrap MUST resolve Prisma's executable from the installed package's `bin.prisma` metadata, not from the package main/type entry.
2. Prisma CLI and client versions MUST remain pinned together for deterministic local and production bootstrap behavior.
3. Database preparation MUST expose the resolved Prisma version and executable path before migration work starts.
4. Dependency repair MUST NOT delete or reset `prisma/dev.sqlite` or merchant data.
5. Release QA MUST reproduce a package where the main entry is invalid but `bin.prisma` is valid and verify that bootstrap still chooses the CLI bin.

## Q.4.5 embedded mutation trust

- Authenticated embedded mutations must accept the effective public app origin behind Shopify CLI/reverse proxies and Shopify-controlled Admin origins.
- Every guarded mutation module must continue to authenticate with `authenticate.admin`.
- Arbitrary cross-site, malformed and Shopify-lookalike origins must remain rejected.
- Q.4.5 adds no database migration.


## Q.4.8 Email Studio 2.2
Email Studio SHALL support linked in-document symbols, merchant reusable email blocks, bounded authenticated Shopify commerce discovery, per-block desktop/mobile visibility, persistent before-save revisions, plan-aware curated Email Marketplace templates, and structured server-side AI assistance. These features SHALL reuse existing persistence models and SHALL NOT require a new Prisma migration or introduce an email-sending runtime.


## Q.5.3 Entitlement Engine 2.0 Requirements

1. Production paid feature access MUST derive from a trusted Shopify App Pricing subscription mirror and MUST fail closed to Core when authority is unavailable or untrusted.
2. Environment/default plan configuration MUST NOT grant production paid entitlements.
3. Paid feature, quota and variable minimum-plan enforcement MUST use the centralized entitlement service at server boundaries; UI visibility alone is not authorization.
4. Quota usage MUST use stable persisted commercial state rather than transient UI activity.
5. UI plan/usage state SHOULD consume the same serialized entitlement snapshot used by server decisions.
6. New paid capabilities MUST add a named entitlement definition and automated enforcement coverage.

## Q6.3 Stock Image Hub & Persistent View Settings

The platform SHALL persist Dashboard widget preferences and Templates data-view preferences per shop. The Templates view SHALL default to List before Grid and the dashboard aside SHALL remain above workspace overlays at z-index 99.

The platform SHALL provide an authenticated Stock Images workspace that normalizes Unsplash, Pexels, and Pixabay results while preserving provider attribution and provider-specific search capabilities. Provider API credentials SHALL be stored server-side encrypted and SHALL NOT be serialized to browser loaders/actions. Imports SHALL re-resolve the provider item server-side and transfer supported images to Shopify Files using Shopify staged upload/file mutations. Favorites, imports, updates, and confirmed permanent Shopify-file deletion SHALL be available according to VSN role permissions. Pixabay responses SHALL respect its 24-hour cache/no-permanent-hotlink contract, and Unsplash imports SHALL fire the provider download-tracking endpoint.
