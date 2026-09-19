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

## QA

Run:

```bash
npm run qa:p11-agent
npm run qa:ai-evals
npm run qa:release
```

The P1.1 audit verifies command bounds, publish exclusion, server-derived sequential versions, checkpoint attribution, route security, request-scoped architecture and the continuing P0.5 persistence gate.
