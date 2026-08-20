-- Milestone N.1 — Email Builder Foundation
CREATE TABLE "BuilderEmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Custom',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "documentJson" TEXT NOT NULL,
    "compiledHtml" TEXT NOT NULL,
    "plainText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
CREATE INDEX "BuilderEmailTemplate_shop_deletedAt_updatedAt_idx" ON "BuilderEmailTemplate"("shop", "deletedAt", "updatedAt");
CREATE INDEX "BuilderEmailTemplate_shop_category_status_idx" ON "BuilderEmailTemplate"("shop", "category", "status");
