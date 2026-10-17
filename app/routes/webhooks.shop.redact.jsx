import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { isVerifiedShopRedactEvent } from "../services/shopify-shop-redact-guard.js";
import { deleteVsnShopDataAfterVerifiedRedaction } from "../services/shop-data-lifecycle.server.js";

const safe=(status)=>new Response(null,{status,headers:{
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  ...(status===503?{"retry-after":"60"}:{}),
}});
export const action = async ({ request }) => {
  // Official SDK authenticates the raw webhook HMAC. A valid HMAC from a
  // DIFFERENT topic or shop must never authorize entire-shop deletion.
  const event = await authenticate.webhook(request);
  if(!isVerifiedShopRedactEvent(event))return safe(401);
  try {
    // Shopify can retry delayed redactions after a merchant reinstalls.
    // The same installation row is claimed/locked before any deletion.
    // No current active installation or missing generation can be purged.
    await deleteVsnShopDataAfterVerifiedRedaction(db,event.shop);
    return safe(200);
  }catch{
    // This route is not allowed to silently acknowledge an unverified purge.
    // Explicit retry is safer than returning 200 after partial/blocked work.
    return safe(503);
  }
};
