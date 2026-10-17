function shopDeleteOperations(db, shop, includeSessions) {
  const operations = [
    db.builderRevision.deleteMany({ where: { shop } }),
    db.builderAuditLog.deleteMany({ where: { shop } }),
    db.builderDiagnosticEvent.deleteMany({ where: { shop } }),
    db.builderRequestLog.deleteMany({ where: { shop } }),
    db.builderCleanupRun.deleteMany({ where: { shop } }),
    db.builderSupportMessage.deleteMany({ where: { shop } }),
    db.builderSupportTicket.deleteMany({ where: { shop } }),
    db.builderNotification.deleteMany({ where: { shop } }),
    db.builderPresence.deleteMany({ where: { shop } }),
    db.builderComment.deleteMany({ where: { shop } }),
    db.builderReviewLink.deleteMany({ where: { shop } }),
    db.builderPageLock.deleteMany({ where: { shop } }),
    db.builderBranch.deleteMany({ where: { shop } }),
    db.builderPageTranslation.deleteMany({ where: { shop } }),
    db.builderLocalizationConfig.deleteMany({ where: { shop } }),
    db.builderAiUsage.deleteMany({ where: { shop } }),
    db.builderExperimentEvent.deleteMany({ where: { shop } }),
    db.builderExperimentAssignment.deleteMany({ where: { shop } }),
    db.builderExperiment.deleteMany({ where: { shop } }),
    db.builderAutomationLog.deleteMany({ where: { shop } }),
    db.builderFormUpload.deleteMany({ where: { shop } }),
    db.builderFormSubmission.deleteMany({ where: { shop } }),
    db.builderFormConfig.deleteMany({ where: { shop } }),
    db.builderStockSearchCache.deleteMany({ where: { shop } }),
    db.builderIntegration.deleteMany({ where: { shop } }),
    db.builderWebhookEndpoint.deleteMany({ where: { shop } }),
    db.builderSvgAsset.deleteMany({ where: { shop } }),
    db.builderCustomFont.deleteMany({ where: { shop } }),
    db.builderMarketplaceFavorite.deleteMany({ where: { shop } }),
    db.builderMarketplaceInstall.deleteMany({ where: { shop } }),
    db.builderBrandKit.deleteMany({ where: { shop } }),
    db.builderMotionPreset.deleteMany({ where: { shop } }),
    db.builderGraphqlSavedQuery.deleteMany({ where: { shop } }),
    db.builderGraphqlHistory.deleteMany({ where: { shop } }),
    db.builderGlobalCodeRevision.deleteMany({ where: { shop } }),
    db.builderGlobalCode.deleteMany({ where: { shop } }),
    db.builderWishlist.deleteMany({ where: { shop } }),
    db.builderEmailTemplate.deleteMany({ where: { shop } }),
    db.builderVisitorSession.deleteMany({ where: { shop } }),
    db.builderLibraryItem.deleteMany({ where: { shop } }),
    db.builderTemplateRule.deleteMany({ where: { shop } }),
    db.builderBackup.deleteMany({ where: { shop } }),
    db.builderSubscription.deleteMany({ where: { shop } }),
    db.builderShopSetting.deleteMany({ where: { shop } }),
    db.builderPage.deleteMany({ where: { shop } }),
  ];
  if (includeSessions) operations.push(db.session.deleteMany({ where: { shop } }));
  return operations;
}

/** Original explicit administrative purge; preserves historical behavior. */
export async function deleteVsnShopData(db, shop, { includeSessions = true } = {}) {
  if (!shop) return { deleted: false, reason: "missing-shop" };
  await db.$transaction(shopDeleteOperations(db,shop,includeSessions));
  return { deleted: true };
}

const canonicalShop=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.myshopify\\.com$/;
const blocked=()=>{
  const error=new Error("T024_SHOP_REDACT_GENERATION_NOT_VERIFIED");
  error.code="T024_SHOP_REDACT_GENERATION_NOT_VERIFIED";
  return error;
};

/**
 * Shopify shop/redact is NOT an uninstall-generation proof. It may arrive
 * after reinstall, so the old unconditional purge could erase new merchant
 * data. Serialize a cleanup claim against the exact installation row.
 *
 * Only a confirmed, already-uninstalled installation is eligible; absent
 * install evidence or a current active installation fails closed. The
 * generation-aware OAuth writer must update the SAME row transactionally.
 * The current legacy Node OAuth writer has not been certified to do so:
 * do NOT claim full T024 acceptance or activate hosted GDPR deletion yet.
 *
 * Keep the tombstone row for idempotent retries and generation comparisons.
 */
export async function deleteVsnShopDataAfterVerifiedRedaction(db,shop) {
  if(typeof shop!=="string" || !canonicalShop.test(shop) ||
     typeof db?.$transaction!=="function")throw blocked();
  try {
    return await db.$transaction(async tx=>{
      if(typeof tx?.builderShopInstallation?.updateMany!=="function")
        throw blocked();
      // updateMany acquires the shop generation row lock. A new installation
      // written via the reviewed generation-aware writer locks this same row.
      // No delete query is constructed until this claim succeeds.
      const claim=await tx.builderShopInstallation.updateMany({
        where:{shop,uninstalledAt:{not:null}},
        data:{updatedAt:new Date()},
      });
      if(!claim || claim.count!==1)throw blocked();
      // These already scoped deletes use this SAME transaction. Unlike the
      // normal array $transaction, we must await each command while holding
      // the row lock. If anything throws, every delete and claim roll back.
      for(const operation of shopDeleteOperations(tx,shop,true))
        await operation;
      return {deleted:true};
    },{maxWait:5000,timeout:60000});
  }catch{
    // Never echo DB driver errors, installation timestamps or merchant data.
    throw blocked();
  }
}
