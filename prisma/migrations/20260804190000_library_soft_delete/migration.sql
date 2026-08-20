ALTER TABLE "BuilderLibraryItem" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "BuilderLibraryItem_shop_deletedAt_updatedAt_idx" ON "BuilderLibraryItem"("shop", "deletedAt", "updatedAt");
