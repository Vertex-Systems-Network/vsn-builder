# T011 GraphQL code generation dependency-isolation experiment
This is an **unmerged experimental branch**, not an approved production dependency policy.

## Hypothesis
Postfix `npm audit --include=dev` reported 24 high-severity advisories, all on the GraphQL code-generator/tooling graph, including unpatched `braces` GHSA-vfj7-8cjw-p6xm. The installed root development dependencies `@shopify/api-codegen-preset` and `graphql-config` appear to introduce that graph. Remove these two optional development dependencies and the `graphql-codegen` npm command **on this isolated test branch only** to test whether they are required to ship or develop the app.

## Acceptance
1. Review the CI `codegen-usage.txt` scan for any runtime, build, QA or developer tooling still requiring these dependencies.
2. Require `npm ci`, full-development `npm audit --include=dev --audit-level=high`, production `npm audit --omit=dev --audit-level=high`, typecheck, build, security audit and QA to pass.
3. If developer GraphQL generation is required, **restore it with an independently verified secure replacement**, rather than remove an active capability silently.
4. Download the generated lockfile artifact and commit it with the package change before running the normal Production Confidence workflow on the exact PR head SHA.
5. Do not merge while any mandatory gate fails. No Staging, Live, or Shopify App Store actions in this experiment.

Risk: Disables the `graphql-codegen` npm script while testing. It cannot be considered a permanent removal without checking that no workflow or developer relies on it.
