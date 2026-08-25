# VSN AI-Native Architecture

## Goal

Make AI a first-class operating layer over VSN's existing visual commerce capabilities without making the model the source of truth.

The product should let a merchant express an outcome in natural language and have VSN plan, build, inspect, revise and prepare the result across page/template, email and motion workflows while preserving editable schemas, permissions, undo/revisions and explicit approval for consequential actions.

## Architecture principle

**Models decide what should be attempted. Deterministic VSN code decides what is allowed and how state changes.**

```text
Merchant intent / Sidekick / MCP / in-editor chat
                    |
                    v
          AI Request Orchestrator
                    |
      +-------------+-------------+
      |                           |
      v                           v
Context Builder               Model Policy
(shop/brand/page/            provider/model/
product/selection)           latency/cost tier)
      |                           |
      +-------------+-------------+
                    v
                  Planner
                    |
             Typed tool plan
                    |
                    v
       Authorization + Policy Engine
                    |
                    v
        VSN Command / Tool Registry
                    |
         deterministic execution
                    |
     +--------------+---------------+
     |              |               |
     v              v               v
 Page/schema     Email schema    Motion/schema
 commands        commands        commands
     |              |               |
     +--------------+---------------+
                    v
     Validators / renderers / scanners
                    |
       diff + preview + quality result
                    |
        approval if consequential
                    |
                    v
      revision / publish / side effect
                    |
                    v
     trace + metrics + eval feedback
```

## 1. Canonical data remains VSN-owned

AI must target existing canonical representations:

- builder page/widget tree and schema migrations;
- email document/block schema;
- motion/interaction schema;
- components, bindings, queries, style/responsive contracts;
- experiments/campaigns and existing persisted domain models.

Do not persist a provider-specific “AI page” format. A model plan is transient execution intent, not the merchant's document.

## 2. Typed command/tool layer

Evolve the existing `app/services/command-bus.server.js` and editor history primitives into one reusable catalog of narrowly scoped operations.

Initial operation families should include concepts such as:

- `document.inspect`
- `node.insert`
- `node.updateContent`
- `node.updateStyle`
- `node.move`
- `node.duplicate`
- `node.deleteToTrash`
- `selection.restructure`
- `binding.connectShopifyResource`
- `brand.applyTokens`
- `responsive.setOverride`
- `motion.applyRecipe`
- `email.block.insert`
- `email.block.update`
- `variant.create`
- `quality.scan`
- `preview.render`
- `revision.create`
- `publish.prepare`

Names are illustrative until mapped to existing domain APIs. Do not add public tools merely to match this list.

Each tool contract must define:

- stable name/version;
- input schema and size limits;
- required permission/capability;
- read vs draft mutation vs consequential side-effect class;
- deterministic validation;
- idempotency/dedupe behavior where relevant;
- output schema;
- undo/revert metadata where practical;
- audit/log classification;
- timeout/error behavior.

The model must never call Prisma or Shopify Admin APIs directly. Tool implementations route through domain services.

## 3. Orchestrator and planner

Replace one-shot “prompt -> complete document” as the only path with an orchestrator capable of bounded multi-step work.

A request should produce a plan containing goals, assumptions, planned tool calls and acceptance checks. The orchestrator then executes only allowed tools, inspects results and may perform a bounded repair pass.

Guardrails:

- hard maximum turns/tool calls;
- hard token/context budgets;
- cancellation/abort support;
- no recursive uncontrolled agent spawning;
- deterministic stop conditions;
- stale-document/version detection before mutation;
- optimistic conflict handling for collaboration;
- explicit classification before a consequential tool can run.

Simple tasks should stay simple. A copy rewrite should not invoke an expensive autonomous loop when one structured call is sufficient.

## 4. Context builder

Build task-specific context instead of dumping store/page state into prompts.

Context sources can include:

- current document summary and selected nodes;
- canonical brand/design tokens and brand guidance;
- current breakpoint and viewport;
- server-authoritative Shopify product/collection data;
- merchant-selected reference assets;
- relevant reusable components/templates;
- quality scanner findings;
- experiment/performance insights when authorized;
- email campaign metadata where applicable.

Every context item should have origin, trust class, tenant/shop scope and size limit. Treat retrieved text as data, never system instructions.

Long-term product advantage should come from **better commerce context**, not larger raw prompts.

## 5. Brand intelligence

A durable brand system should be more than colors/fonts. Target a versioned `BrandProfile` concept backed by existing design-token/settings infrastructure where possible:

- palette and semantic color roles;
- type scale and typography rules;
- spacing/radius/layout tendencies;
- component patterns;
- tone/voice;
- image/art direction;
- merchandising rules;
- preferred CTA language;
- forbidden patterns and compliance notes;
- exemplar VSN sections/components.

AI must apply brand constraints through canonical VSN tokens/properties rather than copying arbitrary CSS from reference websites.

## 6. Provider/model policy

Current OpenAI integration should move behind an internal provider interface.

The product-facing contract should describe capabilities, not vendor model names:

- structured reasoning/generation;
- vision/reference analysis;
- low-latency rewrite;
- high-quality layout planning;
- optional image generation/editing adapter;
- embeddings/retrieval if later justified.

