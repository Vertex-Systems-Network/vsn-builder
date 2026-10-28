# Mandatory security audit gate + non-secret QA continuity

**Why:** [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) currently affects upstream development-only `braces@3.0.3` with no patched published release. The mandatory `npm audit --include=dev --audit-level=high` must **not** be disabled or treated as a pass. Historically it stopped the single `VSN Production Confidence` job before any build, static analysis or release QA ran, concealing unrelated regressions while work continues.

## Exact security design

`.github/workflows/ci.yml` retains the **same single required `verify` job** and the exact original production, development and post-browser `npm audit --audit-level=high` commands. An individual audit can be recorded with `continue-on-error: true` **only** to allow independent local, no-credential QA steps to execute. A final `if: always()` enforcement checks the actual `steps.*.outcome` (not the cosmetically successful step conclusion) and **fails the same required `verify` job** unless all three audits passed. Missing or skipped post-browser audit is also a failure; this is **not** a warning-only check.

Real merchant / E2E steps and browser setup must be skipped whenever the initial audits are red. They require successful original audits, and the final external E2E additionally requires successful post-browser audit. Lint/report artifacts and safe internal code validation can run and provide diagnostic evidence while the release remains blocked.

The reproducible `tests/ci-audit-gate-continuity.test.mjs` is run within Production Confidence before audits and in the separate read-only Workerd compatibility workflow. It checks that the required job, three original audit commands, final fail gate, and credentialed E2E protections are present. These are guardrail tests, not sufficient release certification.

## What this explicitly does not do

- No bypass, suppressions, `--audit-level=critical`, `|| true`, omitted dev dependencies, or acceptance waiver.
- No new runner needed just to keep collecting safe QA signals.
- No cloud deployment, migration, production application installation, merchant secret access from a pull request, Shopify review submission or required status-check override.
- The audit failure remains an open **release blocker** until a genuine upstream patch or verifiably safe replacement removes the vulnerability and all mandatory tests are green.

No existing PR in the stacked branch chain should be merged to `main` solely on an isolated Workerd CI PASS.
