ALTER TABLE "BuilderCustomFont" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "BuilderCustomFont_shop_deletedAt_family_idx" ON "BuilderCustomFont"("shop", "deletedAt", "family");

ALTER TABLE "BuilderFormSubmission" ADD COLUMN "requesterHash" TEXT;
ALTER TABLE "BuilderFormSubmission" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "BuilderFormSubmission" ADD COLUMN "retainedUntil" DATETIME;
CREATE INDEX "BuilderFormSubmission_shop_requesterHash_createdAt_idx" ON "BuilderFormSubmission"("shop", "requesterHash", "createdAt");
CREATE INDEX "BuilderFormSubmission_shop_deliveryStatus_createdAt_idx" ON "BuilderFormSubmission"("shop", "deliveryStatus", "createdAt");

CREATE TABLE "BuilderFormConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "formKey" TEXT NOT NULL,
  "settingsJson" TEXT NOT NULL DEFAULT '{}',
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderFormConfig_shop_formKey_key" ON "BuilderFormConfig"("shop", "formKey");
CREATE INDEX "BuilderFormConfig_shop_enabled_updatedAt_idx" ON "BuilderFormConfig"("shop", "enabled", "updatedAt");

CREATE TABLE "BuilderFormUpload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "fileData" BLOB NOT NULL,
  "scanStatus" TEXT NOT NULL DEFAULT 'pending',
  "scanMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderFormUpload_shop_submissionId_createdAt_idx" ON "BuilderFormUpload"("shop", "submissionId", "createdAt");
CREATE INDEX "BuilderFormUpload_shop_scanStatus_createdAt_idx" ON "BuilderFormUpload"("shop", "scanStatus", "createdAt");

CREATE TABLE "BuilderIntegration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "formKey" TEXT NOT NULL DEFAULT '*',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configJson" TEXT NOT NULL DEFAULT '{}',
  "secretJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderIntegration_shop_provider_enabled_idx" ON "BuilderIntegration"("shop", "provider", "enabled");
CREATE INDEX "BuilderIntegration_shop_formKey_enabled_idx" ON "BuilderIntegration"("shop", "formKey", "enabled");

CREATE TABLE "BuilderAutomationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "submissionId" TEXT,
  "formKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "target" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "responseStatus" INTEGER,
  "error" TEXT,
  "nextRetryAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderAutomationLog_shop_createdAt_idx" ON "BuilderAutomationLog"("shop", "createdAt");
CREATE INDEX "BuilderAutomationLog_shop_status_nextRetryAt_idx" ON "BuilderAutomationLog"("shop", "status", "nextRetryAt");
CREATE INDEX "BuilderAutomationLog_submissionId_provider_idx" ON "BuilderAutomationLog"("submissionId", "provider");

CREATE TABLE "BuilderSvgAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "svgText" TEXT NOT NULL,
  "tags" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME
);
CREATE INDEX "BuilderSvgAsset_shop_deletedAt_updatedAt_idx" ON "BuilderSvgAsset"("shop", "deletedAt", "updatedAt");
CREATE INDEX "BuilderSvgAsset_shop_name_idx" ON "BuilderSvgAsset"("shop", "name");
