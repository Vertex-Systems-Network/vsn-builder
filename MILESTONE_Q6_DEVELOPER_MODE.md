# Milestone Q.6 — Templates Management Final QA (Developer Mode)

Status: complete in Developer Mode.

This milestone applies the final Pages / Templates QA contract without enabling production deployment or changing Shopify billing. The screen is DB-backed, defaults to 12 records per page, keeps List/Grid behavior aligned, and preserves existing editor/publish/collaboration protections.

Key safety boundaries:
- Existing Q5 billing handles and subscription authority are unchanged.
- Bulk publish respects page publish permission, collaboration locks, and approval workflow.
- Campaign functionality remains in the Growth/Campaign surfaces; campaign types are only removed from the Templates create list.
- Template image metadata is stored on BuilderPage and sourced from editor Template Settings.
- The Prisma migration is additive; no existing BuilderPage rows are deleted or reset.
