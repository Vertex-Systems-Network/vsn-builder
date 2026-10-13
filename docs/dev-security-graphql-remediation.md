# GraphQL tools CVE-2026-104852 targeted remediation

Dev tooling includes real Shopify GraphQL codegen via `.graphqlrc.js`, `@shopify/api-codegen-preset` and `graphql-config`; it must not be removed simply to greenwash dependency audits.

The baseline 2026-10-13 lockfile included multiple transitive `@graphql-tools/utils@11.2.2` and `10.11.0` packages. GitHub-reviewed advisory GHSA-7mx3-vvmw-hjmv lists versions below 12.0.1 as vulnerable to prototype pollution. The experiment pins `@graphql-tools/utils: 12.0.4` and regenerates the **whole npm lockfile reproducibly**, then verifies every instance is at least 12.0.1, imports the real Shopify GraphQL project config, runs existing P11 GraphQL source checks, typecheck, prod audit and actual React Router build.

This is a version-major override and may be incompatible; if a test fails, it must be repaired or the experiment abandoned rather than merging. **Full `npm audit --include=dev --audit-level=high` remains mandatory in Production Confidence.** The independent `braces <=3.0.3` CVE-2026-93687 has no published patched version as of 2026-10-13, so targeted GraphQL remediation alone cannot be called release-ready. The one-time write-enabled lockfile workflow is removed immediately after certification. No hosted/cloud deployment or Merchant shop operations.
