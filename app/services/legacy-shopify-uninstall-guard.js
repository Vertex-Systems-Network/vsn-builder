// Defense in depth AFTER official Shopify webhook signature verification.
// This is NOT a trusted uninstall-generation or replay attestor.
const SHOP=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
export function isValidLegacyUninstallEvent(event){
 if(!event || typeof event!=="object" ||
    event.topic!=="APP_UNINSTALLED" ||
    typeof event.shop!=="string" || !SHOP.test(event.shop))return false;
 const payload=event.payload;
 if(!payload || typeof payload!=="object" || Array.isArray(payload))return false;
 // Shopify API versions differ: optional canonical shop-domain fields
 // must match the SDK-authenticated shop. Storefront custom domain differs.
 for(const field of ["shop_domain","myshopify_domain"]){
  const domain=payload[field];
  if(domain!==null && domain!==undefined && domain!==event.shop)return false;
 }
 return true;
}
