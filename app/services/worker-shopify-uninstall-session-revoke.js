// Session revocation after TWO independent Shopify webhook HMAC checks.
// A delayed pre-reinstall uninstall event must never delete new sessions.
// Default context never provides trusted event-generation proof; no
// destructive cleanup is allowed from the existing hosted SDK context.
// No destructive query may run without a durable, transactionally claimed
// installation-generation fence. The cloud schema/migration for that fence
// is NOT deployed yet; absent model/transaction deliberately returns 503.
const SHOP=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const reject=status=>new Response(null,{status,headers:{
  "cache-control":"no-store",
  ...(status===503?{"retry-after":"60"}:{}),
}});
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
  // Webhook HMAC signs the BODY, not X-Shopify-Triggered-At or event ID.
  // A valid older body paired with a forged newer timestamp could otherwise
  // delete newly reinstalled merchant sessions. Never enable a destructive
  // transaction based on signed-body + unsigned-header metadata alone.
  //
  // The normal Shopify SDK request context deliberately does NOT implement
  // this capability. Only a FUTURE independent, authenticated, generation-
  // aware event attestation service may authorize it; no live issuer exists.
  if(typeof context?.verifyTrustedUninstallGeneration!=="function")
    return reject(503);
  // Require a concrete independent attestation to one exact installation,
  // never an unbound boolean "verified". The trusted issuer must determine
  // the event's install generation independently of request headers.
  // Never pass the unsigned Triggered-At header to this verifier: it is
  // validated for syntax only and must not become a generation oracle.
  // Its implementation is NOT provided by the SDK or deployed runtime yet.
  let attestedGeneration;
  try {
    const evidence=await context.verifyTrustedUninstallGeneration({
      shop,topic:event.topic,webhookId:event.webhookId,
      payload,
    });
    if(!evidence || typeof evidence!=="object" ||
       evidence.shop!==shop || evidence.topic!==event.topic ||
       evidence.webhookId!==event.webhookId ||
       !(evidence.installedAt instanceof Date) ||
       !Number.isFinite(evidence.installedAt.getTime()))
      return reject(503);
    attestedGeneration=evidence.installedAt;
  }catch{return reject(503)}
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
      const closedAt=new Date();
      if(!Number.isFinite(closedAt.getTime()) ||
         closedAt.getTime()<attestedGeneration.getTime())
        throw new Error("Invalid trusted installation time");
      const claimed=await fence.updateMany({
        // Compare-and-swap the exact signed-generation claim; X-Shopify-
        // Triggered-At is unsigned and NEVER used in authorization.
        where:{shop,installedAt:attestedGeneration,uninstalledAt:null},
        data:{uninstalledAt:closedAt,lastUninstallWebhookId:event.webhookId},
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
      if(current.installedAt.getTime()>attestedGeneration.getTime())return ok();
      if(current.installedAt.getTime()===attestedGeneration.getTime() &&
         current.uninstalledAt instanceof Date &&
         Number.isFinite(current.uninstalledAt.getTime()))return ok();
      // The row is from a previous generation or is otherwise inconsistent
      // with the trusted proof. Never delete sessions on this ambiguity.
      // Unknown/conflicting lifecycle state: retry rather than delete.
      throw new Error("Unverified installation lifecycle");
    });
  }catch{
    // Never return driver details, tokens, URLs, or installation metadata.
    return reject(503);
  }
}
