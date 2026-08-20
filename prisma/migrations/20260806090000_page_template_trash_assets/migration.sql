ALTER TABLE "BuilderPage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "BuilderPage" ADD COLUMN "trashedAssetsJson" TEXT;
CREATE INDEX "BuilderPage_shop_deletedAt_updatedAt_idx" ON "BuilderPage"("shop", "deletedAt", "updatedAt");
