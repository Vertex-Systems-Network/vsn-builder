CREATE TABLE "BuilderGraphqlSavedQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationType" TEXT NOT NULL DEFAULT 'query',
    "query" TEXT NOT NULL,
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderGraphqlSavedQuery_shop_deletedAt_updatedAt_idx" ON "BuilderGraphqlSavedQuery"("shop", "deletedAt", "updatedAt");
CREATE INDEX "BuilderGraphqlSavedQuery_shop_isFavorite_updatedAt_idx" ON "BuilderGraphqlSavedQuery"("shop", "isFavorite", "updatedAt");

CREATE TABLE "BuilderGraphqlHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "actor" TEXT,
    "operationType" TEXT NOT NULL DEFAULT 'query',
    "operationName" TEXT,
    "query" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "requestedCost" INTEGER,
    "actualCost" INTEGER,
    "throttleJson" TEXT,
    "errorsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderGraphqlHistory_shop_createdAt_idx" ON "BuilderGraphqlHistory"("shop", "createdAt");
CREATE INDEX "BuilderGraphqlHistory_shop_success_createdAt_idx" ON "BuilderGraphqlHistory"("shop", "success", "createdAt");

CREATE TABLE "BuilderGlobalCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'css',
    "scope" TEXT NOT NULL DEFAULT 'storefront',
    "target" TEXT,
    "location" TEXT NOT NULL DEFAULT 'head',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT NOT NULL,
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderGlobalCode_shop_deletedAt_enabled_priority_idx" ON "BuilderGlobalCode"("shop", "deletedAt", "enabled", "priority");
CREATE INDEX "BuilderGlobalCode_shop_kind_scope_idx" ON "BuilderGlobalCode"("shop", "kind", "scope");

CREATE TABLE "BuilderGlobalCodeRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "globalCodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target" TEXT,
    "location" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "code" TEXT NOT NULL,
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuilderGlobalCodeRevision_shop_globalCodeId_createdAt_idx" ON "BuilderGlobalCodeRevision"("shop", "globalCodeId", "createdAt");
