CREATE TABLE "BuilderStockApiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" INTEGER,
    "providerLimit" TEXT,
    "providerRemaining" TEXT,
    "providerReset" TEXT,
    "lastEndpoint" TEXT,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderStockApiUsage_shop_provider_mediaKind_key" ON "BuilderStockApiUsage"("shop", "provider", "mediaKind");
CREATE INDEX "BuilderStockApiUsage_shop_updatedAt_idx" ON "BuilderStockApiUsage"("shop", "updatedAt");

CREATE TABLE "BuilderStockSearchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderStockSearchHistory_shop_mediaKind_fingerprint_key" ON "BuilderStockSearchHistory"("shop", "mediaKind", "fingerprint");
CREATE INDEX "BuilderStockSearchHistory_shop_mediaKind_lastUsedAt_idx" ON "BuilderStockSearchHistory"("shop", "mediaKind", "lastUsedAt");
