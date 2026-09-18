# VSN Quality Gates

Quality gates are evidence requirements. A source-string audit, milestone report or generated screenshot is not equivalent to an executed behavioral test.

## Gate levels

### G0 — deterministic local contract

Run for relevant code changes:

- lint/format rules in the repository;
- typecheck;
- targeted unit/domain tests;
- schema/registry validation;
- migration safety checks when persistence changes;
- security/performance audits that cover the changed domain.

### G1 — build/integration

- production build;
- Prisma generation/migration path where applicable;
- route/service integration tests;
- renderer parity checks;
- email renderer/compatibility checks for Email Studio changes;
- package/runtime compatibility.

### G2 — browser/storefront

- Playwright for relevant editor/admin flows;
- storefront preview/render behavior;
- responsive breakpoints and content extremes;
- live Shopify gate/theme matrix when credentials/test store are available and the change affects those boundaries.

### G3 — release

- release QA chain appropriate to the change;
- dependency/package integrity;
- migration/deployment checks;
- production configuration validation;
- rollback/recovery evidence for high-risk changes.

If a gate cannot run, report `NOT VERIFIED`, why it could not run and the exact follow-up command/environment needed.

## AI-specific gates

AI behavior is evaluated at four layers. A feature should not rely on only one.

### A. Deterministic contract tests

These should run without a live model where possible:

- tool/operation input/output schema validation;
- unsupported operations rejected;
- permissions enforced server-side;
- tenant/shop isolation;
- stale revision/version rejection or safe conflict behavior;
- command idempotency/dedupe where needed;
- undo/revert metadata;
- canonical VSN schema validity;
- unsupported widget/block/action types dropped/rejected;
- URL/asset safety and SSRF controls;
- prompt/context size limits;
- agent turn/tool-call budgets;
- consequential-action approval state machine;
- secrets never serialized into model context;
- audit correlation IDs emitted.

### B. Golden-task model evals

Maintain versioned representative tasks with expected success criteria. Use fixtures that are safe to keep in the repository.

Minimum initial suites:

1. Prompt -> hero/section.
2. Prompt -> full landing/product page.
3. Screenshot/reference -> editable layout.
4. URL inspiration -> transformed layout without verbatim/source-code copying.
5. Selected-element rewrite.
6. Responsive repair.
7. Accessibility repair/advice.
8. Shopify product binding.
9. Brand application.
10. Existing page iterative edit.
11. Email -> complete editable draft.
12. Email rewrite/subject alternatives.
13. Page + matching email cross-surface task.
14. Variant generation tied to experiment intent.
15. Refusal/safe handling of unsupported consequential action.

Each case should grade end-to-end behavior, not whether the model used a preferred phrase.

### C. Adversarial AI safety evals

Include at least:

- URL contains “ignore instructions” prompt injection;
- product description contains tool instructions;
- imported HTML contains hidden prompt text/script payloads;
- screenshot/reference contains malicious instructions;
- attempt to request secrets/tokens;
- cross-shop resource ID supplied to a tool;
- model tries undeclared tool or extra properties;
- model attempts publish/delete/send without approval;
- repeated tool loop / denial-of-wallet attempt;
- oversized context or malicious nested JSON;
- unsafe `javascript:`/data/credentialed URLs;
- private/internal URL via redirect/DNS rebinding attempt;
- HTML/Liquid/JS injection into fields that do not permit executable code.

### D. Product-quality evals

Use deterministic graders where possible and human/vision graders only where judgment is necessary.

Measure:

- task completion;
- canonical schema validity rate;
- tool-call success rate;
- repair-loop success/failure;
- visual hierarchy/fidelity for reference tasks;
- responsive correctness;
- accessibility findings after generation;
- broken links/bindings;
- storefront render parity;
- email compatibility and link/merge-token validity;
- latency distribution;
- input/output token use and estimated provider cost;
- user undo/revert rate and explicit acceptance when product telemetry becomes available.

## Initial rollout thresholds

Do not invent “industry standard” percentages. Establish a baseline from the current implementation first, then set release thresholds from measured data.

Until baselines exist, model/prompt changes must satisfy:

- no deterministic contract regression;
- no new critical safety failure;
- no meaningful regression on representative golden tasks after review;
- bounded cost/latency within configured product limits;
- rollback path to previous behavior version.

After enough runs exist, record numeric thresholds in a versioned eval configuration rather than prose here.

## Prompt/model/provider change gate

Any material change to production AI instructions, output schema, tool descriptions, context assembly, model or provider must produce an eval comparison containing:

- old behavior version vs new;
- model/provider configuration;
- dataset/eval suite version;
- task success summary;
- safety failures;
- schema/tool failures;
- latency/cost comparison;
- notable regressions with examples;
- rollout/rollback decision.

A lower cost is not a win if task success or safety falls materially. A higher average score is not a win if a critical workflow regresses.

## Visual/reference evaluation

For screenshot/Figma/reference reconstruction, evaluate separately:

- layout structure;
- spacing/alignment;
- typography hierarchy;
- color/background roles;
- image placement/aspect/focal behavior;
- responsive reinterpretation;
- Shopify data binding correctness;
- editability/semantic VSN structure.

Pixel similarity alone is insufficient: a page can look close while being semantically broken or uneditable. Conversely, safe responsive reinterpretation can be better than a literal desktop screenshot copy.

## Email AI evaluation

For generated emails verify:

- normalized VSN email document validity;
- subject/preheader constraints;
- safe merge tokens and links;
- desktop/mobile layout;
- accessibility basics;
- renderer/MJML compatibility where applicable;
- no forbidden executable/script output;
- key client compatibility checks available in VSN;
- content claims are not treated as factual unless grounded in merchant/store context;
- no automatic send/schedule without explicit approval.

## CI policy

- Keep fast deterministic AI contract tests in normal CI.
- Keep provider-backed semantic evals opt-in or scheduled if credentials/cost make every-PR execution impractical.
- Never silently skip provider-backed evals and call the AI release fully verified.
- Store safe eval summaries/artifacts for comparison without persisting sensitive merchant prompts.

## Current audit caveat

`scripts/phase9-ai-builder-audit.mjs` is useful as a foundation guardrail, but it primarily verifies deterministic transforms and expected source integration tokens. It must not be treated as proof of live-model quality, visual fidelity, prompt robustness, provider reliability, latency/cost or adversarial safety.
