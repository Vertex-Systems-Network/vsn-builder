import { getWidgetFamily } from "./widgetCapabilities.js";
import { getVsnWidgetDefinition } from "../sdk/registry.js";

export const WIDGET_STYLE_FEATURES = Object.freeze([
  "accordion", "articleBody", "articleCards", "articleMeta", "articleNav", "bar", "button",
  "cards", "carousel", "cartSurface", "codeSurface", "collectionTools", "commerceGrid",
  "commerceHeading", "commerceMeta", "commerceOptions", "commercePagination", "commercePrice",
  "contentCollection", "customerIdentity", "customerLink", "divider", "form", "galleryThumbs",
  "gridCards", "icon", "media", "navigation", "progress", "richText", "searchResults",
  "searchSummary", "stats", "stickyCart", "structureItems", "table", "tabs", "textCore",
]);

const STRUCTURE_ITEM_TYPES = new Set([
  "container", "section", "global-section", "component-instance", "banner", "columns", "loop",
]);
const RICH_TEXT = new Set([
  "text", "collection-description", "product-description", "blog-description", "article-content",
]);
const ICON_TYPES = new Set([
  "icon", "icon-list", "icon-box", "social-icons", "trust-badges", "cart-icon",
]);
const ACCORDION_TYPES = new Set(["accordion", "toggle", "faq", "size-guide"]);
const TAB_TYPES = new Set(["tabs", "product-tabs"]);
const PROGRESS_TYPES = new Set(["progress-bar", "stock-progress", "inventory-status"]);
const TABLE_TYPES = new Set(["data-table"]);
const STAT_TYPES = new Set(["counter", "stats", "countdown"]);
const CARD_INTERACTIVE_TYPES = new Set([
  "testimonials-carousel", "pricing-table", "timeline", "testimonials", "team-grid", "logo-cloud",
  "related-collections", "shipping-info", "cart-drawer", "trust-badges", "recently-viewed", "upsell-products",
]);
const CAROUSEL_TYPES = new Set(["carousel", "slides", "testimonials-carousel", "slider"]);
const BAR_TYPES = new Set(["marquee", "announcement-bar"]);
const DIVIDER_TYPES = new Set(["divider"]);
const MEDIA_LIKE_TYPES = new Set(["image-box", "gallery-grid", "map"]);
const FORM_LIKE_NAV_TYPES = new Set(["header-search", "localization-switcher"]);
const GALLERY_TYPES = new Set(["product-gallery"]);

const COMMERCE_PRICE_TYPES = new Set(["product-price", "product-compare-price"]);
const COMMERCE_META_TYPES = new Set([
  "product-vendor", "product-sku", "product-availability", "inventory-status", "product-metafield",
  "shipping-info", "stock-progress",
]);
const COMMERCE_OPTION_TYPES = new Set(["product-variant-selector", "product-quantity"]);
const COMMERCE_GRID_TYPES = new Set([
  "product-grid", "collection-product-grid", "product-card", "collection-grid", "product-recommendations",
  "recently-viewed", "upsell-products", "related-collections",
]);
const COLLECTION_TOOL_TYPES = new Set(["collection-product-grid", "collection-filters", "collection-sorting"]);
const COMMERCE_PAGINATION_TYPES = new Set(["collection-product-grid", "collection-pagination"]);
const CART_SURFACE_TYPES = new Set(["cart-drawer"]);
const STICKY_CART_TYPES = new Set(["sticky-add-to-cart"]);
const COMMERCE_HEADING_TYPES = new Set(["product-recommendations", "recently-viewed", "upsell-products", "related-collections"]);
const SEARCH_SUMMARY_TYPES = new Set(["search-query-title", "search-result-count"]);
const SEARCH_RESULTS_TYPES = new Set(["search-results-grid"]);
const ARTICLE_CARD_TYPES = new Set(["blog-article-grid", "related-articles"]);
const ARTICLE_BODY_TYPES = new Set(["article-content"]);
const ARTICLE_META_TYPES = new Set(["article-author", "article-date", "article-tags"]);
const ARTICLE_NAV_TYPES = new Set(["article-navigation"]);
const CUSTOMER_IDENTITY_TYPES = new Set(["customer-name"]);
const CUSTOMER_LINK_TYPES = new Set(["account-link", "customer-login", "customer-logout", "customer-orders-link", "customer-addresses-link"]);
const CODE_SURFACE_TYPES = new Set(["html", "liquid"]);
const CONTENT_COLLECTION_TYPES = new Set(["image-box", "logo-cloud", "team-grid", "gallery-grid"]);

