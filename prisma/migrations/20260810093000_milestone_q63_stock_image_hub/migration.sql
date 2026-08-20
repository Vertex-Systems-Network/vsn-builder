ALTER TABLE "BuilderShopSetting" ADD COLUMN "templatesViewJson" TEXT;

CREATE TABLE "BuilderStockSearchCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "BuilderStockSearchCache_shop_provider_cacheKey_key" ON "BuilderStockSearchCache"("shop", "provider", "cacheKey");
CREATE INDEX "BuilderStockSearchCache_shop_expiresAt_idx" ON "BuilderStockSearchCache"("shop", "expiresAt");
