ALTER TABLE "BuilderLibraryItem" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "industry" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "style" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "planTier" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "colorTags" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "layoutTags" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "description" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "qualityScore" INTEGER;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "compatibilityJson" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "screenshotJson" TEXT;
ALTER TABLE "BuilderLibraryItem" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'local';
CREATE INDEX "BuilderLibraryItem_shop_sourceKey_idx" ON "BuilderLibraryItem"("shop", "sourceKey");
CREATE INDEX "BuilderLibraryItem_shop_industry_style_idx" ON "BuilderLibraryItem"("shop", "industry", "style");
CREATE INDEX "BuilderLibraryItem_shop_planTier_updatedAt_idx" ON "BuilderLibraryItem"("shop", "planTier", "updatedAt");

CREATE TABLE "BuilderBrandKit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "colorsJson" TEXT NOT NULL DEFAULT '{}',
  "typographyJson" TEXT NOT NULL DEFAULT '{}',
  "spacingJson" TEXT NOT NULL DEFAULT '{}',
  "radiusJson" TEXT NOT NULL DEFAULT '{}',
  "shadowsJson" TEXT NOT NULL DEFAULT '{}',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME
);
CREATE INDEX "BuilderBrandKit_shop_deletedAt_updatedAt_idx" ON "BuilderBrandKit"("shop", "deletedAt", "updatedAt");
CREATE INDEX "BuilderBrandKit_shop_isDefault_idx" ON "BuilderBrandKit"("shop", "isDefault");

CREATE TABLE "BuilderMarketplaceFavorite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "catalogId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderMarketplaceFavorite_shop_catalogId_key" ON "BuilderMarketplaceFavorite"("shop", "catalogId");
CREATE INDEX "BuilderMarketplaceFavorite_shop_createdAt_idx" ON "BuilderMarketplaceFavorite"("shop", "createdAt");

CREATE TABLE "BuilderMarketplaceInstall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "catalogId" TEXT NOT NULL,
  "catalogVersion" INTEGER NOT NULL DEFAULT 1,
  "libraryItemId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'builtin',
  "rollbackJson" TEXT,
  "assetManifestJson" TEXT NOT NULL DEFAULT '[]',
  "contentHash" TEXT,
  "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderMarketplaceInstall_shop_catalogId_key" ON "BuilderMarketplaceInstall"("shop", "catalogId");
CREATE INDEX "BuilderMarketplaceInstall_shop_installedAt_idx" ON "BuilderMarketplaceInstall"("shop", "installedAt");
CREATE INDEX "BuilderMarketplaceInstall_shop_libraryItemId_idx" ON "BuilderMarketplaceInstall"("shop", "libraryItemId");