A model policy selects an approved provider/model based on operation, quality tier, latency budget, cost budget, data policy and availability.

Requirements:

- provider/model IDs live in configuration/policy, not scattered feature code;
- prompt/behavior version is recorded with every generation;
- provider failure does not silently downgrade to an unsafe or incompatible path;
- fallback behavior is explicit and eval-tested;
- model upgrades require eval comparison and rollback capability.

Multi-provider support is an architectural seam, not a requirement to pay for multiple providers immediately.

## 7. Prompt/behavior registry

Move production instructions out of ad-hoc service string builders over time.

A behavior definition should include:

- stable behavior ID;
- version;
- task purpose;
- system/developer instructions;
- output/tool contracts;
- context policy;
- model policy hint;
- eval suite IDs;
- rollout status/feature flag.

Do not expose secret implementation prompts to the browser. Version changes that can change merchant outcomes should be reviewable in Git.

## 8. Validation and self-repair

After generation/mutation, use deterministic VSN checks before showing success:

- canonical schema/registry validation;
- responsive checks;
- accessibility checks;
- link/URL policy;
- Shopify binding validity;
- component/query integrity;
- storefront renderer compatibility;
- motion/reduced-motion checks;
- email schema/client/merge-token checks where relevant;
- performance budgets for large generated structures.

The agent may receive structured findings and attempt a bounded repair. The validator, not the model, decides whether a contract passes.

## 9. Diff, history and collaboration

Every AI change should be understandable as a set of VSN commands and a resulting document diff.

Target UX:

- show what AI changed;
- identify added/removed/moved/restyled/bound nodes;
- allow undo/revert;
- support “revert to this point in conversation” through real revision IDs, not only chat history;
- detect stale base revision before applying delayed AI results;
- avoid overwriting collaborator work silently.

Correlate `generationId -> plan -> commandIds -> revisionId -> optional publishId`.

## 10. Consequential action policy

Split tools into three broad classes:

1. **Read/analyze** — can run automatically within authorization.
2. **Reversible draft mutation** — can run automatically in an editor session with visible history/undo.
3. **Consequential external/live action** — requires explicit immediate approval.

Class 3 includes live publish/unpublish, campaign send/schedule, permanent delete, billing/permissions/security changes and material external side effects.

The model cannot reclassify its own tool.

## 11. Shopify Sidekick adapter

Shopify opened Sidekick app extensions to app developers in June 2026. VSN should expose a curated subset of the same internal safe commands rather than create a separate Sidekick-specific business layer.

Target split:

- data extension: search/list VSN pages/templates/emails/experiments and safe metrics;
- action intents: navigate the merchant to the relevant VSN resource/action context;
- Tools API handlers: bind narrowly scoped in-app read/draft tools where Shopify's current contract supports them;
- merchant confirmation remains the boundary for consequential changes.

Keep the Sidekick surface below Shopify's tool/count/latency limits and aligned with the app's public functionality.

## 12. External AI / MCP surface

Current competitors expose projects to external AI clients. A future VSN MCP/API surface can be a strong distribution channel, but it must reuse the same command registry and authorization model.

Design before exposing:

- project/shop-scoped tokens or OAuth;
- granular capabilities;
- token rotation/revocation;
- rate/cost limits;
- audit trail;
- read vs mutate vs publish scopes;
- approval model for publish;
- stable tool schemas;
- versioning/deprecation policy.

Do not expose internal Prisma models as an MCP contract.

## 13. Cross-surface commerce agent

The long-term differentiator is one agent that understands a merchant objective across VSN surfaces.

Example goal: “Launch a premium summer sale for Product X.”

A mature VSN agent could, with approvals:

1. inspect product/brand/context;
2. propose campaign angle and page structure;
3. build an editable landing/product template;
4. generate motion appropriate to the brand/reduced-motion policy;
5. create matching email draft(s);
6. create variants tied to VSN experiments;
7. run accessibility/responsive/performance/email QA;
8. present diffs, predictions/risks and preview links;
9. request approval before publishing/sending.

This is more defensible than producing a visually impressive first page only.

## 14. Analytics-informed improvement

Do not let AI claim “conversion optimized” from aesthetics alone.

Where VSN has sufficient authorized experiment/analytics evidence, the agent may:

- explain observed performance;
- identify hypotheses;
- create a variant tied to an experiment;
- measure real outcomes;
- learn merchant-specific preferences from approved/evaluated outcomes.

Recommendations must distinguish evidence from heuristic opinion.

## 15. Rollout sequence

Do not attempt the full agent in one rewrite.

1. Fix release/runtime drift and establish evidence-based gates.
2. Introduce provider/behavior version seams and richer AI trace metadata.
3. Define typed AI-capable commands around existing command infrastructure.
4. Build eval harness and adversarial tool-policy tests.
5. Add multi-turn in-editor orchestration behind a feature flag.
6. Add brand/store context service and iterative edits.
7. Add Sidekick integration and external agent surface only after internal tool contracts are stable.
8. Extend to unified page/email/motion/experiment workflows.

Every stage must leave existing one-shot AI behavior recoverable until its replacement proves better through evals and merchant-facing testing.
