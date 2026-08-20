import { widgetRegistry } from "../builder/widgetRegistry.js";

export const WIDGET_NAMESPACE = "vsn_page_builder";
export const WIDGET_SETTINGS_KEY = "widget_settings";

const LAYOUT = new Set(["container", "section", "global-section", "component-instance", "banner", "columns", "loop"]);
const FORMS = new Set(["contact-form", "newsletter-form", "product-inquiry-form", "form-builder"]);
const PRODUCT = new Set(Object.keys(widgetRegistry).filter((id) => id.startsWith("product-") || id === "product-grid" || id === "product-card"));
const COLLECTION = new Set(Object.keys(widgetRegistry).filter((id) => id.startsWith("collection-") || id === "collection-grid" || id === "related-collections"));
const BLOG = new Set(Object.keys(widgetRegistry).filter((id) => id.startsWith("blog-") || id.startsWith("article-") || id === "recent-posts"));
const COMMERCE = new Set(["cart-drawer", "cart-items", "cart-summary", "free-shipping-bar", "trust-badges", "stock-progress", "sticky-add-to-cart"]);
const NAVIGATION = new Set(["navigation-menu", "breadcrumbs", "icon-list", "social-icons", "menu-anchor", "pagination"]);
const MEDIA = new Set(["image", "video", "slider", "carousel", "image-carousel", "media-carousel", "gallery", "basic-gallery", "gallery-grid", "image-box", "logo-cloud", "lottie"]);
const INTERACTIVE = new Set(["accordion", "tabs", "counter", "progress-bar", "countdown", "flip-box", "rating", "testimonials"]);

function categoryFor(id, config = null) {
  if (config?.category) return String(config.category);
  if (LAYOUT.has(id)) return "Layout";
  if (FORMS.has(id)) return "Forms";
  if (PRODUCT.has(id)) return "Product";
  if (COLLECTION.has(id)) return "Collection";
  if (BLOG.has(id)) return "Blog & Article";
  if (COMMERCE.has(id)) return "Commerce";
  if (NAVIGATION.has(id)) return "Navigation";
  if (MEDIA.has(id)) return "Media";
  if (INTERACTIVE.has(id)) return "Interactive";
  if (id.startsWith("search-")) return "Search";
  if (id.startsWith("customer-")) return "Customer";
  if (["html", "liquid", "code", "custom-css"].includes(id)) return "Advanced";
  return "Basic";
}

export function getWidgetDefinitions() {
  return Object.entries(widgetRegistry).map(([id, config]) => ({
    id,
    name: config.label || id,
    category: categoryFor(id, config),
    description: `Enable or disable the ${config.label || id} widget in the VSN Builder element library.`,
    enabled: true,
  }));
}

function parseSaved(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.widgets)) return parsed.widgets;
  } catch (error) {
    console.error("VSN widget settings JSON parse failed:", error);
  }
  return [];
}

function mergeSettings(saved = []) {
  const savedMap = new Map(saved.filter((item) => item?.id).map((item) => [item.id, item]));
  return getWidgetDefinitions().map((widget) => ({
    ...widget,
    enabled: typeof savedMap.get(widget.id)?.enabled === "boolean" ? savedMap.get(widget.id).enabled : true,
  }));
}

export function summarizeWidgets(widgets) {
  const activeCount = widgets.filter((widget) => widget.enabled).length;
  const categoryCounts = widgets.reduce((counts, widget) => {
    counts[widget.category] = (counts[widget.category] || 0) + 1;
    return counts;
  }, {});
  return {
    widgets,
    totalCount: widgets.length,
    activeCount,
    disabledCount: widgets.length - activeCount,
    categoryCounts: { All: widgets.length, ...categoryCounts },
  };
}

export async function loadWidgetSettings(admin) {
  const response = await admin.graphql(`#graphql
    query VsnWidgetSettings($namespace: String!, $key: String!) {
      currentAppInstallation {
        id
        metafield(namespace: $namespace, key: $key) { id value type updatedAt }
      }
    }
  `, { variables: { namespace: WIDGET_NAMESPACE, key: WIDGET_SETTINGS_KEY } });
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(", "));
  const installation = result.data?.currentAppInstallation;
  const savedMetafield = installation?.metafield;
  const widgets = mergeSettings(parseSaved(savedMetafield?.value));

  // Native Theme App Extension blocks use available_if against boolean app-data
  // metafields. On a fresh install those metafields do not exist yet, even though
  // VSN widgets default to enabled. Seed the canonical aggregate + boolean gates
  // the first time settings are read so native blocks are immediately available.
  if (!savedMetafield && installation?.id) {
    const compact = widgets.map(({ id, enabled }) => ({ id, enabled }));
    const metafields = [
      { ownerId: installation.id, namespace: WIDGET_NAMESPACE, key: WIDGET_SETTINGS_KEY, type: "json", value: JSON.stringify({ widgets: compact }) },
      ...widgets.map((widget) => ({ ownerId: installation.id, namespace: WIDGET_NAMESPACE, key: widgetKey(widget.id), type: "boolean", value: widget.enabled ? "true" : "false" })),
    ];
    for (let index = 0; index < metafields.length; index += 25) await setBatch(admin, metafields.slice(index, index + 25));
  }
  return summarizeWidgets(widgets);
}

function widgetKey(id) {
  return `${id.replaceAll("-", "_")}_enabled`;
}

async function setBatch(admin, metafields) {
  const response = await admin.graphql(`#graphql
    mutation VsnSaveWidgetSettings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value type }
        userErrors { field message code }
      }
    }
  `, { variables: { metafields } });
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(", "));
  const errors = result.data?.metafieldsSet?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join(", "));
}

export async function saveWidgetSettings(admin, incomingWidgets) {
  const definitions = getWidgetDefinitions();
  const valid = new Set(definitions.map((widget) => widget.id));
  const incomingMap = new Map((Array.isArray(incomingWidgets) ? incomingWidgets : []).filter((widget) => valid.has(widget?.id)).map((widget) => [widget.id, widget.enabled === true]));
  const widgets = definitions.map((widget) => ({ ...widget, enabled: incomingMap.has(widget.id) ? incomingMap.get(widget.id) : true }));

  const installResponse = await admin.graphql(`#graphql
    query VsnAppInstallationId { currentAppInstallation { id } }
  `);
  const installResult = await installResponse.json();
  const ownerId = installResult.data?.currentAppInstallation?.id;
  if (!ownerId) throw new Error("Unable to resolve the current app installation.");

  const compact = widgets.map(({ id, enabled }) => ({ id, enabled }));
  const metafields = [
    {
      ownerId,
      namespace: WIDGET_NAMESPACE,
      key: WIDGET_SETTINGS_KEY,
      type: "json",
      value: JSON.stringify({ widgets: compact }),
    },
    ...widgets.map((widget) => ({
      ownerId,
      namespace: WIDGET_NAMESPACE,
      key: widgetKey(widget.id),
      type: "boolean",
      value: widget.enabled ? "true" : "false",
    })),
  ];

  for (let index = 0; index < metafields.length; index += 25) {
    await setBatch(admin, metafields.slice(index, index + 25));
  }
  return summarizeWidgets(widgets);
}
