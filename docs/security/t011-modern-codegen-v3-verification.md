# T011 Codegen v3 experiment — verified result (2026-10-15)

Branch: `security/t011-codegen-v3-compat-experiment`, draft PR #182, pinned workflow #38637886924.

## Actual evidence

| Check | Observed result |
| --- | --- |
| Install `@shopify/api-codegen-preset@3.0.0` | Pass on disposable GitHub runner |
| Locked `npm ci` | Pass |
| Actual `npm run graphql-codegen` | Pass: Shopify project operation types generate |
| `npm audit --include=dev --audit-level=high` | **Fail: 24 high advisories** |
| Typecheck and application build after audit | Skipped by mandatory gate |
| Merge, deployment, Shopify submission | **None** |

GraphQL codegen functionality can be restored with this version, but that would reintroduce the unpatched development advisory chain. The audit reports vulnerable `@shopify/graphql-codegen` / `@graphql-codegen/*` transitive dependencies and no compatible fix for at least part of the graph. Therefore **do not import this experimental npm lockfile into PR #181, do not waive audit policy, and do not mark T011 complete**.

## Required safe next steps

1. Verify upstream patches for the specific transitive advisories, including whether the latest Shopify codegen preset ships a non-vulnerable dependency graph. Capture exact advisory versions, not a speculative override.
2. If upstream lacks fixes, design and test a maintained replacement for Shopify GraphQL type generation, preserving `.graphqlrc.js` project behavior and generated type quality, rather than silently removing the developer workflow.
3. Re-run actual generation, `npm ci`, full and production audit, typecheck, build, and all required CI on the same exact commit.
4. Real Shopify merchant billing/OAuth/plan-change E2E on Staging remains separate and unverified. Production and App Store submission remain locked.

Pass on functional generation **does not override** failure of the development dependency security audit.
