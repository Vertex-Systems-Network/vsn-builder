import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { deleteVsnShopData } from "../services/shop-data-lifecycle.server.js";

export const action = async ({ request }) => {
  const { shop } = await authenticate.webhook(request);
  // Mandatory shop/redact must remove the app-owned shop dataset, not only
  // customer wishlist rows. Reuse the same idempotent uninstall lifecycle.
  await deleteVsnShopData(db, shop, { includeSessions: true });
  return new Response(null, { status: 200 });
};
