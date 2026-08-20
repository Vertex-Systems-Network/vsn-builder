CREATE TABLE "BuilderCustomFont" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 400,
    "style" TEXT NOT NULL DEFAULT 'normal',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderCustomFont_shop_family_weight_style_key" ON "BuilderCustomFont"("shop", "family", "weight", "style");
CREATE INDEX "BuilderCustomFont_shop_family_idx" ON "BuilderCustomFont"("shop", "family");
