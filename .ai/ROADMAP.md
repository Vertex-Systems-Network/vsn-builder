# VSN AI-Native Roadmap

This roadmap is ordered by dependency and risk, not marketing visibility. Do not start later agent autonomy while the execution/eval/safety foundation is unstable.

## North-star outcome

A merchant should be able to describe a commerce goal, not a CSS task, and VSN should safely turn that intent into editable page/template, email, motion and experiment assets using real Shopify/brand context, deterministic VSN tools, measurable quality checks and explicit approval before anything consequential goes live.

## P0 — Production evidence and AI control plane

### P0.1 Maintain runtime/release alignment — COMPLETED BASELINE

**Status:** completed and validated on the security-hardened `main` baseline.

Current invariant:

- `package.json`: Node `>=22.18 <23`;
- `.nvmrc` / `.node-version`: Node 22;
- CI: pinned Node `22.18.0`;
- Docker: maintained `node:22-alpine3.24`;
- blocking security audit detects runtime-version drift;
- post-merge Production Confidence run #385 passed, including protected external QA/E2E.

Ongoing acceptance:

- keep package/runtime/CI/Docker contracts aligned;
- keep Production Confidence green;
- do not relax runtime guards to accommodate an incompatible dependency without evidence and explicit review.

### P0.2 Version AI behavior and provider policy — COMPLETED BASELINE

**Status:** implemented in PR #21 with versioned Page/Email behavior contracts, a shared provider boundary, attributable generation telemetry, bounded timeout/retry policy, and release-blocking deterministic QA.

Actions:

- introduce an internal AI provider interface around current OpenAI calls;
- move operation instructions into versioned behavior definitions;
- record provider, model, behavior version and generation ID in AI telemetry;
- keep current OpenAI path as the first adapter; do not add providers without a product reason;
- define explicit timeout/retry/fallback policy.

Acceptance:

- page and email AI call product-level provider/behavior contracts rather than constructing vendor calls independently;
- model/prompt changes are attributable and rollbackable;
- current behavior remains feature-flag recoverable.

### P0.3 Define typed AI-capable command registry — COMPLETED BASELINE

**Status:** implemented in PR #23 with a versioned server-side command registry, tenant/role/collaboration guards, stale-version rejection, transactional audit logging, revision-based undo metadata, and direct denial of consequential publish execution.

Actions:

- inventory current editor/server command paths and domain services;
- define stable typed operations for read, reversible draft mutation and consequential actions;
- extend existing `command-bus`/history infrastructure instead of replacing it;
- bind commands to permission/tenant/entitlement checks;
- include base revision/version and undo metadata.

Acceptance:

- AI can apply a small set of page edits through commands without replacing the whole page document;
- every command is auditable and safely rejected when unauthorized/stale;
- no direct model -> Prisma/Shopify mutation path.

### P0.4 Build AI eval harness — COMPLETED BASELINE

**Status:** implemented in Issue #24 / the P0.4 branch with versioned deterministic and provider-backed suites, release-blocking adversarial contract evals, safe result artifacts, and old-vs-new comparison reporting. Provider semantic evals remain explicit opt-in and report NOT VERIFIED when unavailable.

Actions:

- convert current Phase 9 contract expectations into fast deterministic tests where useful;
- add versioned golden tasks from `.ai/QUALITY_GATES.md`;
- add provider-backed opt-in eval runner;
- persist safe comparison artifacts with behavior/model/eval versions;
- add adversarial prompt-injection/tool-policy cases.

Acceptance:

- changing prompt/model/schema can produce an old-vs-new eval report;
- critical policy failures block rollout;
- semantic quality is no longer represented by static source checks alone.

### P0.5 Verify production data topology — IN PROGRESS / DEPLOYMENT EVIDENCE BLOCKED

**Status:** repository topology is now explicit and release-gated: the implemented persistence layer is SQLite, external database URLs are not supported by the current Prisma/runtime stack, and production requires explicit single-instance durable-volume SQLite with infrastructure snapshots and a restore drill. Actual deployed hosting/volume/replica/backup evidence is still NOT VERIFIED, so this milestone is intentionally not marked complete.

Actions:

- document actual deployed database/storage topology;
- confirm concurrency, backup, restore, migration and multi-instance assumptions;
- make a deliberate decision on SQLite vs external production database based on deployment evidence.

Acceptance:

- agent/job architecture is based on verified persistence characteristics, not local-dev assumptions.

## P1 — Agentic editor parity and differentiation

### P1.1 Multi-turn in-editor Agent — IMPLEMENTED BASELINE

