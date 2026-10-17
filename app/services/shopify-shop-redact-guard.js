// Validate Shopify's *SDK-authenticated* mandatory shop/redact payload.
// HMAC authenticates the HTTP body, but the topic header and routing must
// not be treated as permission to erase an unrelated installed merchant.
const SHOP=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
export function isVerifiedShopRedactEvent(event){
  if(!event || typeof event!=="object" ||
     event.topic!=="SHOP_REDACT" ||
     typeof event.shop!=="string" || !SHOP.test(event.shop))
    return false;
  const payload=event.payload;
  if(!payload || typeof payload!=="object" || Array.isArray(payload))
    return false;
  // Shopify's mandatory topic carries the canonical shop_domain and shop_id.
  // Never accept a signed body for another shop just because an unsigned
  // routing header or a request-scoped shop hint points to this tenant.
  if(typeof payload.shop_domain!=="string" ||
     payload.shop_domain!==event.shop)
    return false;
  // Numeric platform IDs are validated by representation only: Shopify IDs
  // may exceed Number.MAX_SAFE_INTEGER, so do not round or coerce them.
  const shopId=payload.shop_id;
  return typeof shopId==="number"
    ? Number.isSafeInteger(shopId) && shopId>0
    : typeof shopId==="string" && /^[1-9][0-9]{0,19}$/.test(shopId);
}
