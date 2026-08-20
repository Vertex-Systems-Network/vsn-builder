# VSN Architecture Guardrails — Milestone A / Phase 0

Stable baseline: **v2.5.36**.

1. Experimental systems ship behind central feature flags and default OFF.
2. Saved builder content is migrated only through `app/builder/schemaMigrations.js`; ad-hoc schema rewrites are not allowed.
3. Existing content must remain readable. New schema versions require an explicit forward migration and must preserve unknown keys.
4. Canvas, Preview and Storefront styling must continue to use the shared style pipeline. Renderer-specific copies of the CSS serializer are prohibited.
5. Widget registry, capability matrix and style profiles remain the authoritative control contracts.
6. Release packages must contain Prisma schema/migrations, packaged SQLite baseline (when present), Shopify config, Theme App Extension renderer assets, and all QA scripts.
7. Feature flags OFF must preserve the previous stable behaviour.
8. Large UI/renderer rewrites require a dedicated regression audit before becoming default.
