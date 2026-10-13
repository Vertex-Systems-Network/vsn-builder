// Session revocation after TWO independent Shopify webhook HMAC checks.
// A delayed pre-reinstall uninstall event must never delete new sessions.
// No destructive query may run without a durable, transactionally claimed
// installation-generation fence. The cloud schema/migration for that fence
// is NOT deployed yet; absent model/transaction deliberately returns 503.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const reject=status=>new Response(null,{status,headers:{"cache-control":"no-store"}});
const ok=()=>reject(204);

export async function revokeVerifiedWorkerShopifySessions({event,context,triggeredAt}={}) {
  const shop=event?.shop;
  const payload=event?.payload;
  const domains=[payload?.shop_domain,payload?.myshopify_domain]
    .filter(value=>value!==null && value!==undefined);
  if(!SHOP.test(String(shop||"")) || event?.topic!=="APP_UNINSTALLED" ||
     typeof event.webhookId!=="string" || !event.webhookId ||
     !payload || typeof payload!=="object" || Array.isArray(payload) ||
     domains.some(domain=>domain!==shop)) {
    return reject(401);
  }

  // This timestamp comes from X-Shopify-Triggered-At *after* the app's
  // WebCrypto + Shopify SDK HMAC validation. Event metadata headers alone
  // are NOT HMAC-signed; a durable installation fence must still authorize
  // any destructive action (and replay must be detected transactionally).
  const when=triggeredAt instanceof Date?triggeredAt:new Date(NaN);
  if(!Number.isFinite(when.getTime()))return reject(400);
  if(typeof context?.database?.$transaction!=="function")return reject(503);

  try {
    // The future OAuth install writer MUST update this row and create new
    // sessions in the same database transaction. updateMany on this exact
    // shop's row is the serialized claim. READ then DELETE is NOT safe.
    return await context.database.$transaction(async(tx)=>{
      const fence=tx?.builderShopInstallation;
      if(typeof fence?.updateMany!=="function" ||
         typeof fence?.findUnique!=="function" ||
         typeof tx?.session?.deleteMany!=="function") {
        throw new Error("Durable installation fence unavailable");
      }
      const claimed=await fence.updateMany({
        where:{shop,installedAt:{lte:when},uninstalledAt:null},
        data:{uninstalledAt:when,lastUninstallWebhookId:event.webhookId},
      });
      if(!claimed || !Number.isSafeInteger(claimed.count)) {
        throw new Error("Invalid installation fence claim result");
      }
      if(claimed.count===1){
        const deleted=await tx.session.deleteMany({where:{shop}});
        if(!deleted||!Number.isSafeInteger(deleted.count)||deleted.count<0)
          throw new Error("Invalid session revocation result");
        return ok();
      }
      if(claimed.count!==0)throw new Error("Invalid installation claim cardinality");

      // Neither duplicate webhook nor delayed prior-install event should
      // touch a newly installed merchant session. Read AFTER the atomic
      // claim, inside the same transaction.
      const current=await fence.findUnique({where:{shop}});
      if(!current || !(current.installedAt instanceof Date) ||
         !Number.isFinite(current.installedAt.getTime())) {
        throw new Error("Installation generation missing");
      }
      if(current.installedAt.getTime()>when.getTime())return ok();
      if(current.uninstalledAt instanceof Date &&
         Number.isFinite(current.uninstalledAt.getTime()))return ok();
      // Unknown/conflicting lifecycle state: retry rather than delete.
      throw new Error("Unverified installation lifecycle");
    });
  }catch{
    // Never return driver details, tokens, URLs, or installation metadata.
    return reject(503);
  }
}
