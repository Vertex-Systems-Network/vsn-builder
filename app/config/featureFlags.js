/**
 * Central feature flag contract. Experimental systems are OFF by default so
 * disabling a flag always preserves the last stable production behaviour.
 */
export const FEATURE_FLAGS = Object.freeze({
  nativeSectionBridge: Object.freeze({ env: "VSN_FEATURE_NATIVE_SECTION_BRIDGE", defaultValue: false, phase: 2 }),
  liveShopifyE2EHooks: Object.freeze({ env: "VSN_FEATURE_LIVE_E2E_HOOKS", defaultValue: false, phase: 1 }),
  queryBuilderV2: Object.freeze({ env: "VSN_FEATURE_QUERY_BUILDER_V2", defaultValue: false, phase: 3 }),
  componentVariants: Object.freeze({ env: "VSN_FEATURE_COMPONENT_VARIANTS", defaultValue: false, phase: 4 }),
  responsiveEngineV2: Object.freeze({ env: "VSN_FEATURE_RESPONSIVE_V2", defaultValue: false, phase: 5 }),
  aiBuilderV1: Object.freeze({ env: "VSN_FEATURE_AI_BUILDER", defaultValue: false, phase: 9 }),
  agentContextToolsV1: Object.freeze({ env: "VSN_FEATURE_AI_AGENT_CONTEXT_TOOLS", defaultValue: false, phase: 9 }),
  referenceFidelityV1: Object.freeze({ env: "VSN_FEATURE_REFERENCE_FIDELITY", defaultValue: false, phase: 9 }),
  qualityFixPlanningV1: Object.freeze({ env: "VSN_FEATURE_AI_QUALITY_FIX_PLAN", defaultValue: false, phase: 9 }),
  brandIntelligenceExtractionV1: Object.freeze({ env: "VSN_FEATURE_BRAND_INTELLIGENCE_EXTRACTION", defaultValue: false, phase: 13 }),
  collaborationReviewV1: Object.freeze({ env: "VSN_FEATURE_COLLABORATION_REVIEW", defaultValue: false, phase: 10 }),
  localizationMarketsV1: Object.freeze({ env: "VSN_FEATURE_LOCALIZATION_MARKETS", defaultValue: false, phase: 11 }),
  formsAutomationV2: Object.freeze({ env: "VSN_FEATURE_FORMS_AUTOMATION", defaultValue: false, phase: 12 }),
  marketplaceBrandKitsV1: Object.freeze({ env: "VSN_FEATURE_MARKETPLACE_BRAND_KITS", defaultValue: false, phase: 13 }),
  developerSdkV1: Object.freeze({ env: "VSN_FEATURE_DEVELOPER_SDK", defaultValue: false, phase: 14 }),
  enterpriseHardeningV1: Object.freeze({ env: "VSN_FEATURE_ENTERPRISE_HARDENING", defaultValue: false, phase: 15 }),
  commercializationV1: Object.freeze({ env: "VSN_FEATURE_COMMERCIALIZATION", defaultValue: false, phase: 16 }),
});

export function normalizeFeatureFlags(input = {}) {
  const result = {};
  for (const [key, definition] of Object.entries(FEATURE_FLAGS)) {
    result[key] = input?.[key] === true || input?.[key] === "true" || (input?.[key] == null && definition.defaultValue === true);
  }
  return Object.freeze(result);
}

export function isFeatureEnabled(flags, key) {
  return Boolean(flags?.[key]);
}
