# VSN Builder Project Context

**Last verified:** 2026-09-18  
**Base reviewed:** `main` at `5edbece879d5eca0650fe34b96b07447ad6b5739`  
**Package version:** `2.5.107`

This file is a compact navigation map, not a replacement for source code or `SRS.md`.

## Product

VSN Builder is a Shopify-native visual commerce platform. The repository contains a page/template editor, storefront renderer/app proxy, reusable components and templates, responsive/style systems, interactions/motion, campaigns, experiments, localization, forms, collaboration, SDK/plugin infrastructure, Email Studio, stock media, billing/entitlements and AI-assisted generation.

The strategic target is not “a page builder with an AI button.” It is an AI-native commerce design/production system in which conversational agents operate the same typed, editable and reversible capabilities available to the visual product.

## Current stack and contracts

- React 18 + React Router 7 application.
- Shopify embedded application and theme app extension.
- Prisma 6.19.3; current datasource in `prisma/schema.prisma` is SQLite.
- Node runtime contract in source: Node 22.18+ LTS, `<23`.
- Playwright plus a large repository-specific QA/audit suite.
- Shopify config currently targets webhook Admin API `2026-07`.
- Current development-safe `shopify.app.toml` intentionally uses placeholder `example.com` URLs; production configuration is expected to be explicit/separate per `SRS.md`.

## Critical source locations

### Product/engineering contracts

- `SRS.md` — mandatory product and engineering rules.
- `package.json` — runtime commands, quality gates, package version and engines.
- `scripts/lib/runtime-compat.mjs` — supported Node runtime definition.
- `.github/workflows/ci.yml` — GitHub Actions production-confidence workflow.
- `Dockerfile` — container runtime.
- `shopify.app.toml` — development Shopify application contract.
- `prisma/schema.prisma` — persisted database model.

### Canonical builder model

- `app/builder/widgetRegistry.js` and capability/style registries — widget definitions/capabilities.
- `app/builder/schemaMigrations.js` — builder content migration.
- `app/builder/styleEngine.js`, `stylePipeline.js`, `styleSchema.js` — styling contracts.
- `app/builder/responsiveEngine.js` — responsive rules.
- `app/builder/componentSystem.js` — reusable component resolution.
- `app/builder/editorCommand.js` — editor command/history primitive.
- `app/services/command-bus.server.js` — transactional server command + audit primitive.
- `app/routes/builder-proxy.$.jsx` — current storefront app-proxy/rendering integration; very large legacy hotspot.

### Current AI

- `app/builder/aiBuilder.js` — allowed widget set, AI-plan normalization, AI plan -> VSN nodes, validation and responsive/accessibility scans.
- `app/services/ai-builder.server.js` — page AI provider call, URL inspiration fetch, quota/usage logging.
- `app/routes/app.ai.jsx` — authenticated AI route/operation boundary.
- `app/components/editor/AiBuilderPanel.jsx` — current editor AI UX.
- `app/services/email-ai.server.js` — Email Studio AI generation.
- `scripts/phase9-ai-builder-audit.mjs` — deterministic/static AI foundation audit.
- `BuilderAiUsage` in Prisma — current AI usage telemetry.

### Email

- `app/email/emailSchema.js` — canonical email document/block model.
- `app/email/emailRenderer.js`, `emailMjml.js`, `emailCompatibility.js` — email render/compatibility layers.
- Email Studio routes/components live under `app/routes` and `app/components/email`.

### Motion

- `VSN-Motion-Studio-3.0-Master-Plan.md` — proposed engine-agnostic motion architecture.
- Existing VSN motion/interaction source remains authoritative over plan prose.

## Verified current AI behavior

The page AI currently:

