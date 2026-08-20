import { authenticate } from "../shopify.server";
import db from "../db.server.js";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  const customerId = String(payload?.customer?.id || payload?.customer_id || "").trim();
  if (shop && customerId) await db.builderWishlist.deleteMany({ where: { shop, customerId } });
  return new Response(null, { status: 200 });
};
