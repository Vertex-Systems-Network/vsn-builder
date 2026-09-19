# AI evaluation harness

VSN separates deterministic AI safety/contracts from provider-backed semantic quality. Passing source-string audits alone is not considered evidence of model quality.

## Versions

Initial dataset: `vsn-ai-eval-v1`  
Eval version: `1.0.0`  
Artifact schema: `1`

Versioned inputs live under `.ai/evals/v1/`.

## Deterministic release gate

Run:

`npm run qa:p04`

This executes the harness self-audit and deterministic adversarial suite without provider credentials. The initial release threshold is deliberately strict:

- 100% deterministic pass rate
- zero critical safety failures

The deterministic suite covers schema rejection, executable URLs/content, prompt-injection boundaries, secret redaction, unsupported provider failure, bounded provider policy, undeclared commands, cross-shop IDs, stale versions, unsafe patches and direct consequential-action denial.

A safe result artifact is written to `artifacts/ai-evals/deterministic-v1.json` and uploaded by Production Confidence. Generated eval artifacts are ignored by git.

## Provider-backed semantic evals

Provider-backed evals are **not** silently treated as passing when they do not run. They require explicit opt-in:

`VSN_AI_EVALS=1 OPENAI_API_KEY=... npm run qa:ai-evals:provider -- --label baseline --page-behavior page-v1 --email-behavior email-v1 --out artifacts/ai-evals/baseline.json`

If opt-in, credentials or registered behavior versions are missing, the command writes a safe `NOT_VERIFIED` artifact and exits with code 2.

The v1 provider dataset contains the 15 initial golden tasks defined by `.ai/QUALITY_GATES.md`, including page generation, reference/URL workflows, rewrites, responsive/accessibility tasks, Shopify/brand context, iterative edits, Email Studio tasks, cross-surface work, experiment alternatives and a consequential-action request.

Provider runs call the production Page AI and Email AI services. Artifacts contain case IDs, pass/fail dimensions, provider/model/behavior versions, token counts, latency, input hashes and optional estimated cost. They do **not** contain raw prompts, raw model output, merchant context, credentials or secrets.

Optional cost estimation uses:

- `VSN_AI_EVAL_INPUT_USD_PER_M`
- `VSN_AI_EVAL_OUTPUT_USD_PER_M`

If rates are not configured, token usage is still recorded and cost is explicitly `NOT_CONFIGURED`.

## Old-vs-new comparison

Run two provider evals against registered behavior/model configurations, then compare:

`npm run qa:ai-evals:compare -- artifacts/ai-evals/baseline.json artifacts/ai-evals/candidate.json artifacts/ai-evals/comparison.json`

Comparison validates that both artifacts use the same eval dataset/version and reports:

- pass/failure delta
- safety/schema failure delta
- token delta
- average latency delta
- optional estimated-cost delta
- per-case regressions and improvements
- mechanical decision: `block`, `review-required`, `eligible-for-review`, or `not-verified`

A new safety/schema failure blocks. Other regressions require review; the report does not substitute for product judgment on semantic/visual quality.

## Artifact policy

Safe artifacts may be retained in CI for comparison. Never add raw merchant prompts, extracted private store data, screenshots, provider response text, access tokens or API credentials to eval artifacts.

Provider-backed evaluation remains opt-in because it incurs external cost and needs credentials. A release that did not run it must be described as provider semantic quality **NOT VERIFIED**, not as fully model-verified.
