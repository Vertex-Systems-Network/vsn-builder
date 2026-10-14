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

## Recorded experimental results (2026-10-14)
- Trial workflow [38619632216](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38619632216) **passed** reproducible clean install, full and production npm security audits (**0 vulnerabilities each**), typecheck, build, app security audit and core QA.
- The follow-up [38619969873](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38619969873) completed **successfully** and committed the regenerated lockfile to *this isolated experiment branch*, commit `31467f64f62e375c2ef27f8c515235f56f885e5a`.
- Lockfile package nodes reduced to 638; neither `braces` nor GraphQL codegen dependencies are present in the experiment install.
- Explicit compatibility gap: `.graphqlrc.js` imports `@shopify/api-codegen-preset`. Existing `graphql-codegen` npm script was removed in this experiment. **DO NOT MERGE** without preserving/replacing this developer workflow, or explicit accepted decision to retire it, plus required normal CI.
- Bot-generated commit checks are `action_required`, not successful CI. This note intentionally triggers an authenticated standard PR-head CI check on the now-synchronized package lockfile.
