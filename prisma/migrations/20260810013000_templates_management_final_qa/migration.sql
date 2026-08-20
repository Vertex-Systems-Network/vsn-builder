-- Milestone Q.6 — Templates Management Final QA
-- Additive metadata used by the DB-backed Templates list/grid workspace.
ALTER TABLE "BuilderPage" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BuilderPage" ADD COLUMN "templateImage" TEXT;
ALTER TABLE "BuilderPage" ADD COLUMN "seoScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "BuilderPage" ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BuilderPage" ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'Store owner';
ALTER TABLE "BuilderPage" ADD COLUMN "scheduledAt" DATETIME;

CREATE INDEX "BuilderPage_shop_deletedAt_status_updatedAt_idx"
ON "BuilderPage"("shop", "deletedAt", "status", "updatedAt");
CREATE INDEX "BuilderPage_shop_deletedAt_template_createdAt_idx"
ON "BuilderPage"("shop", "deletedAt", "template", "createdAt");
CREATE INDEX "BuilderPage_shop_deletedAt_seoScore_createdBy_idx"
ON "BuilderPage"("shop", "deletedAt", "seoScore", "createdBy");
