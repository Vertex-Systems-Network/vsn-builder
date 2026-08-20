import { COMMERCIAL_PLANS, PLAN_ORDER, normalizePlanKey, planAtLeast } from "../config/commercialPlans.js";
import { getEntitlementSnapshot, getFeatureDecisionFromPlan, getQuotaDecisionFromUsage, resolveEntitlementPlan } from "../services/entitlements.server.js";

export const BUILDER_PLANS = COMMERCIAL_PLANS;
export { PLAN_ORDER, normalizePlanKey, planAtLeast };

export async function getPlan(db, shop) {
  return resolveEntitlementPlan(db, shop);
}

// Compatibility helpers remain for older modules, but Q5.3 server mutations should
// use the named entitlement service so feature/quota authority is centralized.
export function planAllows(plan, feature) {
  try { return getFeatureDecisionFromPlan(plan, feature).allowed; }
  catch {
    const value = plan?.[feature];
    if (typeof value === "number") return value < 0 || value > 0;
    return Boolean(value);
  }
}

export function quotaAllows(limit, used, extra = 1) {
  const value = Number(limit);
  if (value < 0) return true;
  return Number(used || 0) + Number(extra || 0) <= value;
}

export function entitlementMessage(plan, featureLabel, requiredPlan = "pro") {
  return `${featureLabel} is not included in the ${plan?.name || "current"} plan. Choose ${BUILDER_PLANS[normalizePlanKey(requiredPlan)]?.name || requiredPlan} or higher in Plans & License.`;
}

export async function getPlanUsage(db, shop, plan = null) {
  const snapshot = await getEntitlementSnapshot(db, shop);
  const resolvedPlan = plan || snapshot.plan;
  const q = snapshot.quotas;
  // Legacy shape is preserved for dashboards/panels while all counters now come
  // from the same Q5.3 entitlement authority used by server mutation gates.
  return {
    pages: { used: q.pages?.used || 0, limit: Number(resolvedPlan.maxPages) },
    templates: { used: q.marketplaceInstalls?.used || 0, limit: Number(resolvedPlan.templateQuota) },
    ai: { used: q.aiGenerations?.used || 0, limit: Number(resolvedPlan.aiMonthly), resetAt: q.aiGenerations?.resetAt || null },
    experiments: { used: q.croExperiments?.used || 0, limit: Number(resolvedPlan.croExperiments) },
    team: { used: q.collaborationSeats?.used || 1, limit: Number(resolvedPlan.teamMembers), window: "assigned seats" },
  };
}

export function serializePlan(plan) {
  if (!plan) return null;
  const { subscription, subscriptionMirrorTrusted, ...safe } = plan;
  return {
    ...safe,
    subscription: subscription ? {
      status: subscription.status,
      planKey: subscription.planKey,
      provider: subscription.provider || null,
      planHandle: subscription.planHandle || null,
      billingPeriod: subscription.billingPeriod || null,
      cancelAtEndOfCycle: Boolean(subscription.cancelAtEndOfCycle),
      cancelEffectiveOn: subscription.cancelEffectiveOn?.toISOString?.() || subscription.cancelEffectiveOn || null,
      currentCycleStart: subscription.currentCycleStart?.toISOString?.() || subscription.currentCycleStart || null,
      currentCycleEnd: subscription.currentCycleEnd?.toISOString?.() || subscription.currentCycleEnd || null,
      pendingPlanKey: subscription.pendingPlanKey || null,
      pendingPlanHandle: subscription.pendingPlanHandle || null,
      pendingBillingPeriod: subscription.pendingBillingPeriod || null,
      verifiedAt: subscription.verifiedAt?.toISOString?.() || subscription.verifiedAt || null,
      lastSyncAt: subscription.lastSyncAt?.toISOString?.() || subscription.lastSyncAt || null,
      lastSyncError: subscription.lastSyncError || null,
        lastSyncErrorAt: subscription.lastSyncErrorAt?.toISOString?.() || subscription.lastSyncErrorAt || null,
      trialEndsAt: subscription.trialEndsAt?.toISOString?.() || subscription.trialEndsAt || null,
      startedAt: subscription.startedAt?.toISOString?.() || subscription.startedAt || null,
      updatedAt: subscription.updatedAt?.toISOString?.() || subscription.updatedAt || null,
    } : null,
  };
}

export { getQuotaDecisionFromUsage };
