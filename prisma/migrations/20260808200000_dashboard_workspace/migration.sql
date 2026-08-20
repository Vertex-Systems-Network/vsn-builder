-- Post-roadmap dashboard workspace preferences and lightweight storefront visitor sessions.
ALTER TABLE "BuilderShopSetting" ADD COLUMN "dashboardJson" TEXT;

CREATE TABLE "BuilderVisitorSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "country" TEXT,
  "lastPath" TEXT,
  "pageViews" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderVisitorSession_shop_sessionId_key" ON "BuilderVisitorSession"("shop", "sessionId");
CREATE INDEX "BuilderVisitorSession_shop_lastSeenAt_idx" ON "BuilderVisitorSession"("shop", "lastSeenAt");
CREATE INDEX "BuilderVisitorSession_shop_country_lastSeenAt_idx" ON "BuilderVisitorSession"("shop", "country", "lastSeenAt");