export function getWidgetStyleProfile(type) {
  const family = getWidgetFamily(type);
  const features = new Set();

  if (family === "text") features.add("textCore");
  if (family === "text" && RICH_TEXT.has(type)) features.add("richText");
  if (STRUCTURE_ITEM_TYPES.has(type)) features.add("structureItems");
  if (family === "media") features.add("media");
  if (family === "action") features.add("button");
  if (family === "navigation") features.add("navigation");
  if (family === "form") { features.add("form"); features.add("button"); }
  if (family === "gridCard") features.add("gridCards");

  if (ICON_TYPES.has(type)) features.add("icon");
  if (ACCORDION_TYPES.has(type)) features.add("accordion");
  if (TAB_TYPES.has(type)) features.add("tabs");
  if (PROGRESS_TYPES.has(type)) features.add("progress");
  if (TABLE_TYPES.has(type)) features.add("table");
  if (STAT_TYPES.has(type)) features.add("stats");
  if (CARD_INTERACTIVE_TYPES.has(type)) features.add("cards");
  if (CAROUSEL_TYPES.has(type)) features.add("carousel");
  if (BAR_TYPES.has(type)) features.add("bar");
  if (DIVIDER_TYPES.has(type)) features.add("divider");
  if (MEDIA_LIKE_TYPES.has(type)) features.add("media");
  if (FORM_LIKE_NAV_TYPES.has(type)) { features.add("form"); features.add("button"); }
  if (GALLERY_TYPES.has(type)) features.add("galleryThumbs");
  if (COMMERCE_PRICE_TYPES.has(type)) features.add("commercePrice");
  if (COMMERCE_META_TYPES.has(type)) features.add("commerceMeta");
  if (COMMERCE_OPTION_TYPES.has(type)) features.add("commerceOptions");
  if (COMMERCE_GRID_TYPES.has(type)) features.add("commerceGrid");
  if (COLLECTION_TOOL_TYPES.has(type)) features.add("collectionTools");
  if (COMMERCE_PAGINATION_TYPES.has(type)) features.add("commercePagination");
  if (CART_SURFACE_TYPES.has(type)) features.add("cartSurface");
  if (STICKY_CART_TYPES.has(type)) features.add("stickyCart");
  if (COMMERCE_HEADING_TYPES.has(type)) features.add("commerceHeading");
  if (SEARCH_SUMMARY_TYPES.has(type)) features.add("searchSummary");
  if (SEARCH_RESULTS_TYPES.has(type)) features.add("searchResults");
  if (ARTICLE_CARD_TYPES.has(type)) features.add("articleCards");
  if (ARTICLE_BODY_TYPES.has(type)) features.add("articleBody");
  if (ARTICLE_META_TYPES.has(type)) features.add("articleMeta");
  if (ARTICLE_NAV_TYPES.has(type)) features.add("articleNav");
  if (CUSTOMER_IDENTITY_TYPES.has(type)) features.add("customerIdentity");
  if (CUSTOMER_LINK_TYPES.has(type)) features.add("customerLink");
  if (CODE_SURFACE_TYPES.has(type)) features.add("codeSurface");
  if (CONTENT_COLLECTION_TYPES.has(type)) features.add("contentCollection");

  // Widgets that visually behave like buttons despite being utility/commerce controls.
  if (["collection-pagination", "sticky-add-to-cart", "cart-drawer", "customer-login", "customer-logout", "customer-orders-link", "customer-addresses-link"].includes(type)) features.add("button");
  // Product / collection grids need card styling in addition to their family defaults.
  if (["product-grid", "collection-product-grid", "product-recommendations", "search-results-grid", "blog-article-grid", "related-articles"].includes(type)) features.add("gridCards");
  // Product controls expose native inputs/selects and should share the form skin.
  if (["product-variant-selector", "product-quantity", "collection-filters", "collection-sorting"].includes(type)) features.add("form");

  const sdkProfile = getVsnWidgetDefinition(type)?.styleProfile || {};
  for (const feature of (Array.isArray(sdkProfile.features) ? sdkProfile.features : [])) {
    if (WIDGET_STYLE_FEATURES.includes(feature)) features.add(feature);
  }
  return {
    type,
    family,
    features: [...features],
    sdkGroups: Array.isArray(sdkProfile.groups) ? [...new Set(sdkProfile.groups.map(String))] : [],
  };
}

export function widgetHasStyleFeature(type, feature) {
  return getWidgetStyleProfile(type).features.includes(feature);
}

export const batchCss2Targets = Object.freeze({
  structure: ["container", "section", "global-section", "component-instance", "banner", "columns", "loop", "slider", "carousel", "slides"],
  text: [
    "heading", "text", "collection-title", "collection-description", "collection-product-count",
    "product-title", "product-price", "product-compare-price", "product-description", "product-vendor",
    "product-sku", "product-availability", "product-metafield",
  ],
  media: ["image", "video", "collection-image", "product-image", "product-gallery", "product-media", "article-featured-image"],
  action: ["button", "product-add-to-cart", "product-buy-now", "size-guide", "sticky-add-to-cart"],
});

