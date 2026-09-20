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

## Safety boundary

This slice has no provider call, route, database access, Shopify access, command execution, persistence, publish, send or schedule behavior.

P1.5b-b may add a default-off provider-backed explanation/planning service that emits this exact bounded schema. P1.5b-c may later add explicit user-invoked reversible execution. Any execution layer must independently validate commands through the existing typed command registry and re-run the deterministic Quality Report after changes.
