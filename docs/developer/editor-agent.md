# Bounded in-editor Agent

P1.1 adds a request-scoped multi-turn Agent to the existing VSN AI Builder surface. It is intentionally built on the P0 command, provider and eval boundaries instead of introducing a parallel automation stack.

## Persistence boundary

P0.5 remains blocked on real deployment evidence, so this Agent does **not** add:

- background workers or queues;
- autonomous jobs;
- agent/session database tables;
- horizontally scaled agent consumers;
- server-persisted chat transcripts.

Conversation turns live only in the mounted editor UI and are bounded to the latest eight messages. Every server turn rebuilds authoritative context from the authenticated shop/page.

## Agent context

The server supplies a bounded context containing:

- current page id/title/template/workflow/version;
- a serialized current page snapshot;
- selected node ids that still exist on the server copy;
- current breakpoint;
- recent revision metadata;
- recent command/audit metadata;
- deterministic quality findings from the existing health scanner;
- recent client-side conversation turns;
- the executable command allowlist.

Page/revision/audit/quality content is treated as untrusted model input. Client-supplied page JSON is never execution authority for Agent commands.

## Plan contract

Behavior version: `agent-v1`.

The provider must return the strict `AI_AGENT_OUTPUT_SCHEMA`.

A turn may return:

- `ready` with at most six steps;
- `needs_input` with zero steps;
- `no_change` with zero steps.

Executable commands are limited to:

- `element.insert`;
- `element.move`;
- `element.update-props`;
- `element.update-styles`;
- `element.rewrite`;
- `element.remove`.

`page.publish` is not part of the Agent schema or allowlist. The central command registry still classifies publish as consequential, non-direct and explicit-route only.

## Execution

Each planned step is executed through `executeAiCommand`.

The server, not the model/client, supplies the current `baseVersion` for each step. Therefore every edit inherits:

- shop scoping;
- page permission checks;
- runtime entitlements;
- collaboration role/lock checks;
- stale-version protection;
- command-bus transactions/audit logging;
- pre-change undo revision;
- applied revision;
- draft workflow downgrade when required.

Direct text/patch commands reject executable/template syntax. Builder system nodes such as `global-styles` and `template-settings` cannot be mutated or used as placement anchors.

If a later step fails, execution stops. Already-applied steps remain auditable and the first pre-change undo revision is returned as the turn checkpoint.

## Undo

The UI exposes **Undo last Agent turn** when a checkpoint exists.

Undo calls the authenticated Agent route with the checkpoint revision id. The route executes `revision.restore` through the same command registry. Revision restore is itself version-checked, tenant/page scoped and revision-backed.

## Editor consistency

Agent execution modifies the server draft immediately. The editor therefore:

1. blocks Agent execution while local unsaved changes exist;
2. syncs the returned authoritative page content into the canvas;
3. marks the synced result as server-saved;
4. keeps the local Agent conversation in component memory.

This prevents the Agent from overwriting an unsaved local canvas.

## Quota/provider policy

The Agent uses the shared provider adapter and `reserveAiUsage` with operation `agent`. It inherits:

- configured provider/model;
- timeout/retry policy;
- behavior-version attribution;
- monthly AI quota;
- provider token/latency telemetry.

No provider credentials or transport live in the Agent service.

## Server-authoritative context phase

P1.3b adds an optional two-phase context-aware Agent path behind the independent default-off `VSN_FEATURE_AI_AGENT_CONTEXT_TOOLS` flag.

When the flag is disabled, the original `agent-v1` single-provider-call path remains unchanged.

When enabled, the Agent uses `agent-v2`:

1. the first provider phase receives the normal bounded authoritative page/brand/quality context and may request up to four allowlisted P1.3a read-only context tools;
2. VSN normalizes every requested tool/input through the sealed P1.3a registry;
3. the server executes the bounded context batch using the authenticated shop and canonical current Builder page;
4. normalized context results are appended to the second provider phase as explicitly untrusted data;
5. the second provider phase must return the existing strict Agent edit-plan schema;
6. edit execution still uses the same six reversible P1.1 draft commands and the same sequential server-derived `baseVersion` checks.

Context data never becomes command authority. The model cannot supply GraphQL documents, page scope, Shopify credentials, or write operations.

The browser receives only context-tool metadata (`tool` + success/failure), not raw Shopify context payloads.

Planner and final-plan token usage is aggregated into the same `BuilderAiUsage` row for that Agent turn. A context lookup failure degrades to generic bounded metadata; raw exceptions and secrets are not reflected into the final provider phase.

The context-aware path does not add persistence tables, background jobs, publish permissions, Shopify mutations, or additional Agent commands.

### Context-aware configuration

```bash
VSN_FEATURE_AI_AGENT_CONTEXT_TOOLS=false
VSN_AI_AGENT_CONTEXT_BEHAVIOR_VERSION=agent-v2
```

## QA

Run:

```bash
npm run qa:p11-agent
npm run qa:p13b-agent-context
npm run qa:ai-evals
npm run qa:release
```

The P1.1 audit verifies command bounds, publish exclusion, server-derived sequential versions, checkpoint attribution, route security, request-scoped architecture and the continuing P0.5 persistence gate.
