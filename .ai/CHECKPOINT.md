# VSN Engineering Checkpoint

**Date:** 2026-08-26  
**Checkpoint status:** PARTIALLY VERIFIED AUDIT / AI-NATIVE PLAN CREATED / IMPLEMENTATION PAUSED BY OWNER  
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

## Automated evidence after the documentation branch was pushed

GitHub Actions started `VSN Production Confidence` for draft PR #1 / commit `0a9f9e364dcec206ed556863c52c0978d47e5fd1` and the workflow completed with `failure`.

The job-log endpoint did not return usable logs during this audit, so the exact failing step is **not verified**. Do not attribute this specific run to the Node mismatch without step/log evidence. The Node 20 vs 22.18+ conflict remains independently proven from repository source/configuration.

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

## `.ai/` operating system

Files now planned/present on the documentation branch:

- `.ai/README.md`
- `.ai/MASTER_ENGINEERING_PROMPT.md`
- `.ai/WORK_STATE.md`
- `.ai/RESUME_PROTOCOL.md`
- `.ai/PROJECT_CONTEXT.md`
- `.ai/AI_NATIVE_ARCHITECTURE.md`
- `.ai/MARKET_BENCHMARKS.md`
- `.ai/QUALITY_GATES.md`
- `.ai/SECURITY_AND_SAFETY.md`
- `.ai/ROADMAP.md`
- `.ai/CHECKPOINT.md`

The design intentionally makes `SRS.md` higher authority than `.ai/` to avoid creating a competing architecture source.

`WORK_STATE.md` is the live execution cursor. It uses a write-ahead `in_flight_step` plus `last_verified_step`/`next_exact_action` so a later AI can determine where work stopped from repository evidence rather than conversation memory.

`RESUME_PROTOCOL.md` defines the mandatory recovery algorithm: inspect Git/PR/source/tests, verify any in-flight operation, reconcile stale state silently, and continue from the earliest unverified step without asking the owner for a recap when repository evidence is sufficient.

## Current owner instruction

No further product/runtime development is authorized in this work unit. Only the `.ai/` planning/continuity documentation is being changed.

The live cursor therefore remains `paused_by_owner`. When the owner later explicitly asks to resume/start development, the next AI should not ask where to begin; it should read `.ai/WORK_STATE.md`, reconcile current repository/PR state, and execute its recorded `next_exact_action` subject to normal safety/approval boundaries.

## Not verified in this audit

- No local checkout/build/test execution was performed through the GitHub connector.
- The PR GitHub Actions run failed, but the exact failing step/log was unavailable and remains unverified.
- No live OpenAI generation was executed.
- No live Shopify test-store publish/install/billing flow was executed.
- No container build was executed.
- Production hosting/database topology was not inspected; SQLite production suitability remains an explicit verification task, not a conclusion.
- Full codebase security review was not performed; reviewed AI/security paths are only part of the application.
- Visual output quality was not benchmarked against competitors on identical inputs.

## Next safest actions when development is resumed

1. Reconcile whether draft PR #1 has merged and inspect current `main` head.
2. Create a fresh code branch from current `main` for the P0 Node CI/Docker alignment; do not mix production implementation into the documentation-only branch.
3. Run executable install/runtime/build/CI-relevant gates and record exact evidence.
4. Establish AI behavior/provider abstraction and telemetry versioning without changing merchant-visible behavior.
5. Define a small typed AI command registry around existing command-bus/history primitives.
6. Build deterministic + provider-backed eval harness before introducing broad agent autonomy.
7. Add multi-turn in-editor agent behind a feature flag, initially restricted to reversible draft commands.
8. Only after tool contracts stabilize, implement Sidekick and external MCP/API adapters.

## Handoff rule

On resume, do not trust conversational memory over repository evidence and do not ask the owner to reconstruct prior development if `.ai/WORK_STATE.md`, Git history, PR state, source and tests provide enough information. Verify the recorded cursor, recover any in-flight operation safely, and continue from the earliest unverified step.