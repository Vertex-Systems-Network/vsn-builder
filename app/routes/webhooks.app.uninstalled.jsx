import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { deleteVsnShopData } from "../services/shop-data-lifecycle.server.js";
import { isValidLegacyUninstallEvent } from "../services/legacy-shopify-uninstall-guard.js";

export const action = async ({ request }) => {
  // SDK must verify signature BEFORE cleanup of the exact topic and shop.
  const event = await authenticate.webhook(request);
  if (!isValidLegacyUninstallEvent(event)) {
    return new Response(null, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }
  // T024 remains open: a valid delayed pre-reinstall webhook can still
  // delete current data without independent install-generation provenance.
  await deleteVsnShopData(db, event.shop, { includeSessions: true });
  return new Response(null, { status: 200 });
};
