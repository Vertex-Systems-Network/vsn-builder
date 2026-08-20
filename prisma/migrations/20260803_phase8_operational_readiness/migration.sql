-- VSN Phase 8: operational readiness tables.
-- IF NOT EXISTS keeps this migration safe for stores that used prisma db push during development.
CREATE TABLE IF NOT EXISTS "BuilderRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'save',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BuilderRevision_shop_pageId_createdAt_idx" ON "BuilderRevision"("shop", "pageId", "createdAt");

CREATE TABLE IF NOT EXISTS "BuilderAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT,
    "actor" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BuilderAuditLog_shop_createdAt_idx" ON "BuilderAuditLog"("shop", "createdAt");

CREATE TABLE IF NOT EXISTS "BuilderShopSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "designTokensJson" TEXT,
    "onboardingJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "BuilderShopSetting_shop_key" ON "BuilderShopSetting"("shop");

CREATE TABLE IF NOT EXISTS "BuilderDiagnosticEvent" (
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
CREATE INDEX IF NOT EXISTS "BuilderDiagnosticEvent_shop_createdAt_idx" ON "BuilderDiagnosticEvent"("shop", "createdAt");

CREATE TABLE IF NOT EXISTS "BuilderRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER,
    "durationMs" INTEGER,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BuilderRequestLog_requestId_key" ON "BuilderRequestLog"("requestId");
CREATE INDEX IF NOT EXISTS "BuilderRequestLog_shop_createdAt_idx" ON "BuilderRequestLog"("shop", "createdAt");
CREATE INDEX IF NOT EXISTS "BuilderRequestLog_route_createdAt_idx" ON "BuilderRequestLog"("route", "createdAt");

CREATE TABLE IF NOT EXISTS "BuilderCleanupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "statsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BuilderCleanupRun_shop_createdAt_idx" ON "BuilderCleanupRun"("shop", "createdAt");
