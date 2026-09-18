ALTER TABLE "BuilderAiUsage" ADD COLUMN "provider" TEXT;
ALTER TABLE "BuilderAiUsage" ADD COLUMN "behaviorVersion" TEXT;
ALTER TABLE "BuilderAiUsage" ADD COLUMN "generationId" TEXT;

CREATE UNIQUE INDEX "BuilderAiUsage_generationId_key" ON "BuilderAiUsage"("generationId");
CREATE INDEX "BuilderAiUsage_shop_provider_behaviorVersion_createdAt_idx"
ON "BuilderAiUsage"("shop", "provider", "behaviorVersion", "createdAt");
