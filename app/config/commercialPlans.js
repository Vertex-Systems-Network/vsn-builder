// Public Shopify App Pricing IDs are the merchant-facing plan names.
// Legacy database IDs are read-only aliases; they are not public plans.
export const PLAN_ORDER = Object.freeze(["starter", "sliver", "gold", "platinum"]);
export const PAID_TRIAL_DAYS = 10;

const plans = {
  starter: Object.freeze({
    key: "starter", publicKey: "starter", name: "Starter", label: "Starter",
    badge: "Get started", shopifyHandle: "starter",
    monthlyUsd: 30, annualUsd: null, trialDays: PAID_TRIAL_DAYS,
    description: "Essential visual Shopify page building for one storefront.",
    maxPages: 5, templateQuota: 10, aiMonthly: 20, croExperiments: 0,
    collaboration: false, teamMembers: 1, enterpriseControls: false,
    forms: true, globalLibrary: false, backups: false, localization: true,
    developerSdk: false, marketplacePro: false, allWidgets: true,
  }),
  sliver: Object.freeze({
    key: "sliver", publicKey: "sliver", name: "Sliver", label: "Sliver",
    badge: "Growing stores", shopifyHandle: "sliver",
    monthlyUsd: 100, annualUsd: null, trialDays: PAID_TRIAL_DAYS,
    description: "More pages, reusable assets and AI capacity for serious storefront production.",
    maxPages: 100, templateQuota: 100, aiMonthly: 500, croExperiments: 0,
    collaboration: true, teamMembers: 3, enterpriseControls: false,
    forms: true, globalLibrary: true, backups: true, localization: true,
    developerSdk: true, marketplacePro: true, allWidgets: true,
  }),
  gold: Object.freeze({
    key: "gold", publicKey: "gold", name: "Gold", label: "Gold",
    badge: "Conversion", shopifyHandle: "gold",
    monthlyUsd: 150, annualUsd: null, trialDays: PAID_TRIAL_DAYS,
    description: "Experimentation and conversion workflows for optimization teams.",
    maxPages: 500, templateQuota: 300, aiMonthly: 1500, croExperiments: 25,
    collaboration: true, teamMembers: 10, enterpriseControls: false,
    forms: true, globalLibrary: true, backups: true, localization: true,
    developerSdk: true, marketplacePro: true, allWidgets: true,
  }),
  platinum: Object.freeze({
    key: "platinum", publicKey: "platinum", name: "Platinum", label: "Platinum",
    badge: "Scale", shopifyHandle: "platinum",
    monthlyUsd: 350, annualUsd: 3000, trialDays: PAID_TRIAL_DAYS,
    description: "High-volume collaboration, experiments and enterprise safeguards.",
    maxPages: 5000, templateQuota: -1, aiMonthly: 5000, croExperiments: -1,
    collaboration: true, teamMembers: 50, enterpriseControls: true,
    forms: true, globalLibrary: true, backups: true, localization: true,
    developerSdk: true, marketplacePro: true, allWidgets: true,
  }),
};

// Transitional property lookups for legacy code. They are non-enumerable, so
// Partner Dashboard, pricing UI and PLAN_ORDER expose only the 4 paid IDs.
for (const [legacy, canonical] of Object.entries({
  core: "starter", pro: "sliver", cro: "gold", agency: "platinum",
})) Object.defineProperty(plans, legacy, { value: plans[canonical], enumerable: false });

export const COMMERCIAL_PLANS = Object.freeze(plans);

// Not a public plan. No merchant functionality or quota may be granted until
// Shopify verifies an active/trialing/canceling paid subscription.
export const UNSUBSCRIBED_PLAN = Object.freeze({
  key: "inactive", publicKey: "inactive", name: "No active subscription",
  label: "No active subscription", badge: "Select a plan",
  shopifyHandle: null, monthlyUsd: null, annualUsd: null, trialDays: 0,
  maxPages: 0, templateQuota: 0, aiMonthly: 0, croExperiments: 0,
  collaboration: false, teamMembers: 0, enterpriseControls: false,
  forms: false, globalLibrary: false, backups: false, localization: false,
  developerSdk: false, marketplacePro: false, allWidgets: false,
});

export const PLAN_ALIASES = Object.freeze({
  starter: "starter", sliver: "sliver", silver: "sliver",
  gold: "gold", platinum: "platinum", platenium: "platinum",
  // Historical internal keys, stored only by previous VSN versions.
  core: "starter", pro: "sliver", cro: "gold", agency: "platinum",
  business: "platinum", enterprise: "platinum",
  // A retired Free handle must NEVER be interpreted as a paid Starter plan.
  free: "inactive", inactive: "inactive",
});

export const PUBLIC_PLAN_KEY_BY_INTERNAL = Object.freeze(Object.fromEntries(
  PLAN_ORDER.map((key) => [key, COMMERCIAL_PLANS[key].publicKey]),
));

export function normalizePlanKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  return PLAN_ALIASES[raw] || "inactive";
}

export function publicPlanName(value) {
  const key = normalizePlanKey(value);
  return COMMERCIAL_PLANS[key]?.name || UNSUBSCRIBED_PLAN.name;
}

export function publicPlanKey(value) {
  const key = normalizePlanKey(value);
  return COMMERCIAL_PLANS[key]?.publicKey || "inactive";
}

export function planRank(value) {
  return PLAN_ORDER.indexOf(normalizePlanKey(value));
}

export function planAtLeast(planOrKey, requiredKey) {
  const current = typeof planOrKey === "object" ? planOrKey?.key : planOrKey;
  const currentRank = planRank(current), requiredRank = planRank(requiredKey);
  return currentRank >= 0 && requiredRank >= 0 && currentRank >= requiredRank;
}

export function quotaLabel(value, suffix = "") {
  const number = Number(value);
  if (number < 0) return "Unlimited";
  return `${number.toLocaleString()}${suffix}`;
}

export const PLAN_FEATURE_ROWS = Object.freeze([
  Object.freeze({ key: "allWidgets", label: "All builder widgets", format: () => "Included on an active plan" }),
  Object.freeze({ key: "maxPages", label: "Builder pages & templates", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "templateQuota", label: "Marketplace installs", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "aiMonthly", label: "AI generations / month", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "croExperiments", label: "Active CRO experiments", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "collaboration", label: "Collaboration & review", format: (value) => value ? "Included" : "Single-user workflow" }),
  Object.freeze({ key: "teamMembers", label: "Active collaboration seats", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "enterpriseControls", label: "Enterprise hardening controls", format: (value) => value ? "Included" : "Not included" }),
]);