- uses the OpenAI Responses endpoint directly through `fetch`;
- defaults to `VSN_AI_MODEL || gpt-5-mini`;
- requests strict structured JSON matching a defined schema;
- converts output into editable VSN nodes rather than injecting arbitrary HTML;
- drops unsupported widget types and validates generated VSN output;
- provides section/page/screenshot/URL/rewrite/responsive/accessibility/alternative operations;
- blocks private/local URL inspiration targets and re-checks redirects/DNS;
- records usage/tokens/response ID/duration/status in `BuilderAiUsage`;
- applies plan quota checks.

Email AI similarly produces structured editable email blocks and rejects arbitrary HTML/CSS/JS/Liquid generation in that path.

Current limitations relevant to the AI-native target:

- provider/model behavior is coupled directly to OpenAI endpoint/model env configuration;
- generation is primarily single-shot rather than a planner/tool execution loop;
- no repository-level prompt/behavior version registry was found in the reviewed path;
- no first-class golden-task/model evaluation framework was found;
- current AI telemetry does not persist provider, prompt/behavior version, command/revision linkage, eval score or estimated cost;
- current `phase9` AI audit is mainly deterministic/static contract checking, not a semantic live-model eval;
- no Sidekick app data/action extension exists in the reviewed `extensions/` root; current extensions contain the VSN theme extension.

## Existing primitives to reuse for AI-native work

Do not greenfield what VSN already owns:

- Convert AI intent into typed operations that use/extend the existing command-bus and editor history concepts.
- Keep `aiBuilder.js` normalization/validation as a defense layer while moving orchestration above it.
- Keep canonical widget/email/motion schemas as output targets.
- Use existing revisions/audit logs for traceability and undo/revert integration.
- Use existing entitlements for server-side AI authorization/quota policy.
- Use existing experiments as the downstream system for AI-generated variants rather than inventing an AI-only A/B-test store.

## Verified operational baseline and remaining debt

### P0.1 runtime alignment — resolved and guarded

The repository runtime contract is now consistent across release paths:

- `package.json` requires Node `>=22.18 <23`;
- `.nvmrc` and `.node-version` select Node 22;
- `.github/workflows/ci.yml` pins Node `22.18.0`;
- `Dockerfile` uses `node:22-alpine3.24`;
- `scripts/security-audit.mjs` blocks drift in the runtime version matrix.

The security hardening stack is merged to `main`, and post-merge Production Confidence run #385 passed. Treat runtime alignment as a maintained invariant rather than an outstanding blocker.

### P1 — oversized integration hotspots

Several editor modules and `app/routes/builder-proxy.$.jsx` are very large legacy files. `SRS.md` explicitly treats files above the normal module budget as debt, not examples. Refactor incrementally around tested domain boundaries; do not rewrite them wholesale.

### Verify before production-scale assumptions

`prisma/schema.prisma` currently uses SQLite. Before designing multi-instance/high-concurrency production AI jobs, verify the actual production deployment/database topology. Do not assume the repository datasource is suitable or unsuitable without that deployment evidence.

## External platform research snapshot — 2026-08-26

Use current official documentation before implementing; these links are navigation anchors, not frozen contracts.

- Shopify Sidekick app extensions: https://shopify.dev/docs/apps/build/sidekick
- Shopify Tools API: https://shopify.dev/docs/api/app-home/apis/user-interface-and-interactions/tools-api
- Shopify theme blocks: https://shopify.dev/docs/storefronts/themes/architecture/blocks
- Replo AI page generation: https://docs.replo.app/features/building-pages-ai
- Instant AI Agent: https://docs.instant.so/en/articles/16068072-meet-instant-ai
- Instant MCP: https://docs.instant.so/en/articles/16068062-access-tokens-and-mcp
- GemPages MCP: https://help.gempages.net/articles/introduction-to-gempages-mcp
- Klaviyo Composer: https://help.klaviyo.com/hc/en-us/articles/52230280693403

## Context discipline

Do not paste full pages/documents into AI context if a summarized canonical representation is enough. Context assembly should be tenant-scoped, task-specific, bounded and attributable. Historical milestone files are evidence only when the current task needs their specific history.
