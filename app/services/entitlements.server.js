import { COMMERCIAL_PLANS, normalizePlanKey, planAtLeast } from "../config/commercialPlans.js";
import { ENTITLEMENT_FEATURES, ENTITLEMENT_QUOTAS, ENTITLEMENT_VERSION, getEntitlementFeatureDefinition, getEntitlementQuotaDefinition } from "../config/entitlements.js";
import { subscriptionMirrorIsTrusted } from "./shopify-subscription.server.js";

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthReset(now = new Date()) {
  const start = monthStart(now);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

function parseObject(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function numericLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function planSupportsFeature(plan, definition) {
  const value = plan?.[definition.planField];
  if (typeof value === "number") return value < 0 || value > 0;
  return Boolean(value);
}

function remainingFor(limit, used) {
  if (limit < 0) return null;
  return Math.max(0, limit - Math.max(0, Number(used || 0)));
}

export class EntitlementDeniedError extends Error {
  constructor(message, decision) {
    super(message);
    this.name = "EntitlementDeniedError";
    this.status = 403;
    this.code = decision?.code || "VSN_ENTITLEMENT_DENIED";
    this.decision = decision || null;
  }
}

export async function resolveEntitlementPlan(db, shop, { now = new Date() } = {}) {
  const row = await db.builderSubscription.findUnique({ where: { shop } }).catch(() => null);
  const developerMode = process.env.NODE_ENV !== "production";
  const configuredDefault = process.env.VSN_DEFAULT_PLAN ? normalizePlanKey(process.env.VSN_DEFAULT_PLAN) : null;
  const developerActive = developerMode && row?.status === "active";
  const mirrorTrusted = !developerMode && subscriptionMirrorIsTrusted(row, now);
  const verifiedPaidState = mirrorTrusted && ["active", "trialing", "canceling"].includes(String(row?.status || ""));

  let key = "core";
  let source = "production-core-fallback";
  let entitlementVerified = false;

  if (developerMode) {
    key = developerActive ? normalizePlanKey(row.planKey) : (configuredDefault || "agency");
    source = developerActive ? "developer-simulation" : configuredDefault ? "developer-default" : "developer-agency-default";
    entitlementVerified = developerActive;
  } else if (verifiedPaidState) {
    key = normalizePlanKey(row.planKey);
    source = "shopify-verified";
    entitlementVerified = true;
  } else {
    // Production must fail closed. VSN_DEFAULT_PLAN is intentionally ignored here;
    // a server environment variable can never grant a paid merchant entitlement.
    key = "core";
    source = mirrorTrusted ? "shopify-verified-core" : "production-core-fallback";
    entitlementVerified = mirrorTrusted;
  }

  return {
    ...COMMERCIAL_PLANS[key],
    key,
    subscription: row || null,
    entitlementVerified,
    entitlementSource: source,
    subscriptionMirrorTrusted: mirrorTrusted,
    developerMode,
  };
}

async function usageForQuota(db, shop, quotaKey, now = new Date()) {
  switch (quotaKey) {
    case "pages":
      return db.builderPage.count({ where: { shop, deletedAt: null } }).catch(() => 0);
    case "marketplaceInstalls":
      return db.builderMarketplaceInstall.count({ where: { shop } }).catch(() => 0);
    case "aiGenerations": {
      const start = monthStart(now);
      return db.builderAiUsage.count({ where: { shop, createdAt: { gte: start }, status: "completed" } }).catch(() => 0);
    }
    case "croExperiments":
      return db.builderExperiment.count({ where: { shop, status: { in: ["draft", "running", "paused"] } } }).catch(() => 0);
    case "collaborationSeats": {
      const setting = await db.builderShopSetting.findUnique({ where: { shop }, select: { collaborationRolesJson: true } }).catch(() => null);
      const assignments = parseObject(setting?.collaborationRolesJson);
      // The store owner is always a seat. Assigned actors are stable seats; transient
      // presence is deliberately not used for commercial enforcement.
      return 1 + Object.keys(assignments).filter(Boolean).length;
    }
    default:
      throw new Error(`Unknown entitlement quota: ${quotaKey}`);
  }
}

export async function getEntitlementUsage(db, shop, { quotaKeys = Object.keys(ENTITLEMENT_QUOTAS), now = new Date() } = {}) {
  const unique = [...new Set((quotaKeys || []).filter((key) => getEntitlementQuotaDefinition(key)))];
  const rows = await Promise.all(unique.map(async (key) => [key, await usageForQuota(db, shop, key, now)]));
  return Object.fromEntries(rows);
}

export function getFeatureDecisionFromPlan(plan, featureKey) {
  const definition = getEntitlementFeatureDefinition(featureKey);
  if (!definition) throw new Error(`Unknown entitlement feature: ${featureKey}`);
  const allowed = planSupportsFeature(plan, definition);
  return {
    type: "feature",
    key: definition.key,
    label: definition.label,
    allowed,
    code: allowed ? "VSN_ENTITLEMENT_ALLOWED" : "VSN_FEATURE_NOT_INCLUDED",
    requiredPlan: definition.requiredPlan,
    planKey: plan?.key || "core",
    planName: plan?.name || "Free",
    source: plan?.entitlementSource || "unknown",
    verified: Boolean(plan?.entitlementVerified),
    message: allowed ? null : `${definition.label} is not included in the ${plan?.name || "current"} plan. Choose ${COMMERCIAL_PLANS[normalizePlanKey(definition.requiredPlan)]?.name || definition.requiredPlan} or higher in Plans & License.`,
  };
}

export function getQuotaDecisionFromUsage(plan, quotaKey, used, { extra = 1, resetAt = null } = {}) {
  const definition = getEntitlementQuotaDefinition(quotaKey);
  if (!definition) throw new Error(`Unknown entitlement quota: ${quotaKey}`);
  const limit = numericLimit(plan?.[definition.planField]);
  const normalizedUsed = Math.max(0, Number(used || 0));
  const normalizedExtra = Math.max(0, Number(extra || 0));
  const unlimited = limit < 0;
  const allowed = unlimited || normalizedUsed + normalizedExtra <= limit;
  const unavailable = limit === 0;
  const planName = plan?.name || "Free";
  const requiredPlanName = COMMERCIAL_PLANS[normalizePlanKey(definition.requiredPlan)]?.name || definition.requiredPlan;
  const message = allowed ? null : unavailable
    ? `${definition.label.replace(/^./, (c) => c.toUpperCase())} are not included in the ${planName} plan. Choose ${requiredPlanName} or higher in Plans & License.`
    : `${planName} includes ${limit} ${definition.label}. Current usage is ${normalizedUsed}. Reduce usage or choose a higher plan in Plans & License.`;
  return {
    type: "quota",
    key: definition.key,
    label: definition.label,
    allowed,
    code: allowed ? "VSN_ENTITLEMENT_ALLOWED" : unavailable ? "VSN_QUOTA_NOT_INCLUDED" : "VSN_QUOTA_EXCEEDED",
    requiredPlan: definition.requiredPlan,
    planKey: plan?.key || "core",
    planName,
    source: plan?.entitlementSource || "unknown",
    verified: Boolean(plan?.entitlementVerified),
    used: normalizedUsed,
    extra: normalizedExtra,
    limit,
    unlimited,
    remaining: remainingFor(limit, normalizedUsed),
    reset: definition.reset,
    resetAt,
    message,
  };
}

export function getMinimumPlanDecisionFromPlan(plan, requiredPlan = "core", { label = "This feature" } = {}) {
  const normalizedRequired = normalizePlanKey(requiredPlan);
  const allowed = planAtLeast(plan, normalizedRequired);
  const requiredPlanName = COMMERCIAL_PLANS[normalizedRequired]?.name || normalizedRequired;
  return {
    type: "minimum-plan",
    key: normalizedRequired,
    label,
    allowed,
    code: allowed ? "VSN_ENTITLEMENT_ALLOWED" : "VSN_PLAN_TIER_REQUIRED",
    requiredPlan: normalizedRequired,
    planKey: plan?.key || "core",
    planName: plan?.name || "Free",
    source: plan?.entitlementSource || "unknown",
    verified: Boolean(plan?.entitlementVerified),
    message: allowed ? null : `${label} requires ${requiredPlanName} or higher. Current plan: ${plan?.name || "Free"}.`,
  };
}

export async function getMinimumPlanDecision(db, shop, requiredPlan = "core", options = {}) {
  const plan = options.plan || await resolveEntitlementPlan(db, shop, options);
  return getMinimumPlanDecisionFromPlan(plan, requiredPlan, options);
}

export async function getFeatureDecision(db, shop, featureKey, options = {}) {
  const plan = options.plan || await resolveEntitlementPlan(db, shop, options);
  return getFeatureDecisionFromPlan(plan, featureKey);
}

export async function getQuotaDecision(db, shop, quotaKey, { plan = null, used = undefined, extra = 1, now = new Date() } = {}) {
  const resolvedPlan = plan || await resolveEntitlementPlan(db, shop, { now });
  const resolvedUsed = used === undefined ? await usageForQuota(db, shop, quotaKey, now) : Number(used || 0);
  const definition = getEntitlementQuotaDefinition(quotaKey);
  const resetAt = definition?.reset === "monthly" ? monthReset(now).toISOString() : null;
  return getQuotaDecisionFromUsage(resolvedPlan, quotaKey, resolvedUsed, { extra, resetAt });
}

export async function requireEntitlementFeature(db, shop, featureKey, options = {}) {
  const decision = await getFeatureDecision(db, shop, featureKey, options);
  if (!decision.allowed) throw new EntitlementDeniedError(decision.message, decision);
  return decision;
}

export async function requireEntitlementQuota(db, shop, quotaKey, options = {}) {
  const decision = await getQuotaDecision(db, shop, quotaKey, options);
  if (!decision.allowed) throw new EntitlementDeniedError(decision.message, decision);
  return decision;
}

export async function getEntitlementSnapshot(db, shop, { now = new Date(), quotaKeys = Object.keys(ENTITLEMENT_QUOTAS) } = {}) {
  const plan = await resolveEntitlementPlan(db, shop, { now });
  const usage = await getEntitlementUsage(db, shop, { quotaKeys, now });
  const features = Object.fromEntries(Object.keys(ENTITLEMENT_FEATURES).map((key) => [key, getFeatureDecisionFromPlan(plan, key)]));
  const quotas = {};
  for (const key of quotaKeys) {
    if (!getEntitlementQuotaDefinition(key)) continue;
    quotas[key] = getQuotaDecisionFromUsage(plan, key, usage[key] || 0, {
      extra: 0,
      resetAt: getEntitlementQuotaDefinition(key).reset === "monthly" ? monthReset(now).toISOString() : null,
    });
  }
  return {
    version: ENTITLEMENT_VERSION,
    source: plan.entitlementSource,
    verified: Boolean(plan.entitlementVerified),
    developerMode: Boolean(plan.developerMode),
    plan,
    features,
    quotas,
  };
}

export function serializeEntitlementSnapshot(snapshot) {
  if (!snapshot) return null;
  const { plan, ...rest } = snapshot;
  const subscription = plan?.subscription;
  return {
    ...rest,
    plan: plan ? {
      ...Object.fromEntries(Object.entries(plan).filter(([key]) => !["subscription", "subscriptionMirrorTrusted"].includes(key))),
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
      } : null,
    } : null,
  };
}
