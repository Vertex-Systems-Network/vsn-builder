/** Paths every authenticated shop can use before a paid plan is verified. */
export function isPlanlessBillingLocation(url) {
  if (!(url instanceof URL)) return false;
  if (url.pathname === "/app/plans") return true;
  if (url.pathname !== "/app" && url.pathname !== "/app/") return false;
  return ["pricing", "license"].includes(String(url.searchParams.get("view") || "").toLowerCase());
}

export function hasVerifiedBuilderPlan(plan) {
  return Boolean(plan?.entitlementVerified || plan?.developerMode);
}
