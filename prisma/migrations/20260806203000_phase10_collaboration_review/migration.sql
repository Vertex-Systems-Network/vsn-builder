ALTER TABLE "BuilderPage" ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "BuilderRevision" ADD COLUMN "label" TEXT;
ALTER TABLE "BuilderRevision" ADD COLUMN "parentRevisionId" TEXT;
ALTER TABLE "BuilderShopSetting" ADD COLUMN "collaborationRolesJson" TEXT;

CREATE TABLE "BuilderPresence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "collaborationRole" TEXT NOT NULL DEFAULT 'designer',
  "selectedElementId" TEXT,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderPresence_shop_pageId_actorKey_key" ON "BuilderPresence"("shop", "pageId", "actorKey");
CREATE INDEX "BuilderPresence_shop_pageId_lastSeenAt_idx" ON "BuilderPresence"("shop", "pageId", "lastSeenAt");

CREATE TABLE "BuilderComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "elementId" TEXT,
  "authorKey" TEXT,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL DEFAULT 'commenter',
  "body" TEXT NOT NULL,
  "mentionsJson" TEXT,
  "resolvedAt" DATETIME,
  "resolvedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "BuilderComment_shop_pageId_resolvedAt_createdAt_idx" ON "BuilderComment"("shop", "pageId", "resolvedAt", "createdAt");
CREATE INDEX "BuilderComment_shop_elementId_createdAt_idx" ON "BuilderComment"("shop", "elementId", "createdAt");

CREATE TABLE "BuilderReviewLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "label" TEXT,
  "createdBy" TEXT,
  "expiresAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderReviewLink_token_key" ON "BuilderReviewLink"("token");
CREATE INDEX "BuilderReviewLink_shop_pageId_revokedAt_createdAt_idx" ON "BuilderReviewLink"("shop", "pageId", "revokedAt", "createdAt");

CREATE TABLE "BuilderPageLock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "lockToken" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderPageLock_lockToken_key" ON "BuilderPageLock"("lockToken");
CREATE UNIQUE INDEX "BuilderPageLock_shop_pageId_key" ON "BuilderPageLock"("shop", "pageId");
CREATE INDEX "BuilderPageLock_shop_expiresAt_idx" ON "BuilderPageLock"("shop", "expiresAt");

CREATE TABLE "BuilderBranch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contentJson" TEXT NOT NULL,
  "baseRevisionId" TEXT,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderBranch_shop_pageId_name_key" ON "BuilderBranch"("shop", "pageId", "name");
CREATE INDEX "BuilderBranch_shop_pageId_updatedAt_idx" ON "BuilderBranch"("shop", "pageId", "updatedAt");
