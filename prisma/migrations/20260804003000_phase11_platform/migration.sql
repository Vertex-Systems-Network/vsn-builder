ALTER TABLE "BuilderPage" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BuilderPage" ADD COLUMN "publishedVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BuilderLibraryItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'section',
  "category" TEXT NOT NULL DEFAULT 'General',
  "syncMode" TEXT NOT NULL DEFAULT 'local',
  "contentJson" TEXT NOT NULL,
  "thumbnail" TEXT,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderLibraryItem_shop_kind_updatedAt_idx" ON "BuilderLibraryItem"("shop", "kind", "updatedAt");
CREATE INDEX "BuilderLibraryItem_shop_category_updatedAt_idx" ON "BuilderLibraryItem"("shop", "category", "updatedAt");

CREATE TABLE "BuilderTemplateRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "conditionsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderTemplateRule_shop_template_enabled_priority_idx" ON "BuilderTemplateRule"("shop", "template", "enabled", "priority");
CREATE INDEX "BuilderTemplateRule_shop_pageId_idx" ON "BuilderTemplateRule"("shop", "pageId");
