// Shared, runtime-neutral database contract: valid in both Node and Workers.
// Keep feature table names in one place to prevent provider drift.
export const VSN_FEATURE_TABLES = Object.freeze({
  core: ["Session", "BuilderPage", "BuilderShopSetting"],
  developerStudio: ["BuilderGraphqlSavedQuery", "BuilderGraphqlHistory", "BuilderGlobalCode", "BuilderGlobalCodeRevision"],
  wishlist: ["BuilderWishlist"],
  emailBuilder: ["BuilderEmailTemplate"],
  motion: ["BuilderMotionPreset"],
  widgetPlatform: ["BuilderWidgetTemplate", "BuilderCustomWidget"],
});
export const VSN_HEALTH_TABLES = Object.freeze([...new Set(Object.values(VSN_FEATURE_TABLES).flat())]);
