// Shopify App Pricing IDs are the merchant-facing plan names. Retired IDs are
// retained only as input aliases so an old verified subscription can migrate.
export const PLAN_ORDER = Object.freeze([
  "starter", "solo", "silver", "gold", "business", "platinum", "agency", "scale",
]);
export const PAID_TRIAL_DAYS = 10;

const shared = {
  forms: true,
  localization: true,
  allWidgets: true,
};

const plans = {
  starter: Object.freeze({
    ...shared, key: "starter", publicKey: "starter", name: "Starter", label: "Starter",
    badge: "Get started", shopifyHandle: "starter", monthlyUsd: 30, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Core visual building for a single Shopify storefront.",
    maxPages: 5, templateQuota: 10, aiMonthly: 20, croExperiments: 0,
    collaboration: false, teamMembers: 1, enterpriseControls: false,
    globalLibrary: false, backups: false, developerSdk: false, marketplacePro: false,
  }),
  solo: Object.freeze({
    ...shared, key: "solo", publicKey: "solo", name: "Solo", label: "Solo",
    badge: "Independent builders", shopifyHandle: "solo", monthlyUsd: 60, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "More room for a growing storefront managed by one person.",
    maxPages: 25, templateQuota: 30, aiMonthly: 100, croExperiments: 0,
    collaboration: false, teamMembers: 1, enterpriseControls: false,
    globalLibrary: false, backups: true, developerSdk: false, marketplacePro: false,
  }),
  silver: Object.freeze({
    ...shared, key: "silver", publicKey: "silver", name: "Silver", label: "Silver",
    badge: "Growing stores", shopifyHandle: "silver", monthlyUsd: 100, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Reusable content and collaboration for growing teams.",
    maxPages: 100, templateQuota: 100, aiMonthly: 500, croExperiments: 0,
    collaboration: true, teamMembers: 3, enterpriseControls: false,
    globalLibrary: true, backups: true, developerSdk: false, marketplacePro: true,
  }),
  gold: Object.freeze({
    ...shared, key: "gold", publicKey: "gold", name: "Gold", label: "Gold",
    badge: "Conversion", shopifyHandle: "gold", monthlyUsd: 150, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Run conversion experiments and optimize storefront journeys.",
    maxPages: 500, templateQuota: 300, aiMonthly: 1500, croExperiments: 25,
    collaboration: true, teamMembers: 10, enterpriseControls: false,
    globalLibrary: true, backups: true, developerSdk: false, marketplacePro: true,
  }),
  business: Object.freeze({
    ...shared, key: "business", publicKey: "business", name: "Business", label: "Business",
    badge: "Advanced operations", shopifyHandle: "business", monthlyUsd: 250, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Higher capacity and developer workflows for established teams.",
    maxPages: 1500, templateQuota: 1000, aiMonthly: 3000, croExperiments: 100,
    collaboration: true, teamMembers: 20, enterpriseControls: false,
    globalLibrary: true, backups: true, developerSdk: true, marketplacePro: true,
  }),
  platinum: Object.freeze({
    ...shared, key: "platinum", publicKey: "platinum", name: "Platinum", label: "Platinum",
    badge: "Scale", shopifyHandle: "platinum", monthlyUsd: 350, annualUsd: 3000,
    trialDays: PAID_TRIAL_DAYS, description: "High-volume production with enterprise safeguards.",
    maxPages: 5000, templateQuota: -1, aiMonthly: 5000, croExperiments: -1,
    collaboration: true, teamMembers: 50, enterpriseControls: true,
    globalLibrary: true, backups: true, developerSdk: true, marketplacePro: true,
  }),
  agency: Object.freeze({
    ...shared, key: "agency", publicKey: "agency", name: "Agency", label: "Agency",
    badge: "Agency teams", shopifyHandle: "agency", monthlyUsd: 600, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Large production capacity for agency-sized teams.",
    maxPages: 10000, templateQuota: -1, aiMonthly: 10000, croExperiments: -1,
    collaboration: true, teamMembers: 100, enterpriseControls: true,
    globalLibrary: true, backups: true, developerSdk: true, marketplacePro: true,
  }),
  scale: Object.freeze({
    ...shared, key: "scale", publicKey: "scale", name: "Scale", label: "Scale",
    badge: "Maximum capacity", shopifyHandle: "scale", monthlyUsd: 1000, annualUsd: null,
    trialDays: PAID_TRIAL_DAYS, description: "Maximum capacity for high-volume storefront operations.",
    maxPages: 25000, templateQuota: -1, aiMonthly: 25000, croExperiments: -1,
    collaboration: true, teamMembers: 250, enterpriseControls: true,
    globalLibrary: true, backups: true, developerSdk: true, marketplacePro: true,
  }),
};

// Historical internal keys and the retired public `sliver` handle remain
// readable during migration. They never create an extra plan or a Free tier.
for (const [legacy, canonical] of Object.entries({
  core: "starter", pro: "silver", cro: "gold", platenium: "platinum",
  sliver: "silver", enterprise: "scale",
})) Object.defineProperty(plans, legacy, { value: plans[canonical], enumerable: false });

export const COMMERCIAL_PLANS = Object.freeze(plans);

// No active Shopify subscription means every capability and quota is disabled.
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
  starter: "starter", solo: "solo", silver: "silver", sliver: "silver",
  gold: "gold", business: "business", platinum: "platinum", platenium: "platinum",
  agency: "agency", scale: "scale", core: "starter", pro: "silver", cro: "gold",
  // Persisted subscriptions still require a matching verified Shopify handle;
  // a legacy database key by itself never grants paid access.
  enterprise: "scale", free: "inactive", inactive: "inactive",
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
  Object.freeze({ key: "allWidgets", label: "All builder widgets", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "maxPages", label: "Saved builder pages", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "templateQuota", label: "Marketplace installs", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "aiMonthly", label: "AI generations / month", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "croExperiments", label: "Active CRO experiments", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "teamMembers", label: "Collaboration seats", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "collaboration", label: "Collaboration & review", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "marketplacePro", label: "Pro Marketplace content", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "globalLibrary", label: "Global Library", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "backups", label: "Backup & restore", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "developerSdk", label: "Developer SDK", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "localization", label: "Localization & Shopify Markets", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "forms", label: "Forms & automation", format: (value) => value ? "Included" : "Not included" }),
  Object.freeze({ key: "enterpriseControls", label: "Enterprise hardening", format: (value) => value ? "Included" : "Not included" }),
]);