export function auditBatchCss2Profiles() {
  const groups = {};
  for (const [family, types] of Object.entries(batchCss2Targets)) {
    groups[family] = {
      total: types.length,
      covered: types.filter((type) => getWidgetStyleProfile(type).features.length > 0).length,
      missing: types.filter((type) => getWidgetStyleProfile(type).features.length === 0),
    };
  }
  return groups;
}


export const batchCss3Targets = Object.freeze({
  navigation: ["navigation-menu", "breadcrumbs", "mega-menu", "article-navigation", "localization-switcher", "header-search"],
  forms: ["contact-form", "newsletter-form", "product-inquiry-form", "form-builder", "product-variant-selector", "product-quantity", "collection-filters", "collection-sorting"],
  icons: ["icon", "icon-list", "icon-box", "social-icons", "trust-badges", "cart-icon"],
  interactive: [
    "accordion", "toggle", "faq", "size-guide", "tabs", "product-tabs",
    "progress-bar", "stock-progress", "inventory-status", "data-table",
    "counter", "stats", "countdown", "carousel", "slides", "testimonials-carousel", "slider",
    "marquee", "announcement-bar", "divider", "pricing-table", "timeline",
    "testimonials", "shipping-info", "cart-drawer", "map"
  ],
});

export function auditBatchCss3Profiles() {
  const groups = {};
  for (const [family, types] of Object.entries(batchCss3Targets)) {
    groups[family] = {
      total: types.length,
      covered: types.filter((type) => getWidgetStyleProfile(type).features.length > 0).length,
      missing: types.filter((type) => getWidgetStyleProfile(type).features.length === 0),
    };
  }
  return groups;
}

export function auditWidgetStyleProfiles(widgetTypes = []) {
  const errors = [];
  const profiles = widgetTypes.map((type) => getWidgetStyleProfile(type));
  for (const profile of profiles) {
    if (!profile?.type || profile.family === "unknown") errors.push(`${profile?.type || "unknown"}: invalid style-profile family`);
    const duplicate = profile.features.filter((feature, index) => profile.features.indexOf(feature) !== index);
    if (duplicate.length) errors.push(`${profile.type}: duplicate features ${[...new Set(duplicate)].join(", ")}`);
    const unknown = profile.features.filter((feature) => !WIDGET_STYLE_FEATURES.includes(feature));
    if (unknown.length) errors.push(`${profile.type}: unknown features ${unknown.join(", ")}`);
  }
  return {
    total: widgetTypes.length,
    profiled: profiles.filter((profile) => profile.family !== "unknown").length,
    noExtraControls: profiles.filter((profile) => profile.features.length === 0).map((profile) => profile.type),
    valid: errors.length === 0,
    errors,
  };
}


export const batchCss4Targets = Object.freeze({
  product: [
    "product-price", "product-compare-price", "product-vendor", "product-sku", "product-availability",
    "product-variant-selector", "product-quantity", "product-recommendations", "product-metafield",
    "product-gallery", "product-media", "inventory-status", "product-tabs", "size-guide", "shipping-info",
    "stock-progress", "recently-viewed", "upsell-products", "sticky-add-to-cart",
  ],
  collection: [
    "collection-product-grid", "collection-filters", "collection-sorting", "collection-pagination",
    "collection-grid", "related-collections", "collection-title", "collection-description",
    "collection-image", "collection-product-count",
  ],
  commerce: ["product-grid", "product-card", "cart-drawer", "trust-badges"],
  gridCard: ["product-grid", "collection-product-grid", "product-card", "collection-grid", "product-recommendations", "recently-viewed", "upsell-products", "related-collections"],
});

export function auditBatchCss4Profiles() {
  const groups = {};
  for (const [family, types] of Object.entries(batchCss4Targets)) {
    groups[family] = {
      total: types.length,
      covered: types.filter((type) => getWidgetStyleProfile(type).features.length > 0).length,
      missing: types.filter((type) => getWidgetStyleProfile(type).features.length === 0),
    };
  }
  return groups;
}


export const batchCss5Targets = Object.freeze({
  search: ["search-query-title", "search-result-count", "search-results-grid"],
  blog: ["blog-title", "blog-description", "blog-article-grid"],
  article: ["article-title", "article-featured-image", "article-content", "article-author", "article-date", "article-tags", "article-navigation", "related-articles"],
  customer: ["account-link", "customer-name", "customer-login", "customer-logout", "customer-orders-link", "customer-addresses-link"],
  advancedContent: ["html", "liquid", "image-box", "logo-cloud", "team-grid", "gallery-grid"],
});

export function auditBatchCss5Profiles() {
  const groups = {};
  for (const [family, types] of Object.entries(batchCss5Targets)) {
    groups[family] = {
      total: types.length,
      covered: types.filter((type) => getWidgetStyleProfile(type).features.length > 0).length,
      missing: types.filter((type) => getWidgetStyleProfile(type).features.length === 0),
    };
  }
  return groups;
}