**Status:** request-scoped bounded Agent baseline implemented on the P1.1 branch using the versioned provider contract and central reversible command registry. Conversation state stays client-side; each server turn rebuilds tenant-scoped page/revision/command/quality context. Background jobs, agent persistence tables and direct publish remain intentionally excluded while P0.5 deployment evidence is open.

Build a bounded agent loop that understands:

- current page/template;
- selected node(s);
- current breakpoint;
- recent AI command/revision history;
- relevant quality findings.

Capabilities:

- insert/restructure/move/restyle/rewrite;
- follow-up refinement;
- inspect before changing when needed;
- diff/undo/revert to a conversation checkpoint;
- visible execution steps at merchant-appropriate granularity.

Do not permit live publish in the initial autonomous command set.

### P1.2 Brand intelligence — IMPLEMENTED BASELINE

**Status:** versioned Brand Profile v1 storage/UI + read-only Editor Agent context implemented as an additive extension of existing Brand Kits. Visual tokens and storefront rendering remain unchanged. AI-assisted owned-site extraction remains the next P1.2 sub-step after this baseline is sealed.

Create a versioned brand profile using existing VSN settings/tokens as the base.

Include:

- semantic colors;
- typography/scale;
- spacing/layout rules;
- reusable components;
- tone/voice;
- imagery/art direction;
- merchandising/CTA rules;
- do/don't constraints.

Allow AI-assisted brand extraction from an owned/authorized site, but transform into VSN rules rather than retaining copied CSS/code.

### P1.3 Server-authoritative Shopify context — P1.3a IMPLEMENTED BASELINE

**Status:** P1.3a adds an internal read-only allowlisted context registry with server-authoritative shop/page scoping, fixed Shopify GraphQL queries, bounded outputs and app-owned analytics/experiment context. P1.3b adds an optional default-off two-phase Agent flow: a strict planner may request up to four allowlisted read-only context tools, VSN executes them server-side, and the final Agent plan still uses the unchanged six-command P1.1 draft-edit allowlist.

Create bounded context/tool services for:

- products/variants;
- collections;
- files/media;
- markets/locales/translations;
- current page/template resource;
- selected app-owned analytics/experiments where authorized.

The model should request specific context through tools instead of receiving giant store dumps.

### P1.4 Reference/Figma fidelity pipeline — P1.4b GUARDED INTEGRATION IMPLEMENTED

**Status:** P1.4a defines the strict bounded reference-analysis model and deterministic semantic/structural fidelity scoring. P1.4b integrates that sealed layer into screenshot/URL AI Builder operations behind the independent default-off `VSN_FEATURE_REFERENCE_FIDELITY` flag. The enabled path performs bounded reference analysis first, supplies only normalized analysis to final page generation, aggregates both model phases into one Builder usage row, and returns non-pixel deterministic fidelity metadata. Structured/live Figma ingestion remains deferred.

Upgrade screenshot/URL/reference workflows:

- section segmentation;
- visual tokens/hierarchy extraction;
- asset mapping;
- semantic layout plan;
- native VSN command execution;
- responsive reinterpretation;
- visual + semantic fidelity scoring;
- copyright/transform-not-copy guardrails.

Figma should become a direct/structured ingestion path if a stable integration can preserve hierarchy better than screenshots.

### P1.5 AI Quality Agent — P1.5b-c GUARDED REVERSIBLE EXECUTION IMPLEMENTED

**Status:** P1.5a provides the deterministic Quality Report v1, P1.5b-a seals the proposal-only Quality Fix Plan v1 contract, and P1.5b-b adds default-off provider-backed planning. P1.5b-c now adds a second independent default-off `VSN_FEATURE_AI_QUALITY_FIX_EXECUTION` boundary for explicit merchant-approved application. The server rebuilds the current deterministic report, verifies the projected finding/code/element target, accepts only the six existing reversible Builder draft command intents, rejects client authority over page/version/target fields, executes through the typed AI command registry with its existing undo revisions and concurrency checks, then rebuilds the deterministic report again and reports whether the original finding remains. No publish/send/schedule or direct Shopify mutation authority is added.

Unify deterministic scanners behind an explainable quality surface:

- responsive;
- accessibility;
- broken bindings/links;
- Shopify validity;
- performance warnings;
- motion/reduced-motion;
- email compatibility when applicable.

The agent explains prioritized findings and can generate a reversible fix plan. Deterministic validators decide pass/fail.

### P1.6 Incremental hotspot decomposition — P1.6l STOREFRONT DESIGN TOKEN BOUNDARY IMPLEMENTED

