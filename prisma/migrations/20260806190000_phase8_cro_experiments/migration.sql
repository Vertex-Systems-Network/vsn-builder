CREATE TABLE "BuilderExperiment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "targetType" TEXT NOT NULL DEFAULT 'page',
  "pageId" TEXT NOT NULL,
  "targetNodeId" TEXT,
  "goalType" TEXT NOT NULL DEFAULT 'purchase',
  "goalValue" TEXT,
  "trafficPercent" INTEGER NOT NULL DEFAULT 100,
  "minimumSessions" INTEGER NOT NULL DEFAULT 200,
  "confidenceThreshold" REAL NOT NULL DEFAULT 0.95,
  "winnerVariantId" TEXT,
  "startedAt" DATETIME,
  "endedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderExperiment_shop_status_updatedAt_idx" ON "BuilderExperiment"("shop", "status", "updatedAt");
CREATE INDEX "BuilderExperiment_shop_pageId_status_idx" ON "BuilderExperiment"("shop", "pageId", "status");

CREATE TABLE "BuilderExperimentVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "experimentId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 50,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  "sourcePageId" TEXT,
  "sourceNodeId" TEXT,
  "snapshotJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BuilderExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "BuilderExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BuilderExperimentVariant_experimentId_key_key" ON "BuilderExperimentVariant"("experimentId", "key");
CREATE INDEX "BuilderExperimentVariant_experimentId_createdAt_idx" ON "BuilderExperimentVariant"("experimentId", "createdAt");

CREATE TABLE "BuilderExperimentAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderExperimentAssignment_experimentId_visitorId_key" ON "BuilderExperimentAssignment"("experimentId", "visitorId");
CREATE INDEX "BuilderExperimentAssignment_shop_experimentId_variantId_idx" ON "BuilderExperimentAssignment"("shop", "experimentId", "variantId");
CREATE INDEX "BuilderExperimentAssignment_shop_lastSeenAt_idx" ON "BuilderExperimentAssignment"("shop", "lastSeenAt");

CREATE TABLE "BuilderExperimentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventName" TEXT,
  "value" REAL,
  "currency" TEXT,
  "metadataJson" TEXT,
  "dedupeKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderExperimentEvent_shop_dedupeKey_key" ON "BuilderExperimentEvent"("shop", "dedupeKey");
CREATE INDEX "BuilderExperimentEvent_shop_experimentId_variantId_createdAt_idx" ON "BuilderExperimentEvent"("shop", "experimentId", "variantId", "createdAt");
CREATE INDEX "BuilderExperimentEvent_shop_eventType_createdAt_idx" ON "BuilderExperimentEvent"("shop", "eventType", "createdAt");
