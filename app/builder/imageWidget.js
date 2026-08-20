export const IMAGE_SOURCE_OPTIONS = Object.freeze([
  { value: "shopify", label: "Shopify Media" },
  { value: "external", label: "External URL" },
  { value: "dynamic", label: "Dynamic Source" },
]);

export const IMAGE_RESOLUTION_OPTIONS = Object.freeze([
  { value: "original", label: "Original" },
  { value: "320", label: "320 px" },
  { value: "480", label: "480 px" },
  { value: "640", label: "640 px" },
  { value: "800", label: "800 px" },
  { value: "1024", label: "1024 px" },
  { value: "1280", label: "1280 px" },
  { value: "1600", label: "1600 px" },
  { value: "2048", label: "2048 px" },
  { value: "custom", label: "Custom" },
]);

const MAX_SHOPIFY_IMAGE_SIZE = 5760;
const SOURCE_TYPES = new Set(IMAGE_SOURCE_OPTIONS.map((item) => item.value));
const RESOLUTIONS = new Set(IMAGE_RESOLUTION_OPTIONS.map((item) => item.value));

function positiveInt(value, max = MAX_SHOPIFY_IMAGE_SIZE) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(max, numeric) : null;
}

export function normalizeImageWidgetProps(value = {}) {
  const props = value && typeof value === "object" ? value : {};
  const sourceType = SOURCE_TYPES.has(props.sourceType) ? props.sourceType : (props.externalUrl ? "external" : "shopify");
  const resolution = RESOLUTIONS.has(String(props.resolution || "")) ? String(props.resolution) : "original";
  return {
    ...props,
    sourceType,
    resolution,
    altMode: ["media", "custom", "decorative"].includes(props.altMode) ? props.altMode : "custom",
    captionMode: ["none", "media", "custom"].includes(props.captionMode) ? props.captionMode : "none",
    linkType: ["none", "media", "custom"].includes(props.linkType) ? props.linkType : "none",
    loading: props.loading === "eager" ? "eager" : "lazy",
    fetchPriority: ["auto", "high", "low"].includes(props.fetchPriority) ? props.fetchPriority : "auto",
  };
}

export function resolveImageSource(props = {}, advanced = {}) {
  const normalized = normalizeImageWidgetProps(props);
  const media = normalized.media && typeof normalized.media === "object" ? normalized.media : {};
  if (normalized.sourceType === "external") return String(normalized.externalUrl || normalized.src || "").trim();
  if (normalized.sourceType === "dynamic") return String(normalized.src || normalized.externalUrl || media.url || advanced?.media?.url || "").trim();
  return String(media.url || normalized.src || advanced?.media?.url || "").trim();
}

export function imageResolutionDimensions(props = {}, media = {}) {
  const normalized = normalizeImageWidgetProps(props);
  if (normalized.resolution === "original") {
    return { width: positiveInt(media?.width), height: positiveInt(media?.height) };
  }
  if (normalized.resolution === "custom") {
    return { width: positiveInt(normalized.customWidth), height: positiveInt(normalized.customHeight) };
  }
  return { width: positiveInt(normalized.resolution), height: null };
}

export function isShopifyHostedImageUrl(value = "") {
  const source = String(value || "").trim();
  if (!source) return false;
  if (/^\/\/[^/]+\/cdn\/shop\//i.test(source)) return true;
  if (/^\/cdn\/shop\//i.test(source)) return true;
  try {
    const parsed = new URL(source, "https://vsn.invalid");
    const host = parsed.hostname.toLowerCase();
    return parsed.pathname.startsWith("/cdn/shop/") || host === "cdn.shopify.com" || host.endsWith(".shopifycdn.com") || host.endsWith(".myshopify.com");
  } catch {
    return false;
  }
}

export function buildImageRenderUrl(source, props = {}, media = {}) {
  const raw = String(source || "").trim();
  if (!raw || !isShopifyHostedImageUrl(raw)) return raw;
  const normalized = normalizeImageWidgetProps(props);
  if (normalized.resolution === "original") return raw;
  const dimensions = imageResolutionDimensions(normalized, media);
  if (!dimensions.width && !dimensions.height) return raw;
  const protocolRelative = raw.startsWith("//");
  const rootRelative = raw.startsWith("/") && !protocolRelative;
  try {
    const parsed = new URL(protocolRelative ? `https:${raw}` : raw, "https://vsn.invalid");
    if (dimensions.width) parsed.searchParams.set("width", String(dimensions.width));
    else parsed.searchParams.delete("width");
    if (dimensions.height) parsed.searchParams.set("height", String(dimensions.height));
    else parsed.searchParams.delete("height");
    if (rootRelative) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (protocolRelative) return `//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function imageAltText(props = {}, media = {}) {
  const normalized = normalizeImageWidgetProps(props);
  if (normalized.altMode === "decorative") return "";
  if (normalized.altMode === "media") return String(media?.alt || normalized.alt || "");
  return String(normalized.alt || "");
}

export function imageCaptionText(props = {}, media = {}) {
  const normalized = normalizeImageWidgetProps(props);
  if (normalized.captionMode === "none") return "";
  if (normalized.captionMode === "media") return String(media?.caption || media?.alt || media?.fileName || "");
  return String(normalized.caption || "");
}

export function imageLinkHref(props = {}, source = "") {
  const normalized = normalizeImageWidgetProps(props);
  if (normalized.linkType === "media") return String(source || "").trim();
  if (normalized.linkType === "custom") return String(normalized.linkUrl || "").trim();
  return "";
}
