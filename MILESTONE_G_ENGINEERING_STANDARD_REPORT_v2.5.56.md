# VSN Milestone G — Codebase Consolidation & Engineering Standard — v2.5.56

Milestone G stabilizes engineering structure after the Phase 0–16 roadmap and Milestone F reliability pass.

## UI regression repair
- Restored the established Dashboard Plans/Pricing visual rhythm instead of extending the Phase 16 card rewrite.
- Restored Monthly / Yearly billing switching.
- Kept the Phase 16 Core / Pro / CRO / Agency entitlement model.
- Did not invent paid prices: Shopify managed billing remains authoritative.
- Preserved separate Workspace/Dashboard and Editor visual profiles.

## Code consolidation
- Extracted Builder panel route/pending-action contract from `BuilderPanelHost.jsx`.
- Extracted human-readable label/value formatting.
- Extracted browser download/file-picker helpers.
- Extracted panel action notice presentation.
- Added explicit module ownership/decomposition documentation.
- Added codebase debt ceilings so the largest legacy editor modules cannot silently grow.

## Engineering standard
- Added root `SRS.md` as the mandatory human/AI development standard.
- Added architecture, UI, error, testing, permission, migration, performance and security guidance under `docs/engineering/`.
- Added a measurable human-quality code standard rather than subjective “AI-looking code” rules.

## Cleanup
- Removed exact duplicate release/developer-mode documents from `docs/` while retaining canonical root copies still required by compatibility audits.
- No runtime, Prisma migration or Shopify scope was removed as part of cleanup.

## Developer Mode
Production billing/deployment assumptions remain disabled unless explicitly requested by the product owner.