**Status:** P1.6a–P1.6k extracted major storefront data, response, mutation, query, reusable-section, and presentation-metadata boundaries. P1.6l now extracts the shared CSS-size normalizer, global style defaults, and shop design-token merge logic from `builder-proxy.$.jsx` into `app/storefront/designTokens.js`. Existing renderer call sites continue using the same `toCssSize` behavior, while global defaults, color/font/radius/shadow/container values, breakpoint minimums, heading-scale clamps, spacing-base normalization, and `containerMd` precedence remain unchanged. The module is pure and has no DB, auth/session, network, Response, rendering, browser-global, or environment authority. P1.6 remains incremental; future slices should continue one cohesive domain at a time rather than rewriting the route.

While touching AI/storefront/editor integration, extract cohesive behavior from oversized hotspots such as `builder-proxy.$.jsx` and legacy editor mega-files.

Rules:

- extraction must have characterization/regression tests;
- no “rewrite for cleanliness” project;
- keep public behavior stable;
- prefer one domain boundary at a time.

## P2 — Unified commerce creation

### P2.1 Page + email + motion shared agent

Use one intent and brand/store context to create coordinated assets:

- landing/product/collection template draft;
- motion recipes appropriate to brand and reduced-motion policy;
- matching Email Studio draft(s);
- common offer/CTA/product facts;
- consistent localization/market context.

All assets remain independently editable canonical VSN documents.

### P2.2 AI-generated experiment variants

Connect AI alternatives to existing VSN experiments:

- agent states hypothesis;
- creates controlled variant through commands;
- validates variant;
- merchant reviews/starts experiment;
- later agent explains measured outcome without overstating causality.

### P2.3 Campaign/funnel planning

Support multi-asset goals such as launch, promotion, lead capture or product education.

Agent can plan dependencies and draft assets, but publish/send/schedule remain explicit approval steps.

### P2.4 Media generation/editing adapter

Only after provider/data-rights/cost/safety rules exist:

- product-safe background/lifestyle generation;
- resize/crop/variant generation;
- alt text and asset metadata;
- brand consistency;
- clear provenance where required.

Keep media provider integration behind a capability adapter.

## P3 — Distribution: AI wherever merchants work

### P3.1 Shopify Sidekick integration

Build Sidekick app extensions over stable internal tools:

- data tools for finding VSN resources and metrics;
- action intents to open the relevant VSN resource with context;
- safe in-app tools for approved draft operations;
- `extensions_summary` and instructions aligned with app functionality;
- Shopify latency/tool-count constraints respected.

Initial use cases should be narrow and high-confidence, e.g.:

- “Find my product-launch landing page.”
- “Open this page and create a mobile-friendly alternative hero draft.”
- “Find my recent email templates for Product X.”

Do not expose generic publish/delete tools.

### P3.2 VSN MCP / external agent API

Expose a curated command/query surface to compatible agents such as coding/design assistants.

Start read-heavy and draft-only. Add publish only with explicit scoped approval flow after abuse/security review.

Acceptance:

- project/shop-scoped token or OAuth model;
- granular capabilities;
- revocation/audit/rate/cost limits;
- stable versioned tool schemas;
- same internal policy/command layer as the VSN Agent.

## P4 — Closed-loop optimization

### P4.1 Evidence-grounded CRO assistant

Use VSN experiment/analytics data to distinguish:

- observed fact;
- hypothesis;
- heuristic recommendation.

Agent may propose and build variants, but should never label aesthetics as “proven conversion optimization.”

### P4.2 Merchant-specific preference learning

Learn only from explicit/appropriate signals such as accepted/reverted AI changes, approved brand profile updates and experiment outcomes. Avoid opaque cross-tenant learning from merchant private data.

### P4.3 Cost/quality model routing

Once sufficient eval and production telemetry exists, route tasks by measured need:

- low-latency copy/metadata;
- high-quality structural planning;
- vision/reference tasks;
- deterministic non-AI tools when no reasoning is needed.

Optimize total task success per cost/latency, not cheapest tokens.

## Deferred / watchlist

- Shopify developer-preview theme architecture changes: research and prototype behind adapters, but do not bind production storage to preview-only contracts.
- Fully autonomous live publishing/sending: intentionally deferred; safety and merchant control are product strengths.
- Broad multi-provider rollout: architecture seam now, providers only when evals show value.
- Large repository rewrite: rejected as a roadmap strategy.

## Roadmap success metrics

Track product outcomes, not only feature completion:

- successful merchant task completion;
- AI change acceptance vs immediate revert;
- time from intent to approved draft;
- schema/tool failure rate;
- safety/permission rejection correctness;
- responsive/accessibility/email quality after AI generation;
- generation cost and latency;
- publish-ready rate after review;
- experiment uplift only when statistically/operationally valid.

The end state should feel like a commerce design team embedded in the builder, while the underlying system remains deterministic where correctness matters.
