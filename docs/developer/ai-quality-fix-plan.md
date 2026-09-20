# AI Quality Fix Plan

P1.5b-a adds the proposal-only contract that sits between the deterministic Quality Report and any future AI-assisted remediation flow.

## Contract

`buildQualityFixPlanInput(report)` accepts only a P1.5a report that declares both `deterministic: true` and `validatorsAuthoritative: true`. It projects at most 40 findings into compact stable IDs such as `finding-1`.

`normalizeQualityFixPlan(plan, input)` validates a proposed plan and returns an immutable Quality Fix Plan v1.

The plan is always marked:

- `proposalOnly: true`;
- `executable: false`;
- `requiresRevalidation: true`;
- `validatorsAuthoritative: true`.

A plan may contain at most 12 items.

## Finding binding

Every proposal must reference one existing projected deterministic finding. A proposal cannot target an element or email block different from the one attached to that finding.

Duplicate finding references are rejected so one model response cannot hide multiple competing changes behind the same quality issue.

The normalized result includes uncovered finding IDs. Partial coverage is therefore explicit rather than being misrepresented as a complete repair.

## Proposed command intents

Builder proposals may name only the six reversible draft-edit command intents already used by the Editor Agent:

- `element.insert`;
- `element.move`;
- `element.update-props`;
- `element.update-styles`;
- `element.rewrite`;
- `element.remove`.

`manual-review` is also available when an issue cannot safely map to one of those Builder intents, including email-only findings.

These are labels for a proposed remediation path. P1.5b-a does not accept command arguments, patches, code, URLs, HTML, styles, or text payloads for execution.

## P1.5b-b guarded provider integration

The existing authenticated `app.ai-agent` endpoint now accepts a separate `quality-plan` intent only when both AI Builder access and the independent `VSN_FEATURE_AI_QUALITY_FIX_PLAN` flag permit it. The quality-planning flag is OFF by default.

The client supplies only `pageId` and an optional bounded goal. VSN loads the tenant-scoped page server-side, rebuilds the P1.5a deterministic Quality Report, and converts it through `buildQualityFixPlanInput(report)`. Client-supplied findings or quality reports are not accepted as authority.

Only the compact finding projection is sent to the versioned `quality-fix-v1` behavior. Raw Builder node content is not placed in the quality-planning provider input. A non-clean report reserves one `quality-fix-plan` AI usage entry; a clean report short-circuits without a provider call or quota reservation.

Provider output is always normalized through `normalizeQualityFixPlan`. The response therefore remains `proposalOnly: true`, `executable: false`, `requiresRevalidation: true`, and `validatorsAuthoritative: true` regardless of provider wording.

## Safety boundary

P1.5b-b adds provider inference and AI usage telemetry, but no page write, Shopify mutation, command execution, publish, send or schedule path. The provider receives no execution authority and the quality behavior explicitly treats deterministic findings as authoritative application data.

P1.5b-c may later add explicit user-invoked reversible execution. Any execution layer must independently validate proposed actions through the existing typed command registry, create undo/checkpoint metadata, and re-run the deterministic Quality Report after changes before a result can be treated as valid.
