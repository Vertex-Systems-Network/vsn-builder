// Shared, fail-closed predicate for production merchant mutations.
// A role permission is not proof of Shopify billing entitlement.
export function evaluatePaidMutationAccess(plan, resolveHandle) {
  const subscription = plan?.subscription;
  const status = String(subscription?.status || "");
  const paidState = ["active", "trialing", "canceling"].includes(status);
  const handle = subscription?.planHandle;
  const resolved = handle && typeof resolveHandle === "function" ? resolveHandle(handle) : null;
  const tierMatches = Boolean(resolved && resolved === plan?.key);
  const trusted = plan?.subscriptionMirrorTrusted === true && plan?.entitlementVerified === true;
  const allowed = Boolean(trusted && paidState && tierMatches);
  return { allowed, code: allowed ? "VSN_ENTITLEMENT_ALLOWED" : "VSN_PAID_SUBSCRIPTION_REQUIRED" };
}
