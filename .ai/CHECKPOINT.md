# VSN Engineering Checkpoint

**Date:** 2026-09-18  
**Checkpoint status:** SECURITY/RUNTIME BASELINE VERIFIED / AI-NATIVE PLAN RECONCILED / DOCUMENTATION READY  
**Base reviewed:** `main` @ `5edbece879d5eca0650fe34b96b07447ad6b5739`  
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

## Resolved release-path finding

### P0.1 — Node runtime/release alignment completed

The previous Node 20 vs Node 22.18+ release-path drift has been fixed and validated on `main`:

- `package.json` requires `>=22.18 <23`;
- `.nvmrc` and `.node-version` use Node 22;
- GitHub Actions is pinned to Node `22.18.0`;
- production Docker uses the maintained `node:22-alpine3.24` line;
- the blocking security audit enforces this runtime version matrix.

The security remediation stack (#8, #10 and #11) was merged to `main`. Post-merge `VSN Production Confidence` run #385 / `35350490530` completed successfully, including production/development dependency audits, security/egress audits, Prisma, lint, typecheck, build, release QA, protected Phase-1 QA, performance and external Playwright E2E.

P0.1 is therefore a maintained baseline, not an outstanding implementation task.

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

## Current work-unit instruction

This PR remains documentation-only. The runtime/security implementation it previously identified has already landed independently on `main`; do not duplicate that production work in this branch.

The AI-native operating system is reconciled against the verified security-hardened `main` baseline so it can land without stale execution instructions.

## Not verified in this audit

- No local checkout/build/test execution was performed through the GitHub connector.
- The historical draft-PR CI failure is superseded by the later security/runtime remediation and successful post-merge `main` run #385; it is no longer a current blocker.
- No live OpenAI generation was executed.
- No live Shopify test-store publish/install/billing flow was executed.
- No container build was executed.
- Production hosting/database topology was not inspected; SQLite production suitability remains an explicit verification task, not a conclusion.
- Full codebase security review was not performed; reviewed AI/security paths are only part of the application.
- Visual output quality was not benchmarked against competitors on identical inputs.

## Next safest actions after this operating-system documentation lands

1. Start new implementation work from current `main`, never from this historical documentation branch.
2. Proceed to P0.2: introduce AI provider/behavior versioning while preserving current merchant-visible behavior.
3. Define the first small typed AI-capable command registry around existing command-bus/history primitives.
4. Build deterministic + provider-backed eval harness before broad agent autonomy.
5. Add multi-turn in-editor agent only behind a feature flag and initially restrict it to reversible draft commands.
6. Implement Sidekick/external MCP adapters only after internal tool contracts and policy gates stabilize.
7. Keep P0.1 runtime-version matrix and Production Confidence checks green as a permanent release baseline.

## Handoff rule

On resume, do not trust conversational memory over repository evidence and do not ask the owner to reconstruct prior development if `.ai/WORK_STATE.md`, Git history, PR state, source and tests provide enough information. Verify the recorded cursor, recover any in-flight operation safely, and continue from the earliest unverified step.