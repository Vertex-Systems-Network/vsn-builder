# Neon single-branch policy and QA schema cleanup evidence

Date: 2026-10-16, project `vsn-builder-staging` (`shiny-violet-61219572`).

## Required invariant

- Exactly **one active Neon branch per project** (Staging and Production have separate Neon projects, not multiple branches).
- Staging retained default: `br-square-mountain-b3ij6q2s`, current human name `production` (the **project** is Staging). No default switch or schema migration performed.
- Production project retained default: `br-odd-credit-b3rzlpz9`; it is outside the Staging cleanup.
- Extra QA branch: `br-blue-flower-b3kiqk5n`, 52 public tables, **0 rows in every table** by an exact `count(*)` on 2026-10-16 (not a statistics estimate).
- Extra old recovery branch: `br-wandering-queen-b3mmztjy`, 0 public app tables.
- Existing manual snapshot: `snap-green-bar-b3m1btfb`, historically sourced from the recovery branch; snapshots are read-only backup resources, **not active database branches**. The snapshot itself is not deleted by this change.
- QA branch had no merchant/store/session rows. Historical schema source and reproducible DDL are already checked into `prisma/cloud/schema.prisma` and `prisma/cloud/migrations/`. Retaining QA as a live branch is not necessary to reproduce its empty tables.
- Single-branch preflight fails on any additional Neon branch, wrong project/default, missing pinned snapshot, incorrect pooled compute, unprotected GitHub source or wrong tier. No SQL DDL or production change is authorized by this report.

## Independently queried empty QA tables

- `BuilderAiUsage`: 0 rows
- `BuilderAuditLog`: 0 rows
- `BuilderAutomationLog`: 0 rows
- `BuilderBackup`: 0 rows
- `BuilderBranch`: 0 rows
- `BuilderBrandKit`: 0 rows
- `BuilderCleanupRun`: 0 rows
- `BuilderComment`: 0 rows
- `BuilderCustomFont`: 0 rows
- `BuilderCustomWidget`: 0 rows
- `BuilderDiagnosticEvent`: 0 rows
- `BuilderEmailTemplate`: 0 rows
- `BuilderExperiment`: 0 rows
- `BuilderExperimentAssignment`: 0 rows
- `BuilderExperimentEvent`: 0 rows
- `BuilderExperimentVariant`: 0 rows
- `BuilderFormConfig`: 0 rows
- `BuilderFormSubmission`: 0 rows
- `BuilderFormUpload`: 0 rows
- `BuilderGlobalCode`: 0 rows
- `BuilderGlobalCodeRevision`: 0 rows
- `BuilderGraphqlHistory`: 0 rows
- `BuilderGraphqlSavedQuery`: 0 rows
- `BuilderIntegration`: 0 rows
- `BuilderLibraryItem`: 0 rows
- `BuilderLocalizationConfig`: 0 rows
- `BuilderMarketplaceFavorite`: 0 rows
- `BuilderMarketplaceInstall`: 0 rows
- `BuilderMotionPreset`: 0 rows
- `BuilderNotification`: 0 rows
- `BuilderPage`: 0 rows
- `BuilderPageLock`: 0 rows
- `BuilderPageTranslation`: 0 rows
- `BuilderPresence`: 0 rows
- `BuilderRequestLog`: 0 rows
- `BuilderReviewLink`: 0 rows
- `BuilderRevision`: 0 rows
- `BuilderShopInstallation`: 0 rows
- `BuilderShopSetting`: 0 rows
- `BuilderStockApiUsage`: 0 rows
- `BuilderStockSearchCache`: 0 rows
- `BuilderStockSearchHistory`: 0 rows
- `BuilderSubscription`: 0 rows
- `BuilderSupportMessage`: 0 rows
- `BuilderSupportTicket`: 0 rows
- `BuilderSvgAsset`: 0 rows
- `BuilderTemplateRule`: 0 rows
- `BuilderVisitorSession`: 0 rows
- `BuilderWebhookEndpoint`: 0 rows
- `BuilderWidgetTemplate`: 0 rows
- `BuilderWishlist`: 0 rows
- `Session`: 0 rows

**Evidence boundary:** counts and table identities were read directly from the Neon connector; this is not a full downloadable SQL dump. The pre-existing snapshot originates from the historical recovery root and is **not** a post-migration default-primary backup. Before any default-primary migration, verify the actual restore plan and a fresh primary backup under the Neon Free one-manual-snapshot limit. GitHub `development` branch protection and isolated scoped Staging secrets remain separate blockers.
