-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "template" TEXT NOT NULL DEFAULT 'Blank',
    "views" INTEGER NOT NULL DEFAULT 0,
    "contentJson" TEXT NOT NULL,
    "publishedJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BuilderPage" ("contentJson", "createdAt", "handle", "id", "publishedJson", "shop", "status", "title", "updatedAt") SELECT "contentJson", "createdAt", "handle", "id", "publishedJson", "shop", "status", "title", "updatedAt" FROM "BuilderPage";
DROP TABLE "BuilderPage";
ALTER TABLE "new_BuilderPage" RENAME TO "BuilderPage";
CREATE INDEX "BuilderPage_shop_idx" ON "BuilderPage"("shop");
CREATE UNIQUE INDEX "BuilderPage_shop_handle_key" ON "BuilderPage"("shop", "handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
