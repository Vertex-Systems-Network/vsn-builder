export const ENTITLEMENT_VERSION = 2;

export const ENTITLEMENT_FEATURES = Object.freeze({
  collaboration: Object.freeze({ key: "collaboration", planField: "collaboration", label: "Collaboration & review", requiredPlan: "pro" }),
  croExperiments: Object.freeze({ key: "croExperiments", planField: "croExperiments", label: "CRO Experiments", requiredPlan: "cro" }),
  marketplacePro: Object.freeze({ key: "marketplacePro", planField: "marketplacePro", label: "Pro Marketplace content", requiredPlan: "pro" }),
  globalLibrary: Object.freeze({ key: "globalLibrary", planField: "globalLibrary", label: "Global Library", requiredPlan: "pro" }),
  backups: Object.freeze({ key: "backups", planField: "backups", label: "Backup & restore", requiredPlan: "pro" }),
  developerSdk: Object.freeze({ key: "developerSdk", planField: "developerSdk", label: "Developer SDK", requiredPlan: "pro" }),
  enterpriseControls: Object.freeze({ key: "enterpriseControls", planField: "enterpriseControls", label: "Enterprise hardening controls", requiredPlan: "agency" }),
  localization: Object.freeze({ key: "localization", planField: "localization", label: "Localization & Shopify Markets", requiredPlan: "core" }),
  forms: Object.freeze({ key: "forms", planField: "forms", label: "Forms & automation", requiredPlan: "core" }),
});

export const ENTITLEMENT_QUOTAS = Object.freeze({
  pages: Object.freeze({ key: "pages", planField: "maxPages", label: "builder pages/templates", requiredPlan: "core", reset: "none" }),
  marketplaceInstalls: Object.freeze({ key: "marketplaceInstalls", planField: "templateQuota", label: "Marketplace installs", requiredPlan: "core", reset: "none" }),
  aiGenerations: Object.freeze({ key: "aiGenerations", planField: "aiMonthly", label: "AI generations this month", requiredPlan: "core", reset: "monthly" }),
  croExperiments: Object.freeze({ key: "croExperiments", planField: "croExperiments", label: "active CRO experiments", requiredPlan: "cro", reset: "none" }),
  collaborationSeats: Object.freeze({ key: "collaborationSeats", planField: "teamMembers", label: "collaboration seats", requiredPlan: "pro", reset: "none" }),
});

export function getEntitlementFeatureDefinition(key) {
  return ENTITLEMENT_FEATURES[String(key || "")] || null;
}

export function getEntitlementQuotaDefinition(key) {
  return ENTITLEMENT_QUOTAS[String(key || "")] || null;
}
