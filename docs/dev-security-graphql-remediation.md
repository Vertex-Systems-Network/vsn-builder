# GraphQL tools CVE-2026-104852 targeted remediation

Dev tooling includes real Shopify GraphQL codegen via `.graphqlrc.js`, `@shopify/api-codegen-preset` and `graphql-config`; it must not be removed simply to greenwash dependency audits.

The baseline 2026-10-13 lockfile included multiple transitive `@graphql-tools/utils@11.2.2` and `10.11.0` packages. GitHub-reviewed advisory GHSA-7mx3-vvmw-hjmv lists versions below 12.0.1 as vulnerable to prototype pollution. The experiment pins `@graphql-tools/utils: 12.0.4` and regenerates the **whole npm lockfile reproducibly**, then verifies every instance is at least 12.0.1, imports the real Shopify GraphQL project config, runs existing P11 GraphQL source checks, typecheck, prod audit and actual React Router build.

This is a version-major override and may be incompatible; if a test fails, it must be repaired or the experiment abandoned rather than merging. **Full `npm audit --include=dev --audit-level=high` remains mandatory in Production Confidence.** The independent `braces <=3.0.3` CVE-2026-93687 has no published patched version as of 2026-10-13, so targeted GraphQL remediation alone cannot be called release-ready. The one-time write-enabled lockfile workflow is removed immediately after certification. No hosted/cloud deployment or Merchant shop operations.

## Verified targeted GraphQL patch result — 2026-10-13

[One-time lockfile CI #38332610536](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38332610536) succeeded. The regenerated pinned package lock contains **one** `@graphql-tools/utils` copy at `12.0.4`, eliminating the previously 10.x and 11.x vulnerable nested copies; `npm ci`, real Shopify GraphQL codegen config loading, existing P11 GraphQL source audit, typecheck, production npm audit and app build passed. The one-time write-enabled workflow was deleted afterwards; replacement certification has GitHub read-only permissions. Full dev `npm audit --include=dev --audit-level=high` continues to fail until all remaining advisories including unpatched `braces` are resolved. This change must not be called a full release security pass.

## Defense in depth: extension glob input

`.graphqlrc.js` now accepts extension project directories only when their names match a bounded ASCII-safe Shopify extension identifier (letters/numbers/hyphen/underscore, maximum 80 chars), are actual directories rather than symlinks and contain `schema.graphql`. This prevents extension filenames with braces, wildcard syntax or nested glob meta-characters from being injected into GraphQL Codegen document patterns. A temporary-filesystem regression fixture verifies ordinary extension scanning still works and rejects malicious names and symlinks. This is input hardening **not a patch for the `braces` package**; canonical full dev npm audit still fails on advisory GHSA-vfj7-8cjw-p6xm. No permissions or audit gate softened.

## End-to-end code generator regression

The read-only GraphQL security CI now runs the actual installed `graphql-codegen` binary on a temporary local `schema.graphql`, a synthetic query and a TypeScript plugin, then validates the emitted TypeScript types. This exercises GraphQL Tools loaders and plugin compatibility after forcing `@graphql-tools/utils@12.0.4` without a networked Shopify schema or merchant credentials. It complements—not replaces—the Shopify-specific configuration import smoke check.
