import { resolveEntitlementPlan } from "../services/entitlements.server.js";
import { resolveInternalPlanKeyFromHandle } from "../services/shopify-app-pricing.server.js";
import { evaluatePaidMutationAccess } from "./paid-mutation-access.js";

// All authenticated merchant mutation handlers must enforce this at the
// action boundary. Dev-only simulation stays available without Shopify billing.
export async function assertPaidBuilderMutation(db, shop) {
  if (process.env.NODE_ENV !== "production") return;
  const plan = await resolveEntitlementPlan(db, shop);
  const decision = evaluatePaidMutationAccess(plan, resolveInternalPlanKeyFromHandle);
  if (!decision.allowed) {
    throw Response.json({
      success: false,
      error: "An active verified Shopify paid subscription is required for builder changes.",
      code: decision.code,
    }, { status: 403 });
  }
}
