import { COMMERCIAL_PLANS, normalizePlanKey, planRank, publicPlanName } from "./commercialPlans.js";

export const BILLING_STATUS_META = Object.freeze({
  active: Object.freeze({ label: "Active", tone: "success" }),
  trialing: Object.freeze({ label: "Trial", tone: "info" }),
  canceling: Object.freeze({ label: "Cancellation scheduled", tone: "warning" }),
  frozen: Object.freeze({ label: "Frozen", tone: "critical" }),
  canceled: Object.freeze({ label: "Canceled", tone: "critical" }),
  inactive: Object.freeze({ label: "No active subscription", tone: "neutral" }),
  local: Object.freeze({ label: "Developer simulation", tone: "neutral" }),
});

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function humanBillingPeriod(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "Not reported";
  if (raw === "EVERY_30_DAYS") return "Every 30 days";
  if (raw === "ANNUAL") return "Annual";
  return raw.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

export function billingStatusMeta(value, developerMode = false) {
  if (developerMode) return BILLING_STATUS_META.local;
  return BILLING_STATUS_META[String(value || "inactive").toLowerCase()] || BILLING_STATUS_META.inactive;
}

export function buildBillingLifecycle(plan, { now = new Date() } = {}) {
  const currentKey = normalizePlanKey(plan?.key);
  const subscription = plan?.subscription || null;
  const developerMode = Boolean(plan?.developerMode);
  const status = developerMode ? "local" : String(subscription?.status || "inactive").toLowerCase();
  const statusMeta = billingStatusMeta(status, developerMode);
  const pendingKey = subscription?.pendingPlanKey ? normalizePlanKey(subscription.pendingPlanKey) : null;
  const currentRank = planRank(currentKey);
  const pendingRank = pendingKey ? planRank(pendingKey) : -1;
  let pendingKind = null;
  if (pendingKey) {
    pendingKind = pendingRank > currentRank ? "upgrade" : pendingRank < currentRank ? "downgrade" : "plan-update";
  }
  if (subscription?.cancelAtEndOfCycle && (!pendingKey || pendingKey === "core")) pendingKind = "cancellation";

  const trialEndsAt = safeDate(subscription?.trialEndsAt);
  const currentCycleStart = safeDate(subscription?.currentCycleStart);
  const currentCycleEnd = safeDate(subscription?.currentCycleEnd);
  const cancelEffectiveOn = safeDate(subscription?.cancelEffectiveOn);
  const verifiedAt = safeDate(subscription?.verifiedAt);
  const lastSyncAt = safeDate(subscription?.lastSyncAt);
  const lastSyncErrorAt = safeDate(subscription?.lastSyncErrorAt);
  const nowDate = safeDate(now) || new Date();
  const trialDaysRemaining = trialEndsAt && trialEndsAt > nowDate
    ? Math.max(1, Math.ceil((trialEndsAt.getTime() - nowDate.getTime()) / 86400000))
    : 0;

  return {
    currentKey,
    currentName: COMMERCIAL_PLANS[currentKey]?.name || publicPlanName(currentKey),
    status,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    verified: Boolean(subscription?.verifiedAt && plan?.entitlementVerified),
    billingPeriod: subscription?.billingPeriod || null,
    billingPeriodLabel: humanBillingPeriod(subscription?.billingPeriod),
    trialEndsAt: trialEndsAt?.toISOString() || null,
    trialDaysRemaining,
    currentCycleStart: currentCycleStart?.toISOString() || null,
    currentCycleEnd: currentCycleEnd?.toISOString() || null,
    cancelAtEndOfCycle: Boolean(subscription?.cancelAtEndOfCycle),
    cancelEffectiveOn: cancelEffectiveOn?.toISOString() || null,
    pendingKey,
    pendingName: pendingKey ? publicPlanName(pendingKey) : null,
    pendingHandle: subscription?.pendingPlanHandle || null,
    pendingBillingPeriod: subscription?.pendingBillingPeriod || null,
    pendingBillingPeriodLabel: subscription?.pendingBillingPeriod ? humanBillingPeriod(subscription.pendingBillingPeriod) : null,
    pendingKind,
    verifiedAt: verifiedAt?.toISOString() || null,
    lastSyncAt: lastSyncAt?.toISOString() || null,
    lastSyncError: subscription?.lastSyncError || null,
    lastSyncErrorAt: lastSyncErrorAt?.toISOString() || null,
    provider: subscription?.provider || null,
    planHandle: subscription?.planHandle || null,
    developerMode,
  };
}
