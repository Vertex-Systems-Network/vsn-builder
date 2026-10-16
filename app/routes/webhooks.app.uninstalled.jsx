import { authenticate } from "../shopify.server";
import { isValidLegacyUninstallEvent } from "../services/legacy-shopify-uninstall-guard.js";

export const action = async ({ request }) => {
  // The Shopify SDK verifies the HMAC before validating exact topic/shop.
  const event = await authenticate.webhook(request);
  if (!isValidLegacyUninstallEvent(event)) {
    return new Response(null, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }
  // Shopify webhook HMAC proves a sender and signed BODY, not which install
  // generation the event belongs to. A delayed, valid OLD uninstall webhook
  // can arrive after merchant reinstall. Without an independently attested
  // generation and an atomic installation fence, deleting sessions/pages is
  // unsafe. This legacy Node route has no such trusted issuer or CAS.
  //
  // Fail closed and explicitly request retry. A future generation-aware
  // transactional handler may replace this route after real OAuth/E2E proof.
  // GDPR redaction handlers are separate and must keep their own obligations.
  return new Response(null, {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "retry-after": "60",
    },
  });
};
