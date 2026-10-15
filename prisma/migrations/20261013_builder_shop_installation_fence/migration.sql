-- Durable Shopify install generation, Local SQLite only.
-- No merchant data is deleted or modified by this forward migration.
CREATE TABLE "BuilderShopInstallation" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "installedAt" DATETIME NOT NULL,
    "uninstalledAt" DATETIME,
    "lastUninstallWebhookId" TEXT,
    "updatedAt" DATETIME NOT NULL
);
