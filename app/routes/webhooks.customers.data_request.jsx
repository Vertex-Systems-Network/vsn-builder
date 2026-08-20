import { authenticate } from "../shopify.server";
import db from "../db.server.js";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  const customerId = String(payload?.customer?.id || payload?.customer_id || "").trim();
  if (shop && customerId) {
    const count = await db.builderWishlist.count({ where: { shop, customerId } }).catch(() => 0);
    console.info("VSN customer data request received", { shop, customerId, wishlistRecords: count });
  }
  return new Response(null, { status: 200 });
};
