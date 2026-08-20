# VSN Builder v2.5.54 — Milestone E / Phase 16 Complete

## Scope
Phase 16 implements Packaging, Monetization & Go-to-Market while the application remains in Developer Mode. It reuses the existing builder, billing boundary, Marketplace, AI, CRO, collaboration, enterprise hardening, onboarding state, documentation, support and changelog systems instead of creating parallel runtimes.

## Product positioning
**Shopify-native visual site, template and CRO builder with developer-grade CSS control.**

Commercial tiers are system/capacity based. The widget library is not split by plan.

## Plans and entitlements
Central plan configuration now defines:
- Core / Free
- Pro
- CRO
- Agency / Enterprise

Plan capacity is available to the runtime through one `getPlan()` / `getPlanUsage()` source. Current enforced dimensions include:
- builder pages/templates
- Marketplace installs and Pro catalog entitlement
- monthly AI generations
- active CRO experiments
- collaboration availability and collaboration-seat assignment limits
- Agency / Enterprise hardening controls

Legacy `free` and `enterprise` plan keys normalize to the new plan model for backward compatibility.

## Billing boundary
Production paid-plan activation remains Shopify-managed through `SHOPIFY_MANAGED_PRICING_URL`. Developer Mode may simulate a tier locally using the existing `BuilderSubscription` model. The Phase 16 UI never creates a merchant charge, publishes a page, activates a theme or performs an environment promotion automatically.

No new Prisma migration is required: Phase 16 reuses existing `BuilderSubscription`, `BuilderShopSetting`, AI usage, CRO, Marketplace and collaboration data.

## Onboarding / launchpad
Builder → Setup now exposes five goal-led workflows:
1. Landing Page
2. Product Page
3. Full Theme
4. CRO Test
5. Campaign

Each workflow has adaptive progress derived from real Builder data. Developer-safe demo seeding can prepare editable local drafts. Full Theme creates local Home/Header/Footer/Collection/Product drafts; CRO creates Control/Variation drafts; Campaign creates a popup draft. Nothing is published automatically.

## Demo and migration material
Packaged documentation now includes:
- sample-store workflow
- Canvas → Shopify Native Section demo
- Loop Builder demo
- CRO demo
- AI editable-output demo
- PageFly migration guide
- GemPages migration guide
- Replo migration guide
- capability-comparison guidance for the same products
- product positioning, support workflow and public changelog workflow

Competitive documents deliberately avoid hard-coded competitor pricing or unsupported claims.

## Dashboard and Builder integration
- Dashboard Pricing uses the centralized four-plan model and Shopify-managed billing handoff.
- Dashboard Documentation exposes implementation/demo/migration workflows.
- Builder → Plans exposes the same plan source and live usage.
- Builder → Setup exposes the Launchpad.
- System Health adds **Plans & Launch** metrics and exports Phase 16 status.
- In-app public release history was filled forward through v2.5.54.

## Developer-mode guardrails
- Developer stores default to full Agency-level testing access unless a tier is explicitly simulated/overridden.
- Production defaults to Core when there is no active subscription.
- `VSN_DEFAULT_PLAN` is an optional developer override and is blank in `.env.example`.
- `VSN_FEATURE_COMMERCIALIZATION` is centrally registered.
- Production billing configuration remains external to this developer package.

## QA
Phase 16 has a dedicated static/runtime-independent audit in `scripts/phase16-commercialization-audit.mjs`. Phase 15’s audit was made forward-compatible so enterprise hardening remains a regression gate on Phase 16 and later releases.

## Verification status
- Phase 16 commercialization audit: 69/69 PASS
- Phase 15 enterprise-hardening regression: 42/42 PASS
- Phase 0–14 static phase audits were rerun; Phase 9 quota audit was made forward-compatible with the centralized commercial plan source.
- Package integrity: PASS
- Static E2E contract: PASS
- Security audit: 0 high-priority findings
- Storefront renderer performance budget: PASS
- JS/JSX/TS parse pass: 191 app files, no syntax parse errors using the available global TypeScript parser
- Packaged SQLite `PRAGMA integrity_check`: OK
- Latest packaged migration remains Phase 15 and its Prisma checksum matches the packaged SQL. Phase 16 requires no database migration.

`npm ci` could not complete in the execution sandbox because the internal npm mirror returns 404 for the locked `lucide-react@1.26.0` tarball; the sandbox Node version also reports an engine warning for `@shopify/polaris-types` requiring Node >=22.18 while the sandbox is 22.16. This report therefore does not claim a dependency-backed production build. Developer Mode production URLs remain intentionally unchanged.
