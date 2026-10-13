// Request-scoped, narrow uninstall cleanup for *verified* Shopify webhooks.
// The only allowed write is Session.deleteMany constrained to the exact
// authenticated shop; merchant Builder pages, billing and assets are retained.
// This function must ONLY be injected into acceptWorkerShopifyUninstallWebhook
// as onVerified, after its WebCrypto + official Shopify SDK verification.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const reject=status=>new Response(null,{status,headers:{"cache-control":"no-store"}});

export async function revokeVerifiedWorkerShopifySessions({event,context}={}) {
  // Never trust a callback called by a different route/SDK without all fields.
  const shop=event?.shop;
  const payload=event?.payload;
  // Official app/uninstalled payload is a Shop object, not a shop/redact
  // payload: shop_domain can be absent, myshopify_domain can be null.
  // The authenticated SDK's event.shop (already checked against signed header
  // by the gate) is authoritative. Reject any conflicting payload identity
  // when Shopify does provide either optional domain field.
  const domains=[payload?.shop_domain,payload?.myshopify_domain]
    .filter(value=>value!==null && value!==undefined);
  if(!SHOP.test(String(shop||"")) || event?.topic!=="APP_UNINSTALLED" ||
     typeof event.webhookId!=="string" || !event.webhookId ||
     !payload || typeof payload!=="object" || Array.isArray(payload) ||
     domains.some(domain=>domain!==shop)) {
    return reject(401);
  }
  // Shopify SDK must use this same request-scoped storage/Neon client.
  // Never open a new connection with an unverified merchant identifier.
  const deleteMany=context?.database?.session?.deleteMany;
  if(typeof deleteMany!=="function")return reject(503);
  try {
    const result=await context.database.session.deleteMany({
      where:{shop},
    });
    // An empty idempotent replay (count=0) also succeeds. Unexpected
    // driver results fail closed and should trigger Shopify retries.
    if(!result || !Number.isSafeInteger(result.count) || result.count<0)
      return reject(503);
    return reject(204);
  }catch{
    // Never include database URL, merchant access tokens, or driver errors.
    return reject(503);
  }
}
