ALTER TABLE "BuilderLibraryItem" ADD COLUMN "templateType" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "BuilderLibraryItem_shop_templateType_updatedAt_idx" ON "BuilderLibraryItem"("shop", "templateType", "updatedAt");
CREATE INDEX "BuilderLibraryItem_shop_isFavorite_updatedAt_idx" ON "BuilderLibraryItem"("shop", "isFavorite", "updatedAt");
