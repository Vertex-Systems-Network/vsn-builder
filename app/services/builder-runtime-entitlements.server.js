import { getServerFeatureFlags } from "./feature-flags.server.js";
import { getFeatureDecision } from "./entitlements.server.js";

export async function getBuilderRuntimeEntitlements(db, shop) {
  const featureFlags = getServerFeatureFlags();
  const [collaboration, localization] = await Promise.all([
    getFeatureDecision(db, shop, "collaboration"),
    getFeatureDecision(db, shop, "localization"),
  ]);
  const collaborationEnabled = featureFlags.collaborationReviewV1 === true && collaboration.allowed;
  const localizationEnabled = featureFlags.localizationMarketsV1 === true && localization.allowed;
  return {
    collaboration,
    localization,
    collaborationEnabled,
    localizationEnabled,
    featureFlags: { ...featureFlags, collaborationReviewV1: collaborationEnabled, localizationMarketsV1: localizationEnabled },
  };
}
