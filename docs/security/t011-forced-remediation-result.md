# T011 Codegen forced-remediation result — 2026-10-15

GitHub Actions run: https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38643182012

| Experiment | GraphQL generation | Full npm audit | Outcome |
| --- | --- | --- | --- |
| Shopify preset v3 unchanged | Passed | 24 high advisories | Rejected |
| Shopify preset v3 + isolated `npm audit fix --force` | Not rerun after failed gate | 24 high advisories | Rejected |

The remediation runner successfully completed package installation, `npm audit fix --package-lock-only --ignore-scripts --force` trial, and evidence capture, but **mandatory full audit failed**. npm reported `No fix available for @shopify/api-codegen-preset@*`. Evidence artifacts: 11931123045 (modern trial) and 11930748363 (forced remediation).

Do not integrate the vulnerable candidate dependencies, mark codegen compatible, or bypass the full audit.

## Next eligible technical path

Retain the audited production/CI dependency tree on PR #181. Investigate replacing generation with a narrow, security-audited workflow using existing `graphql` capabilities or a dedicated external codegen process with separately assessed dependencies and strong isolation; generated type shape/Shopify schema compatibility must be tested. Requirements: preserve GraphQL document discovery, Shopify Admin API schema version, generated operation typings, and extension documents. **No workflow retirement without approval.** Acceptance requires actual output tests, full audit 0 high, clean npm ci, typecheck, build, QA and Shopify Staging E2E.
