-- CreateTable
CREATE TABLE "BuilderRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'save',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderRevision_shop_pageId_createdAt_idx" ON "BuilderRevision"("shop", "pageId", "createdAt");

CREATE TABLE "BuilderAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT,
    "actor" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderAuditLog_shop_createdAt_idx" ON "BuilderAuditLog"("shop", "createdAt");

CREATE TABLE "BuilderShopSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "designTokensJson" TEXT,
    "onboardingJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderShopSetting_shop_key" ON "BuilderShopSetting"("shop");

CREATE TABLE "BuilderDiagnosticEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "pageId" TEXT,
    "status" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderDiagnosticEvent_shop_createdAt_idx" ON "BuilderDiagnosticEvent"("shop", "createdAt");
