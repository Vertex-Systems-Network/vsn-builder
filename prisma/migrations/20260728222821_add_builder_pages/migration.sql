-- CreateTable
CREATE TABLE "BuilderPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentJson" TEXT NOT NULL,
    "publishedJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BuilderPage_shop_idx" ON "BuilderPage"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPage_shop_handle_key" ON "BuilderPage"("shop", "handle");
