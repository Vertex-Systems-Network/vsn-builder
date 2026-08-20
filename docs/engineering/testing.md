# Testing and Regression Standard

A change touching shared editor/runtime code must run the current milestone audit plus all affected phase audits. Cross-cutting changes additionally run package integrity, security and performance checks.

Static audit scripts are guardrails, not substitutes for live Shopify E2E. When live/dependency-backed execution cannot run, state that limitation explicitly.

Visual/UI regressions should be checked against the immediately previous accepted baseline. Functional milestones must not silently replace established layouts.
