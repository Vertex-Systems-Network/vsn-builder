CREATE TABLE "BuilderFormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "formKey" TEXT NOT NULL DEFAULT 'contact',
    "pageUrl" TEXT,
    "productHandle" TEXT,
    "customerEmail" TEXT,
    "fieldsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderFormSubmission_shop_createdAt_idx" ON "BuilderFormSubmission"("shop", "createdAt");
CREATE INDEX "BuilderFormSubmission_shop_formKey_createdAt_idx" ON "BuilderFormSubmission"("shop", "formKey", "createdAt");
