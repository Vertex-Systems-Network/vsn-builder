import { getVsnWidgetDefinition } from "../sdk/registry.js";
/**
 * VSN widget styling capability matrix.
 *
 * The inspector must never infer controls from the current style payload alone:
 * widgets can carry legacy styles that should continue to render without exposing
 * irrelevant controls. This module is the single UI capability source of truth.
 */

const FAMILY = {
  structure: [
    "container", "section", "global-section", "component-instance", "banner", "columns", "slider", "carousel", "slides", "loop",
  ],
  text: [
    "heading", "text", "collection-title", "collection-description", "collection-product-count",
    "product-title", "product-price", "product-compare-price", "product-description", "product-vendor",
    "product-sku", "product-availability", "product-metafield", "search-query-title", "search-result-count",
    "blog-title", "blog-description", "article-title", "article-content", "article-author", "article-date",
    "article-tags", "customer-name",
  ],
  media: [
    "image", "video", "collection-image", "product-image", "product-gallery", "product-media",
    "article-featured-image",
  ],
  action: [
    "button", "product-add-to-cart", "product-buy-now", "collection-pagination", "size-guide",
    "sticky-add-to-cart", "cart-icon", "account-link", "customer-login", "customer-logout",
    "customer-orders-link", "customer-addresses-link",
  ],
  navigation: [
    "navigation-menu", "breadcrumbs", "mega-menu", "article-navigation", "localization-switcher",
    "header-search",
  ],
  form: [
    "contact-form", "newsletter-form", "product-inquiry-form", "form-builder", "product-variant-selector",
    "product-quantity", "collection-filters", "collection-sorting",
  ],
  gridCard: [
    "product-grid", "collection-product-grid", "product-card", "collection-grid", "product-recommendations",
    "search-results-grid", "blog-article-grid", "related-articles", "team-grid", "gallery-grid",
    "recently-viewed", "related-collections", "upsell-products", "logo-cloud",
  ],
  interactive: [
    "icon", "divider", "spacer", "icon-list", "icon-box", "image-box", "accordion", "toggle",
    "testimonials-carousel", "social-icons", "map", "progress-bar", "counter", "pricing-table", "timeline",
    "data-table", "faq", "testimonials", "stats", "marquee", "tabs", "product-tabs", "shipping-info",
    "stock-progress", "trust-badges", "announcement-bar", "countdown", "inventory-status", "cart-drawer",
  ],
  code: ["html", "liquid"],
  utility: ["menu-anchor"],
};

const TYPE_TO_FAMILY = Object.entries(FAMILY).reduce((out, [family, types]) => {
  for (const type of types) out[type] = family;
  return out;
}, {});

export const WIDGET_CAPABILITY_KEYS = Object.freeze([
  "layout", "sizing", "spacing", "flexItem", "flexContainer", "gridContainer",
  "background", "border", "effects", "transform", "transition", "interaction", "scroll",
  "typography", "textEffects", "media", "imageDimensions", "icon", "backgroundGallery",
  "elementLink", "dynamicSource", "conditions", "responsive", "stateStyles", "animations",
  "cssVariables", "customCode",
]);

const SAFE_UNKNOWN = Object.freeze({
  family: "unknown",
  ...Object.fromEntries(WIDGET_CAPABILITY_KEYS.map((key) => [key, false])),
});

const BASE = Object.freeze({
  family: "interactive",
  layout: true,
  sizing: true,
  spacing: true,
  flexItem: true,
  flexContainer: false,
  gridContainer: false,
  background: true,
  border: true,
  effects: true,
  transform: true,
  transition: true,
  interaction: true,
  scroll: true,
  typography: false,
  textEffects: false,
  media: false,
  imageDimensions: false,
  icon: false,
  backgroundGallery: false,
  elementLink: false,
  dynamicSource: false,
  conditions: true,
  responsive: true,
  stateStyles: true,
  animations: true,
  cssVariables: true,
  customCode: true,
});

