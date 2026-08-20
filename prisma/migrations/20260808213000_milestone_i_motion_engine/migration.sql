ALTER TABLE "BuilderShopSetting" ADD COLUMN "appSettingsJson" TEXT;

CREATE TABLE "BuilderMotionPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "timelineJson" TEXT NOT NULL,
    "tokensJson" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "BuilderMotionPreset_shop_deletedAt_updatedAt_idx" ON "BuilderMotionPreset"("shop", "deletedAt", "updatedAt");
CREATE INDEX "BuilderMotionPreset_shop_category_idx" ON "BuilderMotionPreset"("shop", "category");
