import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { recordExperimentEvent } from "../services/experiment-engine.server.js";
import { handleStorefrontFormSubmission } from "../services/storefront-form-submission.server.js";
import { handleLegacyStorefrontFormSubmission } from "../services/legacy-storefront-form-submission.server.js";
import { handleWishlistProxyAction } from "../services/wishlist-proxy.server.js";
import { jsonResponse } from "../storefront/responses.server.js";
import {
  boundedStorefrontFormData,
  boundedStorefrontText,
  STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS,
} from "../storefront/mutationRequest.server.js";

export { loader } from "./builder-proxy.$.jsx";

export async function action({ request }) {
  const { session } = await authenticate.public.appProxy(request);
  if (!session?.shop) return jsonResponse({ ok: false, error: "Invalid storefront request." }, 401);

  try {
    const formData = await boundedStorefrontFormData(request);
    const proxyUrl = new URL(request.url);
    const wishlistAction = await handleWishlistProxyAction({ db, session, formData, url: proxyUrl });
    if (wishlistAction) return wishlistAction;

    const actionName = String(formData.get("_vsnAction") || "");
    const isFormSubmission =
      proxyUrl.searchParams.get("formSubmit") === "1" ||
      formData.has("formKey") ||
      formData.has("formType");

    if (
      getServerFeatureFlags().formsAutomationV2 === true &&
      isFormSubmission &&
      actionName !== "experiment-event"
    ) {
      return handleStorefrontFormSubmission(request, session, formData);
    }

    if (actionName === "experiment-event") {
      const eventType = String(formData.get("eventType") || "").trim();
      if (eventType === "purchase") {
        return jsonResponse({ ok: false, error: "Purchase events are server-attributed." }, 400);
      }

      const metadataRaw = boundedStorefrontText(
        formData.get("metadata") || "null",
        STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS,
        "Experiment metadata is too large.",
      );
      let metadata = null;
      try {
        metadata = JSON.parse(metadataRaw);
      } catch {}

      const result = await recordExperimentEvent({
        db,
        shop: session.shop,
        experimentId: String(formData.get("experimentId") || ""),
        variantId: String(formData.get("variantId") || ""),
        visitorId: String(formData.get("visitorId") || ""),
        sessionId: String(formData.get("sessionId") || ""),
        eventType,
        eventName: String(formData.get("eventName") || ""),
        value: formData.get("value"),
        metadata,
        dedupeKey: String(formData.get("eventId") || "") || null,
      });

      return jsonResponse(
        { ok: result.success, duplicate: Boolean(result.duplicate), error: result.error || null },
        result.success ? 200 : 400,
      );
    }

    return handleLegacyStorefrontFormSubmission({ session, formData });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("VSN storefront mutation failed:", error);
    return jsonResponse({ ok: false, error: "The request could not be processed right now." }, 200);
  }
}