const FAMILY_CAPABILITIES = {
  structure: {
    flexContainer: true,
    gridContainer: true,
    backgroundGallery: true,
  },
  text: {
    typography: true,
    textEffects: true,
    dynamicSource: true,
    elementLink: true,
  },
  media: {
    effects: true,
  },
  action: {
    typography: true,
    textEffects: true,
    stateStyles: true,
  },
  navigation: {
    typography: true,
    textEffects: true,
  },
  form: {
    typography: true,
    stateStyles: true,
  },
  gridCard: {
    typography: true,
  },
  interactive: {
    typography: true,
  },
  code: {
    typography: false,
    textEffects: false,
    stateStyles: false,
    animations: false,
  },
  utility: {
    sizing: false,
    spacing: false,
    flexItem: false,
    background: false,
    border: false,
    effects: false,
    transform: false,
    transition: false,
    interaction: false,
    scroll: false,
    stateStyles: false,
    animations: false,
    cssVariables: false,
  },
};

const OVERRIDES = {
  // Basic widgets where the dynamic binding target is actually implemented.
  heading: { dynamicSource: true, elementLink: true },
  text: { dynamicSource: true, elementLink: true },
  button: { dynamicSource: true, elementLink: false },
  image: {
    typography: false,
    textEffects: false,
    media: true,
    imageDimensions: true,
    dynamicSource: true,
    elementLink: true,
  },
  video: { typography: false, textEffects: false, media: false },
  icon: { typography: true, textEffects: false, icon: true, elementLink: true },
  divider: { typography: false, textEffects: false, stateStyles: false },
  spacer: { typography: false, textEffects: false, stateStyles: false, interaction: false },
  map: { typography: false, textEffects: false },
  "gallery-grid": { typography: false, textEffects: false },

  // Shopify-native dynamic widgets already resolve from page context; generic binding would be misleading.
  "collection-title": { dynamicSource: false, elementLink: false },
  "collection-description": { dynamicSource: false, elementLink: false },
  "collection-product-count": { dynamicSource: false, elementLink: false },
  "product-title": { dynamicSource: false, elementLink: false },
  "product-price": { dynamicSource: false, elementLink: false },
  "product-compare-price": { dynamicSource: false, elementLink: false },
  "product-description": { dynamicSource: false, elementLink: false },
  "product-vendor": { dynamicSource: false, elementLink: false },
  "product-sku": { dynamicSource: false, elementLink: false },
  "product-availability": { dynamicSource: false, elementLink: false },
  "product-metafield": { dynamicSource: false, elementLink: false },
  "search-query-title": { dynamicSource: false, elementLink: false },
  "search-result-count": { dynamicSource: false, elementLink: false },
  "blog-title": { dynamicSource: false, elementLink: false },
  "blog-description": { dynamicSource: false, elementLink: false },
  "article-title": { dynamicSource: false, elementLink: false },
  "article-content": { dynamicSource: false, elementLink: false },
  "article-author": { dynamicSource: false, elementLink: false },
  "article-date": { dynamicSource: false, elementLink: false },
  "article-tags": { dynamicSource: false, elementLink: false },
  "customer-name": { dynamicSource: false, elementLink: false },

  // Only the basic image renderer consumes advanced.media/imageDimensions directly.
  "collection-image": { typography: false, textEffects: false, media: false, imageDimensions: false },
  "product-image": { typography: false, textEffects: false, media: false, imageDimensions: false },
  "product-gallery": { typography: false, textEffects: false, media: false, imageDimensions: false },
  "product-media": { typography: false, textEffects: false, media: false, imageDimensions: false },
  "article-featured-image": { typography: false, textEffects: false, media: false, imageDimensions: false },

  // Invisible anchor: only conditions/responsive/custom code remain useful.
  "menu-anchor": {
    layout: false,
    sizing: false,
    spacing: false,
    flexItem: false,
    flexContainer: false,
    gridContainer: false,
    background: false,
    border: false,
    effects: false,
    transform: false,
    transition: false,
    interaction: false,
    scroll: false,
    typography: false,
    textEffects: false,
    stateStyles: false,
    animations: false,
    cssVariables: false,
  },

  // Code output should not be silently wrapped in interactive/state controls.
  html: { elementLink: false, dynamicSource: false },
  liquid: { elementLink: false, dynamicSource: false },
};

