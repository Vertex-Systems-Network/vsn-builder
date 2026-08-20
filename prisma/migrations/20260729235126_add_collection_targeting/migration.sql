-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'Blank',
    "resourceId" TEXT,
    "resourceHandle" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentJson" TEXT,
    "publishedJson" TEXT,
    "shopifyPageId" TEXT,
    "shopifyPageUrl" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BuilderPage" ("contentJson", "createdAt", "handle", "id", "isDefault", "publishedAt", "publishedJson", "resourceId", "shop", "shopifyPageId", "shopifyPageUrl", "status", "template", "title", "updatedAt") SELECT "contentJson", "createdAt", "handle", "id", "isDefault", "publishedAt", "publishedJson", "resourceId", "shop", "shopifyPageId", "shopifyPageUrl", "status", "template", "title", "updatedAt" FROM "BuilderPage";
DROP TABLE "BuilderPage";
ALTER TABLE "new_BuilderPage" RENAME TO "BuilderPage";
CREATE UNIQUE INDEX "BuilderPage_shop_handle_key" ON "BuilderPage"("shop", "handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
