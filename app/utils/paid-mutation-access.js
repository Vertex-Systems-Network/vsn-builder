// Shared, fail-closed predicate for production merchant mutations.
// A role permission is not proof of Shopify billing entitlement.
const PUBLIC_PAID_PLANS = new Set(["starter", "sliver", "gold", "platinum"]);
export function evaluatePaidMutationAccess(plan, resolveHandle) {
  const subscription = plan?.subscription;
  const status = String(subscription?.status || "");
  const paidState = ["active", "trialing", "canceling"].includes(status);
  const handle = subscription?.planHandle;
  const resolved = handle && typeof resolveHandle === "function" ? resolveHandle(handle) : null;
  // Older VSN versions mapped `free` -> `core`. Reject both retired IDs
  // even when a legacy handle resolver claims they match a subscription row.
  const canonicalHandle = String(handle || "").trim().toLowerCase();
  const canonicalTier = String(plan?.key || "").trim().toLowerCase();
  const tierMatches = Boolean(
    PUBLIC_PAID_PLANS.has(canonicalHandle) &&
    PUBLIC_PAID_PLANS.has(canonicalTier) &&
    resolved === canonicalTier
  );
  const trusted = plan?.subscriptionMirrorTrusted === true && plan?.entitlementVerified === true;
  const allowed = Boolean(trusted && paidState && tierMatches);
  return { allowed, code: allowed ? "VSN_ENTITLEMENT_ALLOWED" : "VSN_PAID_SUBSCRIPTION_REQUIRED" };
}
