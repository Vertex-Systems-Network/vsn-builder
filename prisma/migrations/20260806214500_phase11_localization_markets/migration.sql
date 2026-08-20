-- Phase 11 — Localization & Shopify Markets
CREATE TABLE "BuilderLocalizationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "baseLocale" TEXT NOT NULL DEFAULT 'en',
    "localesJson" TEXT NOT NULL DEFAULT '[]',
    "marketsJson" TEXT NOT NULL DEFAULT '[]',
    "rtlLocalesJson" TEXT NOT NULL DEFAULT '[]',
    "shopifySyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCatalogSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderLocalizationConfig_shop_key" ON "BuilderLocalizationConfig"("shop");

CREATE TABLE "BuilderPageTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL DEFAULT '*',
    "overridesJson" TEXT NOT NULL DEFAULT '{}',
    "seoJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "nativeSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderPageTranslation_shop_pageId_locale_marketKey_key" ON "BuilderPageTranslation"("shop", "pageId", "locale", "marketKey");
CREATE INDEX "BuilderPageTranslation_shop_locale_marketKey_updatedAt_idx" ON "BuilderPageTranslation"("shop", "locale", "marketKey", "updatedAt");
CREATE INDEX "BuilderPageTranslation_shop_pageId_updatedAt_idx" ON "BuilderPageTranslation"("shop", "pageId", "updatedAt");
