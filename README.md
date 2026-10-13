# VSN | Builder

VSN Builder is a Shopify page-builder application. This repository is being separated into **Local/Development**, **Staging**, and **Production/Live** environments with independent Shopify identities, databases, billing modes and Cloudflare Workers.

> **Deployment warning (13 Oct 2026):** The hosted Worker integration is **not functional or released**. The current engineering work is on **unmerged stacked PRs**, not the default branch. Staging/Live Workers are placeholders. **Do not point merchant traffic at them or submit the Shopify app for review.**

## Environment identity and promotion

| Tier | User-facing name | Code source | Storage | Worker | Verification |
| --- | --- | --- | --- | --- | --- |
| Local/Dev | VSN \| Builder (Development) | `development` | isolated SQLite | Shopify CLI Local | Dev identity and real merchant install **not certified** |
| Staging | VSN \| Builder (Staging) | accepted `development` SHA | isolated Neon PostgreSQL | `vsn-builder-staging` | placeholder only; no hosted schema |
| Production | VSN \| Builder | reviewed `main` SHA | different Neon PostgreSQL | `vsn-builder-production` | placeholder only; no release |

Development and Staging UI should display **Dev** / **Staging** environment badges; the requested display-version badge is **v1.0.0**. The internal package version is tracked separately.

## Evidence-based status dashboard

*Progress bars below measure only the **explicit checks named here**, not percentage of app features completed.*

| Workstream | Progress | Current result |
| --- | --- | --- |
| Local Workerd compatibility checks¹ | `[███████] 7/7` | CI-only **PASS** on unmerged [PR #127](https://github.com/Vertex-Systems-Network/vsn-builder/pull/127) |
| Local/Dev real merchant readiness² | `[░░░░] 0/4` | **Not certified** |
| Hosted Staging readiness³ | `[░░░░░░] 0/6` | **Not deployed** |
| Hosted Production readiness³ | `[░░░░░░] 0/6` | **Not deployed** |
| Mandatory full security audit | `[░] 0/1` | **BLOCKED** by dev-only `braces` advisory, [#96](https://github.com/Vertex-Systems-Network/vsn-builder/issues/96) |

¹ Seven passing CI-only capability classes: generated Worker Prisma, Neon endpoint isolation, Worker Shopify SDK, merchant CSP Web Streams SSR, signed webhook verification, tenant-scoped uninstall session revocation, and restricted HTTP Workerd routes. These use synthetic input and never establish real Shopify/Neon connectivity. [Exact code-head Workerd CI evidence](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490935).

² Requires independently verified Dev Shopify app identity, fresh merchant install/auth, SQLite persistence tests and test-billing acceptance.

³ Six per-tier operational gates: exact tier Shopify identity, verified hosted secrets/runtime, real reviewed PostgreSQL migration + restore, functioning Worker request routing, signed merchant session/installation acceptance, and protected billing/release/rollback smoke verification. Production also requires verified Staging promotion. None are certified merely because cloud resources exist.

### CI checkpoints

- [PR #127 real local Cloudflare Workerd CI #38387490935](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490935): **PASS** before this README-only commit. Signed Shopify uninstall + tenant-only in-memory session cleanup and tamper/replay regression tested. No hosted credentials, migration or Shopify release.
- [PR #127 Production Confidence #38387490929](https://github.com/Vertex-Systems-Network/vsn-builder/actions/runs/38387490929): required overall job **FAILS at mandatory dependency audit enforcement**; production dependency audit, static security checks, typecheck, application build, internal release QA and performance checks all passed on that previous code head. The post-browser audit is not accepted as passed or bypassed.
- Upstream `braces <=3.0.3` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no fixed published version as verified on 13 Oct 2026. No audit waiver or severity downgrade is active.

### Connected infrastructure (read-only, 13 Oct 2026)

Separate Neon Staging and Production projects each contain a default `neondb` database with **zero application tables** at inspection time. Two separate Builder Cloudflare Worker names exist as non-operational placeholders without public merchant traffic. Neither hosted database has been migrated by this work.

### Next verified release prerequisites

1. Resolve the development dependency security advisory **without bypassing the audit**; keep mandatory release CI red meanwhile.
2. Implement and review the real hosted React Router Worker entry + service/asset ports, with isolated Staging bindings; never use the CI-only Workerd Worker in hosted production.
3. Certify offline schema/migration/rollback, then apply **Staging-only** reviewed migration through protected approval and validate actual DB health.
4. Validate signed real merchant installation/session persistence, editor, billing and webhook delivery on Staging.
5. Promote only an exact source SHA accepted by all required gates; do not deploy Live or submit for Shopify review without full runtime evidence.

See [environment details](docs/three-environments.md), [verified uninstall limitations](docs/workerd-verified-uninstall-session-revoke.md), and [mandatory audit continuity](docs/mandatory-audit-qa-continuity.md).
