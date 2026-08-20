CREATE TABLE "BuilderNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "sourceKey" TEXT,
    "readAt" DATETIME,
    "dismissedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuilderNotification_shop_sourceKey_key" ON "BuilderNotification"("shop", "sourceKey");
CREATE INDEX "BuilderNotification_shop_dismissedAt_createdAt_idx" ON "BuilderNotification"("shop", "dismissedAt", "createdAt");
CREATE INDEX "BuilderNotification_shop_readAt_createdAt_idx" ON "BuilderNotification"("shop", "readAt", "createdAt");

CREATE TABLE "BuilderSupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME
);
CREATE UNIQUE INDEX "BuilderSupportTicket_ticketCode_key" ON "BuilderSupportTicket"("ticketCode");
CREATE INDEX "BuilderSupportTicket_shop_status_updatedAt_idx" ON "BuilderSupportTicket"("shop", "status", "updatedAt");

CREATE TABLE "BuilderSupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'merchant',
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuilderSupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BuilderSupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BuilderSupportMessage_ticketId_createdAt_idx" ON "BuilderSupportMessage"("ticketId", "createdAt");
CREATE INDEX "BuilderSupportMessage_shop_createdAt_idx" ON "BuilderSupportMessage"("shop", "createdAt");
