# AI provider and behavior policy

VSN AI uses a product-level provider contract. Page AI and Email AI do not call vendor endpoints directly.

## Runtime policy

Default provider: `openai`  
Default model: `gpt-5-mini`  
Default request timeout: 45 seconds  
Default retries: 0  
Fallback provider: none

Optional retries are bounded to 0–2 and apply only to transient network failures or retryable HTTP statuses. There is no silent cross-provider fallback.

Environment controls:

- `VSN_AI_PROVIDER`
- `VSN_AI_MODEL`
- `VSN_AI_TIMEOUT_MS`
- `VSN_AI_MAX_RETRIES`
- `VSN_AI_PAGE_BEHAVIOR_VERSION`
- `VSN_AI_EMAIL_BEHAVIOR_VERSION`

Only registered providers and behavior versions are accepted. Unknown values fail closed.

## Behavior versions

Production instructions live in `app/ai/behaviors.js`. Page and Email behavior definitions are versioned independently so a prompt/instruction change can be attributed, evaluated and rolled back without changing the provider adapter.

Initial stable versions:

- Page AI: `page-v1`
- Email AI: `email-v1`

## Telemetry

Every AI generation records, where metering is available:

- VSN generation ID
- provider
- model
- behavior version
- provider response ID
- input/output tokens
- duration
- operation/status

The VSN generation ID is stable across configured retries for the same logical generation.

## Change policy

A provider/model/behavior/schema change must satisfy the AI gates in `.ai/QUALITY_GATES.md`. Provider-backed evals may remain opt-in, but deterministic contract checks are release-blocking.

Live publish, send, delete, billing or other consequential operations are outside this provider contract and require their own explicit approval paths.
