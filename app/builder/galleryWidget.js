const LEGACY_IMAGES = [
  "/vsn-stock/fashion.svg",
  "/vsn-stock/interior.svg",
  "/vsn-stock/watch.svg",
  "/vsn-stock/skincare.svg",
];

export const GALLERY_LAYOUT_OPTIONS = [
  { value: "grid", label: "Grid" },
  { value: "masonry", label: "Masonry" },
  { value: "justified", label: "Justified" },
];

export const GALLERY_RATIO_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "square", label: "Square (1:1)" },
  { value: "portrait", label: "Portrait (4:5)" },
  { value: "landscape", label: "Landscape (4:3)" },
  { value: "wide", label: "Wide (16:9)" },
  { value: "custom", label: "Custom" },
];

export function galleryAspectRatio(value = "square", customWidth = 1, customHeight = 1) {
  if (value === "original") return "auto";
  if (value === "portrait") return "4 / 5";
  if (value === "landscape") return "4 / 3";
  if (value === "wide") return "16 / 9";
  if (value === "custom") {
    const width = Math.max(1, Number(customWidth) || 1);
    const height = Math.max(1, Number(customHeight) || 1);
    return `${width} / ${height}`;
  }
  return "1 / 1";
}

function legacyGalleryItems(imagesText = "") {
  const urls = String(imagesText || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return urls.map((url, index) => ({
    id: `legacy-gallery-${index}`,
    url,
    previewUrl: url,
    alt: "",
    caption: "",
    linkUrl: "",
    source: "legacy",
  }));
}

export function normalizeGalleryItem(item = {}, index = 0) {
  if (typeof item === "string") {
    return { id: `gallery-${index}`, url: item, previewUrl: item, alt: "", caption: "", linkUrl: "" };
  }
  const url = String(item?.url || item?.previewUrl || "").trim();
  return {
    ...item,
    id: String(item?.id || `gallery-${index}`),
    url,
    previewUrl: String(item?.previewUrl || url),
    alt: String(item?.alt || item?.altText || ""),
    caption: String(item?.caption || ""),
    linkUrl: String(item?.linkUrl || ""),
  };
}

export function normalizeGalleryWidgetProps(value = {}) {
  const hasGalleryItems = Object.prototype.hasOwnProperty.call(value || {}, "galleryItems");
  const rawItems = hasGalleryItems && Array.isArray(value?.galleryItems)
    ? value.galleryItems
    : legacyGalleryItems(value?.imagesText);
  return {
    ...value,
    galleryItems: rawItems.map(normalizeGalleryItem).filter((item) => item.url),
    layout: ["grid", "masonry", "justified"].includes(value?.layout) ? value.layout : "grid",
    columnsDesktop: Math.max(1, Math.min(8, Number(value?.columnsDesktop || 4))),
    columnsTablet: Math.max(1, Math.min(6, Number(value?.columnsTablet || 2))),
    columnsMobile: Math.max(1, Math.min(4, Number(value?.columnsMobile || 1))),
    gap: Math.max(0, Math.min(200, Number(value?.gap ?? 12))),
    rowGap: Math.max(0, Math.min(200, Number(value?.rowGap ?? value?.gap ?? 12))),
    imageRatio: ["original", "square", "portrait", "landscape", "wide", "custom"].includes(value?.imageRatio) ? value.imageRatio : "square",
    customRatioWidth: Math.max(1, Number(value?.customRatioWidth || 1)),
    customRatioHeight: Math.max(1, Number(value?.customRatioHeight || 1)),
    objectFit: ["cover", "contain", "fill", "scale-down"].includes(value?.objectFit) ? value.objectFit : "cover",
    objectPosition: String(value?.objectPosition || "center center"),
    clickAction: ["none", "lightbox", "link"].includes(value?.clickAction) ? value.clickAction : "lightbox",
    showCaptions: value?.showCaptions === true,
    openLinksNewTab: value?.openLinksNewTab === true,
  };
}

export function galleryColumnsForDevice(props = {}, device = "desktop") {
  const normalized = normalizeGalleryWidgetProps(props);
  if (device === "mobile") return normalized.columnsMobile;
  if (device === "tablet") return normalized.columnsTablet;
  return normalized.columnsDesktop;
}
