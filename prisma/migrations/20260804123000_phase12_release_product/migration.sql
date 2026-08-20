-- Phase 12 release/product hardening
ALTER TABLE "BuilderFormSubmission" ADD COLUMN "readAt" DATETIME;
ALTER TABLE "BuilderFormSubmission" ADD COLUMN "isSpam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BuilderFormSubmission" ADD COLUMN "spamReason" TEXT;
CREATE INDEX "BuilderFormSubmission_shop_isSpam_createdAt_idx" ON "BuilderFormSubmission"("shop", "isSpam", "createdAt");

CREATE TABLE "BuilderSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "planKey" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "trialEndsAt" DATETIME,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderSubscription_shop_key" ON "BuilderSubscription"("shop");

CREATE TABLE "BuilderWebhookEndpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "formKey" TEXT NOT NULL DEFAULT '*',
  "url" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "secret" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderWebhookEndpoint_shop_enabled_idx" ON "BuilderWebhookEndpoint"("shop", "enabled");

CREATE TABLE "BuilderBackup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "statsJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderBackup_shop_createdAt_idx" ON "BuilderBackup"("shop", "createdAt");
