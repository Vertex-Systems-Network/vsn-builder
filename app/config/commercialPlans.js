export const PLAN_ORDER = Object.freeze(["core", "pro", "cro", "agency"]);

export const COMMERCIAL_PLANS = Object.freeze({
  core: Object.freeze({
    key: "core",
    publicKey: "free",
    name: "Free",
    label: "Free",
    badge: "Free",
    shopifyHandle: "free",
    description: "A complete visual builder foundation for a single growing storefront.",
    maxPages: 5,
    templateQuota: 10,
    aiMonthly: 20,
    croExperiments: 0,
    collaboration: false,
    teamMembers: 1,
    enterpriseControls: false,
    forms: true,
    globalLibrary: false,
    backups: false,
    localization: true,
    developerSdk: false,
    marketplacePro: false,
    allWidgets: true,
  }),
  pro: Object.freeze({
    key: "pro",
    publicKey: "silver",
    name: "Silver",
    label: "Silver",
    badge: "Most stores",
    shopifyHandle: "sliver",
    description: "More pages, reusable assets and AI capacity for serious storefront production.",
    maxPages: 100,
    templateQuota: 100,
    aiMonthly: 500,
    croExperiments: 0,
    collaboration: true,
    teamMembers: 3,
    enterpriseControls: false,
    forms: true,
    globalLibrary: true,
    backups: true,
    localization: true,
    developerSdk: true,
    marketplacePro: true,
    allWidgets: true,
  }),
  cro: Object.freeze({
    key: "cro",
    publicKey: "gold",
    name: "Gold",
    label: "Gold",
    badge: "Conversion",
    shopifyHandle: "gold",
    description: "Experimentation, conversion workflows and higher AI/template limits for optimization teams.",
    maxPages: 500,
    templateQuota: 300,
    aiMonthly: 1500,
    croExperiments: 25,
    collaboration: true,
    teamMembers: 10,
    enterpriseControls: false,
    forms: true,
    globalLibrary: true,
    backups: true,
    localization: true,
    developerSdk: true,
    marketplacePro: true,
    allWidgets: true,
  }),
  agency: Object.freeze({
    key: "agency",
    publicKey: "platinum",
    name: "Platinum",
    label: "Platinum",
    badge: "Scale",
    shopifyHandle: "platenium",
    description: "High-volume collaboration, unlimited experiments/templates and enterprise safeguards.",
    maxPages: 5000,
    templateQuota: -1,
    aiMonthly: 5000,
    croExperiments: -1,
    collaboration: true,
    teamMembers: 50,
    enterpriseControls: true,
    forms: true,
    globalLibrary: true,
    backups: true,
    localization: true,
    developerSdk: true,
    marketplacePro: true,
    allWidgets: true,
  }),
});

export const PLAN_ALIASES = Object.freeze({
  free: "core",
  silver: "pro",
  sliver: "pro",
  gold: "cro",
  platinum: "agency",
  platenium: "agency",
  business: "agency",
  enterprise: "agency",
});

export const PUBLIC_PLAN_KEY_BY_INTERNAL = Object.freeze(Object.fromEntries(
  PLAN_ORDER.map((key) => [key, COMMERCIAL_PLANS[key].publicKey]),
));

export function normalizePlanKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (COMMERCIAL_PLANS[raw]) return raw;
  return PLAN_ALIASES[raw] || "core";
}

export function publicPlanName(value) {
  return COMMERCIAL_PLANS[normalizePlanKey(value)]?.name || "Free";
}

export function publicPlanKey(value) {
  return COMMERCIAL_PLANS[normalizePlanKey(value)]?.publicKey || "free";
}

export function planRank(value) {
  return PLAN_ORDER.indexOf(normalizePlanKey(value));
}

export function planAtLeast(planOrKey, requiredKey) {
  const current = typeof planOrKey === "object" ? planOrKey?.key : planOrKey;
  return planRank(current) >= planRank(requiredKey);
}

export function quotaLabel(value, suffix = "") {
  const number = Number(value);
  if (number < 0) return "Unlimited";
  return `${number.toLocaleString()}${suffix}`;
}

export const PLAN_FEATURE_ROWS = Object.freeze([
  Object.freeze({ key: "allWidgets", label: "All builder widgets", format: () => "Included on every plan" }),
  Object.freeze({ key: "maxPages", label: "Builder pages & templates", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "templateQuota", label: "Marketplace installs", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "aiMonthly", label: "AI generations / month", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "croExperiments", label: "Active CRO experiments", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "collaboration", label: "Collaboration & review", format: (value) => value ? "Included" : "Single-user workflow" }),
  Object.freeze({ key: "teamMembers", label: "Active collaboration seats", format: (value) => quotaLabel(value) }),
  Object.freeze({ key: "enterpriseControls", label: "Enterprise hardening controls", format: (value) => value ? "Included" : "Not included" }),
]);
