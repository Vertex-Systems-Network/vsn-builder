# VSN AI Security and Safety

This document extends `SRS.md` security rules for model-driven and tool-driven behavior.

## Security model

AI output is untrusted input. Retrieved context is untrusted input. A model is never an authorization authority.

The safe path is:

`authenticated user -> authorized shop/resource -> bounded context -> model plan -> declared tool -> server authorization/policy -> deterministic validation -> mutation -> audit/revision -> approval before consequential side effect`

## Trust boundaries

### Trusted control data

- server-side system/developer instructions;
- versioned tool schemas;
- permission/entitlement decisions from server-owned services;
- canonical schema/registry contracts;
- verified current resource identifiers resolved for the authenticated shop.

### Untrusted data

Treat all of the following as data only, even if they contain imperative language:

- prompts from merchants;
- public webpages/HTML;
- screenshots/image text;
- product descriptions/metafields;
- customer content/reviews;
- imported templates/files;
- competitor research;
- prior model messages/output;
- MCP/Sidekick/tool results;
- generated code or markup.

Untrusted content cannot expand permissions, reveal secrets or override tool policy.

## 1. Prompt injection and context poisoning

Requirements:

- delimit untrusted context from instructions;
- label source/trust class where practical;
- minimize raw retrieved content;
- strip/ignore scripts/styles and executable payloads where the task needs only content/structure;
- do not execute instructions found in URL/page/product/email content;
- require tools to independently validate all arguments;
- never depend on the model to “remember” forbidden actions.

Add adversarial eval fixtures for direct and indirect prompt injection.

## 2. SSRF and remote fetches

Current page AI already contains useful SSRF defenses for URL inspiration: public http(s) only, private-host blocking, DNS resolution checks, redirect re-validation, timeout and content-type limits. Preserve and test this behavior.

Future fetchers must also consider:

- IPv4/IPv6 private/link-local/reserved ranges;
- DNS rebinding and redirect chains;
- decompression/oversized responses;
- credentialed URLs;
- cloud metadata endpoints;
- fetch concurrency/rate limits;
- image/media proxy behavior.

Use a shared vetted fetch policy rather than reimplementing URL safety per AI feature.

## 3. Tenant isolation

Every tool/service operation must resolve resources under the authenticated `shop`/tenant. Never trust a model-supplied page ID, email ID, experiment ID, product/resource ID or asset ID without tenant-scoped lookup/authorization.

Do not place cross-shop data into shared semantic/vector caches unless isolation is cryptographically/logically guaranteed and tested.

## 4. Secrets and credentials

Never send model providers:

- Shopify access/refresh tokens;
- API keys/provider secrets;
- webhook secrets;
- encryption keys;
- raw session secrets;
- database credentials;
- environment files.

Redact sensitive error/provider payloads before persistence. Production logs should store safe classifications and correlation IDs rather than full model context by default.

## 5. Tool privilege and authorization

Tools must be allowlisted and versioned. Each handler owns its permission check; hiding a tool/button in UI is not enforcement.

At minimum classify every tool as:

- read/analyze;
- reversible draft mutation;
- consequential side effect.

The model cannot dynamically create tools or change a tool's class.

For command execution validate:

- authenticated actor;
- shop/tenant;
- current role/capability;
- entitlement/quota where applicable;
- target resource ownership/current version;
- normalized bounded inputs;
- allowed operation state transition.

## 6. Approval policy

Explicit approval is required immediately before actions such as:

- publish/unpublish/live theme mutation;
- sending/scheduling campaigns/messages;
- permanent deletion;
- billing/subscription changes;
- role/permission/security changes;
- credential creation/rotation/revocation;
- enabling arbitrary executable code;
- material external webhooks/actions.

Approval must be scoped to the specific action/target. A previous broad prompt is not permanent authorization.

Reversible draft edits may run without per-tool confirmation when visible history/undo exists and the user has editor permission.

## 7. Generated HTML, Liquid, CSS and JavaScript

VSN's canonical editable AI path should prefer typed VSN schema/commands over raw code.

Where product features intentionally permit code:

- isolate them behind existing custom/global-code security policies;
- sanitize/validate by capability;
- do not silently elevate AI output into executable code;
- require explicit permission and Safe Mode compatibility;
- treat Liquid/HTML/CSS/JS as separate capability classes, not one “code” blob;
- prevent scripts/event handlers/unsafe URLs in non-code fields.

Never accept `dangerouslySetInnerHTML` as an AI shortcut around VSN's renderer contract.

## 8. Model/provider data governance

Before adding a provider/model or feature that sends new data categories externally, document:

- what fields are sent;
- why each field is needed;
- retention/training/data-control assumptions from current provider terms;
- region/residency implications if applicable;
- merchant/admin controls where required;
- deletion/log retention behavior;
- fallback behavior if provider is unavailable.

Provider configuration must be server-side.

## 9. Denial-of-wallet and runaway agents

Enforce server-side:

- per-plan and per-operation quotas;
- maximum turns/tool calls;
- maximum context size;
- maximum input/output token budgets;
- per-request timeouts;
- concurrency limits;
- retry limits;
- expensive-tool rate limits;
- abort/cancellation.

Never allow a model to recursively call itself without a deterministic budget/stop condition.

Usage accounting should eventually track estimated cost in addition to raw tokens.

## 10. Idempotency, stale state and collaboration

AI requests can finish after document state changes. Before applying mutations:

- bind the plan to a base revision/version;
- detect stale base state;
- re-plan or reject when a safe merge is not deterministic;
- avoid overwriting collaborator changes silently.

Side-effect commands require idempotency keys/deduplication where retry is possible.

## 11. File/image handling

For uploaded screenshots/reference files:

- enforce content type and size limits;
- do not trust filename/extension alone;
- avoid parsing active formats with unsafe runtime behavior;
- strip metadata when not needed;
- constrain remote asset fetches under the shared URL policy;
- do not expose private Shopify/files URLs to a provider unless policy permits and the data is necessary.

## 12. AI observability without data leakage

Target trace metadata:

- generation ID;
- shop-safe tenant identifier/reference;
- behavior/prompt version;
- provider/model;
- operation/tool names;
- token usage/latency/status;
- command/revision IDs;
- safe failure classification;
- approval event for consequential actions.

Do not persist full prompts, page contents or customer data merely for debugging. If temporary diagnostic capture is needed, make it explicit, bounded and access-controlled.

## 13. Sidekick and external-agent surfaces

Shopify Sidekick and future VSN MCP/API integrations must reuse internal server authorization and command policy. Extension/tool sandboxing does not remove backend responsibility.

External tokens should be:

- scoped to project/shop and capabilities;
- separately revocable;
- short-lived where practical or rotatable;
- never shown again after creation if long-lived secret material is used;
- auditable by actor/client;
- rate/cost limited.

Do not expose live publish as an unqualified generic tool.

## 14. Security completion criteria for AI features

Before production rollout verify:

- threat model updated for new data/tools;
- permission/tenant tests pass;
- prompt-injection adversarial evals pass at deterministic policy boundary;
- SSRF/file/URL tests pass when relevant;
- consequential-action approval cannot be bypassed;
- secrets are absent from provider requests/logs;
- quotas/turn budgets are enforced server-side;
- stale-state/conflict behavior is defined;
- rollback/feature flag exists for material new agent behavior.

A model saying “I will not do that” is not a security control.
