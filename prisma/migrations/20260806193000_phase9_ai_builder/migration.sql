CREATE TABLE "BuilderAiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "responseId" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderAiUsage_shop_createdAt_idx" ON "BuilderAiUsage"("shop", "createdAt");
CREATE INDEX "BuilderAiUsage_shop_status_createdAt_idx" ON "BuilderAiUsage"("shop", "status", "createdAt");
