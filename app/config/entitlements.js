export const ENTITLEMENT_VERSION = 3;

export const ENTITLEMENT_FEATURES = Object.freeze({
  collaboration: Object.freeze({ key: "collaboration", planField: "collaboration", label: "Collaboration & review", requiredPlan: "silver" }),
  croExperiments: Object.freeze({ key: "croExperiments", planField: "croExperiments", label: "CRO Experiments", requiredPlan: "gold" }),
  marketplacePro: Object.freeze({ key: "marketplacePro", planField: "marketplacePro", label: "Pro Marketplace content", requiredPlan: "silver" }),
  globalLibrary: Object.freeze({ key: "globalLibrary", planField: "globalLibrary", label: "Global Library", requiredPlan: "silver" }),
  backups: Object.freeze({ key: "backups", planField: "backups", label: "Backup & restore", requiredPlan: "solo" }),
  developerSdk: Object.freeze({ key: "developerSdk", planField: "developerSdk", label: "Developer SDK", requiredPlan: "business" }),
  enterpriseControls: Object.freeze({ key: "enterpriseControls", planField: "enterpriseControls", label: "Enterprise hardening controls", requiredPlan: "platinum" }),
  localization: Object.freeze({ key: "localization", planField: "localization", label: "Localization & Shopify Markets", requiredPlan: "starter" }),
  forms: Object.freeze({ key: "forms", planField: "forms", label: "Forms & automation", requiredPlan: "starter" }),
});

export const ENTITLEMENT_QUOTAS = Object.freeze({
  pages: Object.freeze({ key: "pages", planField: "maxPages", label: "builder pages/templates", requiredPlan: "starter", reset: "none" }),
  marketplaceInstalls: Object.freeze({ key: "marketplaceInstalls", planField: "templateQuota", label: "Marketplace installs", requiredPlan: "starter", reset: "none" }),
  aiGenerations: Object.freeze({ key: "aiGenerations", planField: "aiMonthly", label: "AI generations this month", requiredPlan: "starter", reset: "monthly" }),
  croExperiments: Object.freeze({ key: "croExperiments", planField: "croExperiments", label: "active CRO experiments", requiredPlan: "gold", reset: "none" }),
  collaborationSeats: Object.freeze({ key: "collaborationSeats", planField: "teamMembers", label: "collaboration seats", requiredPlan: "silver", reset: "none" }),
});

export function getEntitlementFeatureDefinition(key) {
  return ENTITLEMENT_FEATURES[String(key || "")] || null;
}

export function getEntitlementQuotaDefinition(key) {
  return ENTITLEMENT_QUOTAS[String(key || "")] || null;
}
