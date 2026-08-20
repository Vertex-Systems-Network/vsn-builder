CREATE TABLE "BuilderWishlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BuilderWishlist_shop_customerId_key" ON "BuilderWishlist"("shop", "customerId");
CREATE INDEX "BuilderWishlist_shop_updatedAt_idx" ON "BuilderWishlist"("shop", "updatedAt");
