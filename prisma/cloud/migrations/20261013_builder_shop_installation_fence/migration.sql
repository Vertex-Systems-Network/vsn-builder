-- Durable Shopify install generation, separate hosted PostgreSQL.
-- NOT applied to any Neon environment. Never use without staging review.
CREATE TABLE "BuilderShopInstallation" (
    "shop" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "uninstalledAt" TIMESTAMP(3),
    "lastUninstallWebhookId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderShopInstallation_pkey" PRIMARY KEY ("shop")
);
