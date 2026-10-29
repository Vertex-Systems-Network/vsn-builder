// Section/container decorations that need more than one CSS declaration:
// shape dividers (top/bottom SVG masks) and background video. Shared by the
// canvas, the preview and the storefront style bundle.
const SHAPES = {
  wave: "M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z",
  curve: "M0,0V7.23C0,65.52,268.63,112.77,600,112.77S1200,65.52,1200,7.23V0Z",
  tilt: "M1200 120L0 16.48 0 0 1200 0 1200 120z",
  triangle: "M1200 0L0 0 598.97 114.72 1200 0z",
  zigzag: `M0,0 ${Array.from({ length: 24 }, (_, i) => `L${i * 50 + 25},60 L${(i + 1) * 50},0`).join(" ")} Z`,
  arrow: "M0,0 L560,0 L600,60 L640,0 L1200,0 Z",
};
export const SHAPE_DIVIDER_OPTIONS = Object.freeze(Object.keys(SHAPES));
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|var\(--[a-z0-9-]+\)|[a-z]+)$/i;

function dividerRule(selector, place, divider = {}) {
  const path = SHAPES[divider.shape];
  if (!path) return "";
  const color = SAFE_COLOR.test(String(divider.color || "")) ? divider.color : "#ffffff";
  const height = Math.max(10, Math.min(400, Number(divider.height) || 80));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'><path d='${path}'/></svg>`;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
  const transforms = [place === "bottom" ? "rotate(180deg)" : "", divider.flip ? "scaleX(-1)" : ""].filter(Boolean).join(" ");
  return `${selector}::${place === "top" ? "before" : "after"}{content:"";position:absolute;left:0;right:0;${place}:-1px;height:${height}px;background:${color};-webkit-mask:${mask};mask:${mask};pointer-events:none;z-index:1;${transforms ? `transform:${transforms};` : ""}}`;
}

export function shapeDividerCss(selector, styles = {}) {
  const divider = styles?.shapeDivider || {};
  const rules = [dividerRule(selector, "top", divider.top), dividerRule(selector, "bottom", divider.bottom)].filter(Boolean);
  if (!rules.length) return "";
  const positioned = styles?.layout?.position && styles.layout.position !== "static";
  return [positioned ? "" : `${selector}{position:relative}`, ...rules].filter(Boolean).join("\n");
}

export function backgroundVideoUrl(styles = {}) {
  const background = styles?.background || {};
  if (background.enabled === false) return "";
  const url = String(background.video?.url || "").trim();
  return /^https:\/\/[^\s"'<>]+\.(mp4|webm|ogg)(\?[^\s"'<>]*)?$/i.test(url) ? url : "";
}
