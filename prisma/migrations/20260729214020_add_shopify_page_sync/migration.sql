/*
  Warnings:

  - You are about to drop the column `template` on the `BuilderPage` table. All the data in the column will be lost.
  - You are about to drop the column `views` on the `BuilderPage` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentJson" TEXT,
    "publishedJson" TEXT,
    "shopifyPageId" TEXT,
    "shopifyPageUrl" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BuilderPage" ("contentJson", "createdAt", "handle", "id", "publishedJson", "shop", "status", "title", "updatedAt") SELECT "contentJson", "createdAt", "handle", "id", "publishedJson", "shop", "status", "title", "updatedAt" FROM "BuilderPage";
DROP TABLE "BuilderPage";
ALTER TABLE "new_BuilderPage" RENAME TO "BuilderPage";
CREATE UNIQUE INDEX "BuilderPage_shop_handle_key" ON "BuilderPage"("shop", "handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
