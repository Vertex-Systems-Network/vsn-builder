# VSN Builder v2.5.95 — Milestone Q.5.3 Entitlement Engine 2.0

## Scope
Q5.3 replaces fragmented commercial plan checks with one server-side entitlement contract built on the verified Shopify subscription authority introduced in Q5.2.

## Central contract
`app/config/entitlements.js` defines named features and quotas. `app/services/entitlements.server.js` resolves the authoritative plan, computes stable usage, returns feature/quota/minimum-plan decisions, and produces a redacted entitlement snapshot for UI consumption.

## Production authority
Production paid access requires a fresh/trusted `shopify-app-pricing` mirror in an active, trialing, or canceling lifecycle. `VSN_DEFAULT_PLAN` is deliberately ignored in production. Missing, untrusted, canceled, frozen, or over-stale authority fails closed to Core.

## Enforced systems
- Pages/templates quota
- Marketplace tier and install quota
- Monthly AI generation quota
- CRO feature and active-experiment quota
- Collaboration availability and persisted seat quota
- Backup/restore
- Global Library writes
- Developer SDK
- Enterprise controls
- Builder collaboration/localization runtime capability state
- Email Marketplace minimum-plan decisions

## Stable usage semantics
Collaboration quota counts the store owner plus persisted role assignments; transient presence is not billable usage. AI uses a UTC monthly window and exposes the next reset boundary.

## Compatibility
`app/utils/plan.server.js` remains a compatibility facade so earlier callers can consume legacy plan-usage shapes while authority lives in Entitlement Engine 2.0.

## Database
No Prisma migration. Q5.3 reuses the Q5.2 verified subscription mirror schema.

## Security
Plan return query parameters and server environment defaults cannot grant production paid access. Mutation routes perform server-side entitlement decisions in addition to role/permission checks.

## Final QA
- Q5.3 Entitlement Engine audit: 50/50 PASS
- Q5.2 subscription sync regression: 42/42 PASS
- Q5.1 App Pricing regression: 41/41 PASS
- Phase 16 commercialization regression: 69/69 PASS
- Full `npm run qa:release`: EXIT 0 (temporary global TypeScript link used because release ZIP intentionally excludes `node_modules`)
- Parser QA: 304 JS/JSX files, 0 blocking syntax errors
- Capability coverage: 112/112
- Codebase health: 0 failures / 0 warnings
- Package integrity: PASS
- Production runtime configuration smoke: PASS
- Production Shopify TOML generation smoke: PASS
- `prisma/dev.sqlite` SHA-256 unchanged from v2.5.94: `437185d6e6d2df6f4caf778ee3d49e9609d590ba2efbd10c6e79d63983a2ba6a`

The standalone `npm run migration:check` command was not marked PASS in the dependency-free extracted release tree because `@prisma/client` is not bundled. Database/migration history audits in the full release chain passed; run the standalone migration command after normal `npm ci`/dependency installation in the target environment.
