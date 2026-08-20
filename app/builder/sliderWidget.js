function nodeId(prefix = "slide") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}`;
}

export const SLIDER_DIRECTION_OPTIONS = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];
export const SLIDER_EFFECT_OPTIONS = [
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
];
export const SLIDER_PAGINATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "fraction", label: "Fraction" },
  { value: "progress", label: "Progress" },
];

export function createSliderSlide(index = 0, label = "") {
  return {
    id: nodeId("slide"),
    type: "container",
    label: label || `Slide ${index + 1}`,
    props: { __sliderSlide: true, slideLabel: label || `Slide ${index + 1}` },
    styles: {
      spacing: { paddingTop: "24px", paddingRight: "24px", paddingBottom: "24px", paddingLeft: "24px" },
      size: { minHeight: "260px" },
    },
    interactions: {},
    children: [],
  };
}

function cloneTree(node, label) {
  const next = structuredClone(node || {});
  const walk = (item) => ({
    ...item,
    id: nodeId(item?.type || "el"),
    children: Array.isArray(item?.children) ? item.children.map(walk) : [],
  });
  const cloned = walk(next);
  if (label) {
    cloned.label = label;
    cloned.props = { ...(cloned.props || {}), slideLabel: label, __sliderSlide: true };
  }
  return cloned;
}

export function duplicateSliderSlide(slide, index = 0) {
  return cloneTree(slide, `${slide?.props?.slideLabel || slide?.label || `Slide ${index + 1}`} Copy`);
}

export function normalizeSliderProps(value = {}) {
  return {
    ...value,
    direction: value?.direction === "vertical" ? "vertical" : "horizontal",
    slidesDesktop: Math.max(1, Math.min(6, Number(value?.slidesDesktop || 1))),
    slidesTablet: Math.max(1, Math.min(4, Number(value?.slidesTablet || 1))),
    slidesMobile: Math.max(1, Math.min(2, Number(value?.slidesMobile || 1))),
    gap: Math.max(0, Math.min(200, Number(value?.gap ?? 16))),
    edgePadding: Math.max(0, Math.min(400, Number(value?.edgePadding || 0))),
    autoHeight: value?.autoHeight !== false,
    equalHeight: value?.equalHeight === true,
    centered: value?.centered === true,
    effect: value?.effect === "fade" ? "fade" : "slide",
    speed: Math.max(0, Math.min(10000, Number(value?.speed || 450))),
    autoplay: value?.autoplay === true,
    autoplayDelay: Math.max(500, Math.min(60000, Number(value?.autoplayDelay || 4500))),
    pauseOnHover: value?.pauseOnHover !== false,
    pauseOnInteraction: value?.pauseOnInteraction !== false,
    stopOnLastSlide: value?.stopOnLastSlide === true,
    loop: value?.loop === true,
    rewind: value?.rewind !== false,
    navigation: value?.navigation !== false,
    previousIcon: String(value?.previousIcon || "‹"),
    nextIcon: String(value?.nextIcon || "›"),
    pagination: ["none", "dots", "fraction", "progress"].includes(value?.pagination) ? value.pagination : "dots",
    swipe: value?.swipe !== false,
    keyboard: value?.keyboard !== false,
  };
}

export function sliderSlidesForDevice(value = {}, device = "desktop") {
  const props = normalizeSliderProps(value);
  if (props.effect === "fade") return 1;
  if (device === "mobile") return props.slidesMobile;
  if (device === "tablet") return props.slidesTablet;
  return props.slidesDesktop;
}

export function ensureSliderSlides(children = [], count = 3) {
  if (Array.isArray(children) && children.length) return children;
  return Array.from({ length: Math.max(1, count) }, (_, index) => createSliderSlide(index));
}
