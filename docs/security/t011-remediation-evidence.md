# T011 dependency security — verification evidence (2026-10-14)

Scope: VSN | Builder, PR #179. This is an evidence record, not production certification.

## Applied on isolated branch

- Regenerated npm lockfile and passed `npm ci` twice on GitHub Actions Node 22.
- Updated effective locked packages: `proxy-addr@2.0.8`, `brace-expansion@2.1.7`, `compression@1.8.2`, `morgan@1.12.1`, `source-map-js@1.2.2`.
- [Remediation run 38615850735](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38615850735) finished successfully; its final `npm audit --omit=dev --audit-level=high` reported **0 vulnerabilities**.
- Artifact `t011-postfix-audit` (ID 11919347373) independently reports production 0 critical/high/moderate/low advisories.
- All-dependency audit in that same artifact still reports **24 high-severity advisories**, chiefly a `@shopify/api-codegen-preset` / `@shopify/graphql-codegen` / `graphql-config` / GraphQL codegen & tools dependency graph, plus glob/micromatch. Several report no compatible npm audit fix; do not hide or suppress them.

## Blockers

- GitHub runs 38616403174 and 38616403356 for the automation-generated commit were `action_required` with no jobs. Their presence does not establish full CI success.
- Re-run exact-head Production Confidence with authenticated actor, review full dev audit, codebase security audit, Prisma generate/migrate, typecheck, build, release QA, Playwright and platform checks. Resolve any remaining required-check failures.
- Keep PR draft/unmerged and Staging/Production/Shopify review locked until mandatory acceptance gates actually pass. **Do not weaken any CI audit threshold.**
