-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderPage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'Blank',
    "resourceId" TEXT,
    "resourceHandle" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentJson" TEXT,
    "publishedJson" TEXT,
    "shopifyPageId" TEXT,
    "shopifyPageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "templateImage" TEXT,
    "seoScore" INTEGER NOT NULL DEFAULT 100,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL DEFAULT 'Store owner',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "trashedAssetsJson" TEXT,

    CONSTRAINT "BuilderPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderRevision" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'save',
    "label" TEXT,
    "parentRevisionId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderAuditLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT,
    "actor" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderShopSetting" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "designTokensJson" TEXT,
    "onboardingJson" TEXT,
    "roleAccessJson" TEXT,
    "collaborationRolesJson" TEXT,
    "enterpriseJson" TEXT,
    "dashboardJson" TEXT,
    "templatesViewJson" TEXT,
    "appSettingsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderShopSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderMotionPreset" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "timelineJson" TEXT NOT NULL,
    "tokensJson" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderMotionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderDiagnosticEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "pageId" TEXT,
    "status" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderDiagnosticEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderVisitorSession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "country" TEXT,
    "lastPath" TEXT,
    "pageViews" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderVisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderRequestLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER,
    "durationMs" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderCleanupRun" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "statsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderCleanupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderFormSubmission" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "formKey" TEXT NOT NULL DEFAULT 'contact',
    "pageUrl" TEXT,
    "productHandle" TEXT,
    "customerEmail" TEXT,
    "fieldsJson" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "spamReason" TEXT,
    "requesterHash" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "retainedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderLibraryItem" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'section',
    "category" TEXT NOT NULL DEFAULT 'General',
    "syncMode" TEXT NOT NULL DEFAULT 'local',
    "contentJson" TEXT NOT NULL,
    "thumbnail" TEXT,
    "templateType" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sourceKey" TEXT,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "industry" TEXT,
    "style" TEXT,
    "planTier" TEXT NOT NULL DEFAULT 'free',
    "colorTags" TEXT,
    "layoutTags" TEXT,
    "description" TEXT,
    "qualityScore" INTEGER,
    "compatibilityJson" TEXT,
    "screenshotJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderTemplateRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderTemplateRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSubscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "provider" TEXT,
    "planHandle" TEXT,
    "billingPeriod" TEXT,
    "cancelAtEndOfCycle" BOOLEAN NOT NULL DEFAULT false,
    "cancelEffectiveOn" TIMESTAMP(3),
    "currentCycleStart" TIMESTAMP(3),
    "currentCycleEnd" TIMESTAMP(3),
    "pendingPlanKey" TEXT,
    "pendingPlanHandle" TEXT,
    "pendingBillingPeriod" TEXT,
    "shopifyAppId" TEXT,
    "shopifyShopId" TEXT,
    "legacySubscriptionId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncErrorAt" TIMESTAMP(3),
    "snapshotJson" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "formKey" TEXT NOT NULL DEFAULT '*',
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderBackup" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "statsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderNotification" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "sourceKey" TEXT,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSupportTicket" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderSupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSupportMessage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'merchant',
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderSupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderCustomFont" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 400,
    "style" TEXT NOT NULL DEFAULT 'normal',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderCustomFont_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderExperiment" (
    "id" TEXT NOT NULL,
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
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "winnerVariantId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "sourcePageId" TEXT,
    "sourceNodeId" TEXT,
    "snapshotJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderExperimentAssignment" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderExperimentEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventName" TEXT,
    "value" DOUBLE PRECISION,
    "currency" TEXT,
    "metadataJson" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderExperimentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderAiUsage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT,
    "operation" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "behaviorVersion" TEXT,
    "generationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "responseId" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderPresence" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "collaborationRole" TEXT NOT NULL DEFAULT 'designer',
    "selectedElementId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderComment" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "elementId" TEXT,
    "authorKey" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'commenter',
    "body" TEXT NOT NULL,
    "mentionsJson" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderReviewLink" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderReviewLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderPageLock" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "lockToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderPageLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderBranch" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "baseRevisionId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderLocalizationConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "baseLocale" TEXT NOT NULL DEFAULT 'en',
    "localesJson" TEXT NOT NULL DEFAULT '[]',
    "marketsJson" TEXT NOT NULL DEFAULT '[]',
    "rtlLocalesJson" TEXT NOT NULL DEFAULT '[]',
    "shopifySyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCatalogSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderLocalizationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderPageTranslation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL DEFAULT '*',
    "overridesJson" TEXT NOT NULL DEFAULT '{}',
    "seoJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "nativeSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderPageTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderFormConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderFormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderFormUpload" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "scanMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderFormUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderStockSearchCache" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderStockSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderStockApiUsage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" INTEGER,
    "providerLimit" TEXT,
    "providerRemaining" TEXT,
    "providerReset" TEXT,
    "lastEndpoint" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderStockApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderStockSearchHistory" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderStockSearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderIntegration" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formKey" TEXT NOT NULL DEFAULT '*',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "secretJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderAutomationLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "submissionId" TEXT,
    "formKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "target" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "error" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderAutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSvgAsset" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "svgText" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderSvgAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderBrandKit" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "colorsJson" TEXT NOT NULL DEFAULT '{}',
    "typographyJson" TEXT NOT NULL DEFAULT '{}',
    "spacingJson" TEXT NOT NULL DEFAULT '{}',
    "radiusJson" TEXT NOT NULL DEFAULT '{}',
    "shadowsJson" TEXT NOT NULL DEFAULT '{}',
    "profileJson" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderBrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderMarketplaceFavorite" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderMarketplaceFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderMarketplaceInstall" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "catalogVersion" INTEGER NOT NULL DEFAULT 1,
    "libraryItemId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "rollbackJson" TEXT,
    "assetManifestJson" TEXT NOT NULL DEFAULT '[]',
    "contentHash" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderMarketplaceInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderWidgetTemplate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "css" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderWidgetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderCustomWidget" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderCustomWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderGraphqlSavedQuery" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationType" TEXT NOT NULL DEFAULT 'query',
    "query" TEXT NOT NULL,
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderGraphqlSavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderGraphqlHistory" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderGraphqlHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderGlobalCode" (
    "id" TEXT NOT NULL,
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
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderGlobalCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderGlobalCodeRevision" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderGlobalCodeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderWishlist" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderEmailTemplate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Custom',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "documentJson" TEXT NOT NULL,
    "compiledHtml" TEXT NOT NULL,
    "plainText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuilderPage_shop_deletedAt_updatedAt_idx" ON "BuilderPage"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderPage_shop_deletedAt_status_updatedAt_idx" ON "BuilderPage"("shop", "deletedAt", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderPage_shop_deletedAt_template_createdAt_idx" ON "BuilderPage"("shop", "deletedAt", "template", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderPage_shop_deletedAt_seoScore_createdBy_idx" ON "BuilderPage"("shop", "deletedAt", "seoScore", "createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPage_shop_handle_key" ON "BuilderPage"("shop", "handle");

-- CreateIndex
CREATE INDEX "BuilderRevision_shop_pageId_createdAt_idx" ON "BuilderRevision"("shop", "pageId", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderAuditLog_shop_createdAt_idx" ON "BuilderAuditLog"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderShopSetting_shop_key" ON "BuilderShopSetting"("shop");

-- CreateIndex
CREATE INDEX "BuilderMotionPreset_shop_deletedAt_updatedAt_idx" ON "BuilderMotionPreset"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderMotionPreset_shop_category_idx" ON "BuilderMotionPreset"("shop", "category");

-- CreateIndex
CREATE INDEX "BuilderDiagnosticEvent_shop_createdAt_idx" ON "BuilderDiagnosticEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderVisitorSession_shop_lastSeenAt_idx" ON "BuilderVisitorSession"("shop", "lastSeenAt");

-- CreateIndex
CREATE INDEX "BuilderVisitorSession_shop_country_lastSeenAt_idx" ON "BuilderVisitorSession"("shop", "country", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderVisitorSession_shop_sessionId_key" ON "BuilderVisitorSession"("shop", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderRequestLog_requestId_key" ON "BuilderRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "BuilderRequestLog_shop_createdAt_idx" ON "BuilderRequestLog"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderRequestLog_route_createdAt_idx" ON "BuilderRequestLog"("route", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderCleanupRun_shop_createdAt_idx" ON "BuilderCleanupRun"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormSubmission_shop_createdAt_idx" ON "BuilderFormSubmission"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormSubmission_shop_formKey_createdAt_idx" ON "BuilderFormSubmission"("shop", "formKey", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormSubmission_shop_isSpam_createdAt_idx" ON "BuilderFormSubmission"("shop", "isSpam", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormSubmission_shop_requesterHash_createdAt_idx" ON "BuilderFormSubmission"("shop", "requesterHash", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormSubmission_shop_deliveryStatus_createdAt_idx" ON "BuilderFormSubmission"("shop", "deliveryStatus", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_kind_updatedAt_idx" ON "BuilderLibraryItem"("shop", "kind", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_category_updatedAt_idx" ON "BuilderLibraryItem"("shop", "category", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_templateType_updatedAt_idx" ON "BuilderLibraryItem"("shop", "templateType", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_isFavorite_updatedAt_idx" ON "BuilderLibraryItem"("shop", "isFavorite", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_deletedAt_updatedAt_idx" ON "BuilderLibraryItem"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_sourceKey_idx" ON "BuilderLibraryItem"("shop", "sourceKey");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_industry_style_idx" ON "BuilderLibraryItem"("shop", "industry", "style");

-- CreateIndex
CREATE INDEX "BuilderLibraryItem_shop_planTier_updatedAt_idx" ON "BuilderLibraryItem"("shop", "planTier", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderTemplateRule_shop_template_enabled_priority_idx" ON "BuilderTemplateRule"("shop", "template", "enabled", "priority");

-- CreateIndex
CREATE INDEX "BuilderTemplateRule_shop_pageId_idx" ON "BuilderTemplateRule"("shop", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderSubscription_shop_key" ON "BuilderSubscription"("shop");

-- CreateIndex
CREATE INDEX "BuilderSubscription_provider_status_verifiedAt_idx" ON "BuilderSubscription"("provider", "status", "verifiedAt");

-- CreateIndex
CREATE INDEX "BuilderWebhookEndpoint_shop_enabled_idx" ON "BuilderWebhookEndpoint"("shop", "enabled");

-- CreateIndex
CREATE INDEX "BuilderBackup_shop_createdAt_idx" ON "BuilderBackup"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderNotification_shop_dismissedAt_createdAt_idx" ON "BuilderNotification"("shop", "dismissedAt", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderNotification_shop_readAt_createdAt_idx" ON "BuilderNotification"("shop", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderNotification_shop_sourceKey_key" ON "BuilderNotification"("shop", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderSupportTicket_ticketCode_key" ON "BuilderSupportTicket"("ticketCode");

-- CreateIndex
CREATE INDEX "BuilderSupportTicket_shop_status_updatedAt_idx" ON "BuilderSupportTicket"("shop", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderSupportMessage_ticketId_createdAt_idx" ON "BuilderSupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderSupportMessage_shop_createdAt_idx" ON "BuilderSupportMessage"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderCustomFont_shop_deletedAt_family_idx" ON "BuilderCustomFont"("shop", "deletedAt", "family");

-- CreateIndex
CREATE INDEX "BuilderCustomFont_shop_family_idx" ON "BuilderCustomFont"("shop", "family");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderCustomFont_shop_family_weight_style_key" ON "BuilderCustomFont"("shop", "family", "weight", "style");

-- CreateIndex
CREATE INDEX "BuilderExperiment_shop_status_updatedAt_idx" ON "BuilderExperiment"("shop", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderExperiment_shop_pageId_status_idx" ON "BuilderExperiment"("shop", "pageId", "status");

-- CreateIndex
CREATE INDEX "BuilderExperimentVariant_experimentId_createdAt_idx" ON "BuilderExperimentVariant"("experimentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderExperimentVariant_experimentId_key_key" ON "BuilderExperimentVariant"("experimentId", "key");

-- CreateIndex
CREATE INDEX "BuilderExperimentAssignment_shop_experimentId_variantId_idx" ON "BuilderExperimentAssignment"("shop", "experimentId", "variantId");

-- CreateIndex
CREATE INDEX "BuilderExperimentAssignment_shop_lastSeenAt_idx" ON "BuilderExperimentAssignment"("shop", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderExperimentAssignment_experimentId_visitorId_key" ON "BuilderExperimentAssignment"("experimentId", "visitorId");

-- CreateIndex
CREATE INDEX "BuilderExperimentEvent_shop_experimentId_variantId_createdA_idx" ON "BuilderExperimentEvent"("shop", "experimentId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderExperimentEvent_shop_eventType_createdAt_idx" ON "BuilderExperimentEvent"("shop", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderExperimentEvent_shop_dedupeKey_key" ON "BuilderExperimentEvent"("shop", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderAiUsage_generationId_key" ON "BuilderAiUsage"("generationId");

-- CreateIndex
CREATE INDEX "BuilderAiUsage_shop_createdAt_idx" ON "BuilderAiUsage"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderAiUsage_shop_status_createdAt_idx" ON "BuilderAiUsage"("shop", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderAiUsage_shop_provider_behaviorVersion_createdAt_idx" ON "BuilderAiUsage"("shop", "provider", "behaviorVersion", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderPresence_shop_pageId_lastSeenAt_idx" ON "BuilderPresence"("shop", "pageId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPresence_shop_pageId_actorKey_key" ON "BuilderPresence"("shop", "pageId", "actorKey");

-- CreateIndex
CREATE INDEX "BuilderComment_shop_pageId_resolvedAt_createdAt_idx" ON "BuilderComment"("shop", "pageId", "resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderComment_shop_elementId_createdAt_idx" ON "BuilderComment"("shop", "elementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderReviewLink_token_key" ON "BuilderReviewLink"("token");

-- CreateIndex
CREATE INDEX "BuilderReviewLink_shop_pageId_revokedAt_createdAt_idx" ON "BuilderReviewLink"("shop", "pageId", "revokedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPageLock_lockToken_key" ON "BuilderPageLock"("lockToken");

-- CreateIndex
CREATE INDEX "BuilderPageLock_shop_expiresAt_idx" ON "BuilderPageLock"("shop", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPageLock_shop_pageId_key" ON "BuilderPageLock"("shop", "pageId");

-- CreateIndex
CREATE INDEX "BuilderBranch_shop_pageId_updatedAt_idx" ON "BuilderBranch"("shop", "pageId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderBranch_shop_pageId_name_key" ON "BuilderBranch"("shop", "pageId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderLocalizationConfig_shop_key" ON "BuilderLocalizationConfig"("shop");

-- CreateIndex
CREATE INDEX "BuilderPageTranslation_shop_locale_marketKey_updatedAt_idx" ON "BuilderPageTranslation"("shop", "locale", "marketKey", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderPageTranslation_shop_pageId_updatedAt_idx" ON "BuilderPageTranslation"("shop", "pageId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderPageTranslation_shop_pageId_locale_marketKey_key" ON "BuilderPageTranslation"("shop", "pageId", "locale", "marketKey");

-- CreateIndex
CREATE INDEX "BuilderFormConfig_shop_enabled_updatedAt_idx" ON "BuilderFormConfig"("shop", "enabled", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderFormConfig_shop_formKey_key" ON "BuilderFormConfig"("shop", "formKey");

-- CreateIndex
CREATE INDEX "BuilderFormUpload_shop_submissionId_createdAt_idx" ON "BuilderFormUpload"("shop", "submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderFormUpload_shop_scanStatus_createdAt_idx" ON "BuilderFormUpload"("shop", "scanStatus", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderStockSearchCache_shop_expiresAt_idx" ON "BuilderStockSearchCache"("shop", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderStockSearchCache_shop_provider_cacheKey_key" ON "BuilderStockSearchCache"("shop", "provider", "cacheKey");

-- CreateIndex
CREATE INDEX "BuilderStockApiUsage_shop_updatedAt_idx" ON "BuilderStockApiUsage"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderStockApiUsage_shop_provider_mediaKind_key" ON "BuilderStockApiUsage"("shop", "provider", "mediaKind");

-- CreateIndex
CREATE INDEX "BuilderStockSearchHistory_shop_mediaKind_lastUsedAt_idx" ON "BuilderStockSearchHistory"("shop", "mediaKind", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderStockSearchHistory_shop_mediaKind_fingerprint_key" ON "BuilderStockSearchHistory"("shop", "mediaKind", "fingerprint");

-- CreateIndex
CREATE INDEX "BuilderIntegration_shop_provider_enabled_idx" ON "BuilderIntegration"("shop", "provider", "enabled");

-- CreateIndex
CREATE INDEX "BuilderIntegration_shop_formKey_enabled_idx" ON "BuilderIntegration"("shop", "formKey", "enabled");

-- CreateIndex
CREATE INDEX "BuilderAutomationLog_shop_createdAt_idx" ON "BuilderAutomationLog"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderAutomationLog_shop_status_nextRetryAt_idx" ON "BuilderAutomationLog"("shop", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "BuilderAutomationLog_submissionId_provider_idx" ON "BuilderAutomationLog"("submissionId", "provider");

-- CreateIndex
CREATE INDEX "BuilderSvgAsset_shop_deletedAt_updatedAt_idx" ON "BuilderSvgAsset"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderSvgAsset_shop_name_idx" ON "BuilderSvgAsset"("shop", "name");

-- CreateIndex
CREATE INDEX "BuilderBrandKit_shop_deletedAt_updatedAt_idx" ON "BuilderBrandKit"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderBrandKit_shop_isDefault_idx" ON "BuilderBrandKit"("shop", "isDefault");

-- CreateIndex
CREATE INDEX "BuilderMarketplaceFavorite_shop_createdAt_idx" ON "BuilderMarketplaceFavorite"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderMarketplaceFavorite_shop_catalogId_key" ON "BuilderMarketplaceFavorite"("shop", "catalogId");

-- CreateIndex
CREATE INDEX "BuilderMarketplaceInstall_shop_installedAt_idx" ON "BuilderMarketplaceInstall"("shop", "installedAt");

-- CreateIndex
CREATE INDEX "BuilderMarketplaceInstall_shop_libraryItemId_idx" ON "BuilderMarketplaceInstall"("shop", "libraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderMarketplaceInstall_shop_catalogId_key" ON "BuilderMarketplaceInstall"("shop", "catalogId");

-- CreateIndex
CREATE INDEX "BuilderWidgetTemplate_shop_enabled_updatedAt_idx" ON "BuilderWidgetTemplate"("shop", "enabled", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderWidgetTemplate_shop_widgetType_key" ON "BuilderWidgetTemplate"("shop", "widgetType");

-- CreateIndex
CREATE INDEX "BuilderCustomWidget_shop_deletedAt_enabled_updatedAt_idx" ON "BuilderCustomWidget"("shop", "deletedAt", "enabled", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderCustomWidget_shop_category_idx" ON "BuilderCustomWidget"("shop", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderCustomWidget_shop_widgetKey_key" ON "BuilderCustomWidget"("shop", "widgetKey");

-- CreateIndex
CREATE INDEX "BuilderGraphqlSavedQuery_shop_deletedAt_updatedAt_idx" ON "BuilderGraphqlSavedQuery"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderGraphqlSavedQuery_shop_isFavorite_updatedAt_idx" ON "BuilderGraphqlSavedQuery"("shop", "isFavorite", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderGraphqlHistory_shop_createdAt_idx" ON "BuilderGraphqlHistory"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderGraphqlHistory_shop_success_createdAt_idx" ON "BuilderGraphqlHistory"("shop", "success", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderGlobalCode_shop_deletedAt_enabled_priority_idx" ON "BuilderGlobalCode"("shop", "deletedAt", "enabled", "priority");

-- CreateIndex
CREATE INDEX "BuilderGlobalCode_shop_kind_scope_idx" ON "BuilderGlobalCode"("shop", "kind", "scope");

-- CreateIndex
CREATE INDEX "BuilderGlobalCodeRevision_shop_globalCodeId_createdAt_idx" ON "BuilderGlobalCodeRevision"("shop", "globalCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "BuilderWishlist_shop_updatedAt_idx" ON "BuilderWishlist"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderWishlist_shop_customerId_key" ON "BuilderWishlist"("shop", "customerId");

-- CreateIndex
CREATE INDEX "BuilderEmailTemplate_shop_deletedAt_updatedAt_idx" ON "BuilderEmailTemplate"("shop", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BuilderEmailTemplate_shop_category_status_idx" ON "BuilderEmailTemplate"("shop", "category", "status");

-- AddForeignKey
ALTER TABLE "BuilderSupportMessage" ADD CONSTRAINT "BuilderSupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BuilderSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderExperimentVariant" ADD CONSTRAINT "BuilderExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "BuilderExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