function buildCapabilityRecord(type) {
  const family = TYPE_TO_FAMILY[type];
  if (!family) return SAFE_UNKNOWN;
  return Object.freeze({
    ...BASE,
    family,
    ...(FAMILY_CAPABILITIES[family] || {}),
    ...(OVERRIDES[type] || {}),
  });
}

export const widgetCapabilityMatrix = Object.freeze(
  Object.fromEntries(Object.keys(TYPE_TO_FAMILY).map((type) => [type, buildCapabilityRecord(type)])),
);

function normalizeSdkCapabilityOverrides(capabilities = {}) {
  const next = {};
  for (const key of WIDGET_CAPABILITY_KEYS) {
    if (typeof capabilities?.[key] === "boolean") next[key] = capabilities[key];
  }
  // Public SDK convenience aliases map onto the established capability engine.
  if (typeof capabilities?.customCss === "boolean") next.customCode = capabilities.customCss;
  if (typeof capabilities?.visibility === "boolean") next.conditions = capabilities.visibility;
  return next;
}

export function getWidgetCapabilities(type) {
  const core = widgetCapabilityMatrix[type];
  const sdk = getVsnWidgetDefinition(type);
  if (!sdk) return core || SAFE_UNKNOWN;
  const family = core?.family || (TYPE_TO_FAMILY[type] || sdk.family || "interactive");
  const base = core || { ...BASE, family, ...(FAMILY_CAPABILITIES[family] || FAMILY_CAPABILITIES.interactive) };
  return Object.freeze({ ...base, family, ...normalizeSdkCapabilityOverrides(sdk.capabilities || {}) });
}

export function getWidgetFamily(type) {
  return TYPE_TO_FAMILY[type] || getVsnWidgetDefinition(type)?.family || (getVsnWidgetDefinition(type) ? "interactive" : "unknown");
}

export const widgetCapabilityFamilies = FAMILY;

export function auditWidgetCapabilityCoverage(widgetTypes = []) {
  const expected = new Set(widgetTypes);
  const mapped = new Set(Object.keys(widgetCapabilityMatrix));
  const isMapped = (type) => mapped.has(type) || Boolean(getVsnWidgetDefinition(type));
  return {
    total: widgetTypes.length,
    covered: widgetTypes.filter(isMapped).length,
    missing: widgetTypes.filter((type) => !isMapped(type)),
    unexpected: [...mapped].filter((type) => !expected.has(type)),
  };
}

export function auditWidgetCapabilityConsistency(widgetTypes = []) {
  const errors = [];
  const coverage = auditWidgetCapabilityCoverage(widgetTypes);
  if (coverage.missing.length) errors.push(`Missing capability mappings: ${coverage.missing.join(", ")}`);
  if (coverage.unexpected.length) errors.push(`Capability mappings without registered widgets: ${coverage.unexpected.join(", ")}`);

  for (const type of widgetTypes) {
    const record = getWidgetCapabilities(type);
    if (!record || record.family === "unknown") {
      errors.push(`${type}: unknown capability family`);
      continue;
    }
    for (const key of WIDGET_CAPABILITY_KEYS) {
      if (typeof record[key] !== "boolean") errors.push(`${type}: capability ${key} must be boolean`);
    }
    const extraKeys = Object.keys(record).filter((key) => key !== "family" && !WIDGET_CAPABILITY_KEYS.includes(key));
    if (extraKeys.length) errors.push(`${type}: unknown capability keys ${extraKeys.join(", ")}`);
    if (record.textEffects && !record.typography) errors.push(`${type}: textEffects requires typography`);
    if (record.textEffects && !record.effects) errors.push(`${type}: textEffects requires effects`);
    if (record.imageDimensions && !record.media) errors.push(`${type}: imageDimensions requires media`);
    if (record.backgroundGallery && !record.background) errors.push(`${type}: backgroundGallery requires background`);
    if ((record.flexContainer || record.gridContainer || record.flexItem) && !record.layout) errors.push(`${type}: flex/grid capabilities require layout`);
  }

  return { ...coverage, valid: errors.length === 0, errors };
}
