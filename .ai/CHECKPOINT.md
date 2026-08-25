# VSN Engineering Checkpoint

**Date:** 2026-08-26  
**Checkpoint status:** PARTIALLY VERIFIED AUDIT / AI-NATIVE PLAN CREATED  
**Base reviewed:** `main` @ `90653d9cf6f1dcf489ef45ee21d38625db7aeb38`  
**Working branch:** `docs/ai-native-operating-system`

## Completed and verified by repository inspection

- Reviewed root repository structure, package/runtime commands, SRS, CI workflow, Docker runtime, Shopify config, Prisma schema, current AI page service/route/normalization, Email AI service, AI audit script, server command bus, editor command/history primitive, storefront proxy integration hotspot and current motion plan.
- Confirmed current page AI uses structured JSON output and converts it into canonical editable VSN nodes rather than arbitrary HTML injection.
- Confirmed current page URL inspiration path includes meaningful SSRF controls.
- Confirmed current AI route is authenticated and server-role gated.
- Confirmed AI usage/quota telemetry exists through `BuilderAiUsage` and commercial entitlements.
- Confirmed Email AI produces structured VSN email blocks and does not use raw generated HTML/CSS/JS/Liquid as its normal output path.
- Confirmed existing server command-bus and editor history primitives can be evolved into AI-capable typed commands.
- Confirmed `extensions/` contains the current VSN theme extension but no reviewed Sidekick data/action extension.
- Reviewed current official Shopify Sidekick/Tools/theme-block documentation and current AI capabilities documented by Replo, Instant, GemPages and Klaviyo.

## Critical finding

### P0 — Node runtime policy drift

Repository runtime policy and `package.json` engine/preinstall path require Node 22.18+ LTS, but:

- `.github/workflows/ci.yml` sets Node `20.19.0`;
- `Dockerfile` uses `node:20-alpine`.

Because installation runs the runtime compatibility guard, these release paths are inconsistent by construction. Fix and execute them before treating current CI/container production confidence as trustworthy.

## High-priority AI findings

### Strengths to preserve

- canonical editable VSN IR instead of AI-owned raw HTML;
- strict structured output contract;
- unsupported widget filtering/validation;
- authenticated server route and entitlements;
- SSRF-aware URL inspiration;
- responsive/accessibility scanners;
- AI usage telemetry;
- canonical Email Studio document generation;
- existing command/audit/history primitives;
- broad product surface already exists: builder + email + motion + experiments + SDK.

### Gaps between “AI-assisted” and “AI-native”

- current provider/model integration is directly coupled to OpenAI service calls;
- page and email AI duplicate provider-call patterns;
- current workflows are primarily one-shot operations, not a bounded multi-turn typed-tool agent;
- no reviewed versioned production prompt/behavior registry;
- no reviewed model/provider routing policy abstraction;
- no first-class golden-task semantic/model eval framework;
- current AI audit is largely deterministic/static and cannot prove live model quality/fidelity/cost/latency;
- AI telemetry lacks behavior version/provider/command-revision correlation/eval score/estimated cost fields;
- no reviewed Sidekick extension;
- no reviewed external MCP/agent surface;
- brand/store context is passed into generation, but not yet a clearly centralized server-authoritative context/tool system.

## Market bar verified on 2026-08-26

- Shopify Sidekick app extensions are available to app developers and expose app data/actions/tools with merchant-control patterns.
- Shopify itself supports AI-generated theme blocks in compatible theme architectures.
- Replo documents conversation + screenshot/ad/URL page generation with brand library and product references.
- Instant documents an in-editor multi-turn Agent using page/selection/screen context with Undo/Revert, persistent AI brand kit and MCP beta.
- GemPages documents AI Image-to-Layout plus an MCP beta for ecommerce research and HTML -> validated editable GemPages pages.
- Klaviyo Composer documents goal-driven campaign/flow/segment drafting and QA, with review/approval required before live use.

Conclusion: prompt/screenshot/URL generation is table stakes. VSN differentiation must come from canonical cross-surface tools, deeper Shopify/brand context, reversible agent workflows, quality evidence and safe distribution through VSN/Sidekick/external agents.

## `.ai/` operating system created in this work unit

Planned files:

- `.ai/README.md`
- `.ai/MASTER_ENGINEERING_PROMPT.md`
- `.ai/PROJECT_CONTEXT.md`
- `.ai/AI_NATIVE_ARCHITECTURE.md`
- `.ai/MARKET_BENCHMARKS.md`
- `.ai/QUALITY_GATES.md`
- `.ai/SECURITY_AND_SAFETY.md`
- `.ai/ROADMAP.md`
- `.ai/CHECKPOINT.md`

The design intentionally makes `SRS.md` higher authority than `.ai/` to avoid creating a competing architecture source.

## Not verified in this audit

- No local checkout/build/test execution was performed through the GitHub connector.
- Current GitHub Actions run status was not used as proof of success.
- No live OpenAI generation was executed.
- No live Shopify test-store publish/install/billing flow was executed.
- No container build was executed.
- Production hosting/database topology was not inspected; SQLite production suitability remains an explicit verification task, not a conclusion.
- Full codebase security review was not performed; reviewed AI/security paths are only part of the application.
- Visual output quality was not benchmarked against competitors on identical inputs.

## Next safest actions

1. Land/review the `.ai/` operating system as documentation only.
2. Create a separate code PR for P0 Node CI/Docker alignment and run executable gates.
3. Establish AI behavior/provider abstraction and telemetry versioning without changing merchant-visible behavior.
4. Define a small typed AI command registry around existing command-bus/history primitives.
5. Build deterministic + provider-backed eval harness before introducing broad agent autonomy.
6. Add multi-turn in-editor agent behind a feature flag, initially restricted to reversible draft commands.
7. Only after tool contracts stabilize, implement Sidekick and external MCP/API adapters.

## Handoff rule

On resume, verify the branch/PR state and re-read current source before implementing. Do not assume this checkpoint proves any unexecuted test or production state.
