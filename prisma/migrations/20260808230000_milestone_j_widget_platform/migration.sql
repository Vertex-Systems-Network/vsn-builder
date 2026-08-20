CREATE TABLE "BuilderWidgetTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "css" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderWidgetTemplate_shop_widgetType_key" ON "BuilderWidgetTemplate"("shop", "widgetType");
CREATE INDEX "BuilderWidgetTemplate_shop_enabled_updatedAt_idx" ON "BuilderWidgetTemplate"("shop", "enabled", "updatedAt");

CREATE TABLE "BuilderCustomWidget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Custom',
    "icon" TEXT NOT NULL DEFAULT 'widgets',
    "description" TEXT,
    "fieldsJson" TEXT NOT NULL DEFAULT '[]',
    "templateHtml" TEXT NOT NULL,
    "templateCss" TEXT NOT NULL DEFAULT '',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
CREATE UNIQUE INDEX "BuilderCustomWidget_shop_widgetKey_key" ON "BuilderCustomWidget"("shop", "widgetKey");
CREATE INDEX "BuilderCustomWidget_shop_deletedAt_enabled_updatedAt_idx" ON "BuilderCustomWidget"("shop", "deletedAt", "enabled", "updatedAt");
CREATE INDEX "BuilderCustomWidget_shop_category_idx" ON "BuilderCustomWidget"("shop", "category");
