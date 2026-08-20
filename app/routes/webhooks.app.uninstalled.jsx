import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { deleteVsnShopData } from "../services/shop-data-lifecycle.server.js";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // App uninstall can be retried. The shared lifecycle service is intentionally
  // idempotent and removes all VSN-owned merchant data plus stored sessions.
  await deleteVsnShopData(db, shop, { includeSessions: true });
  return new Response(null, { status: 200 });
};
