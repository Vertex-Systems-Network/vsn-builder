/**
 * Human-readable presentation helpers shared by Builder workspace screens.
 * Keep raw persisted/API values out of UI labels whenever a readable form exists.
 */
export const HUMAN_LABELS = Object.freeze({
  "add-to-cart":"Add to cart",
  "form-submit":"Form submit",
  "custom-event":"Custom event",
  "shopify-flow":"Shopify Flow",
  "announcement-overlay":"Announcement overlay",
  "bottom-right":"Bottom right",
  "bottom-left":"Bottom left",
  "top-right":"Top right",
  "top-left":"Top left",
  "page-load":"Page load",
  "scroll-progress":"Scroll progress",
  "exit-intent":"Exit intent",
  "popup-close":"Close popup / floating element",
  "not-configured":"Not configured",
  aov:"AOV",
  cro:"CRO",
  svg:"SVG",
  api:"API",
  rss:"RSS",
  mb:"MB",
  ttl:"TTL",
});

export function humanLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const known = HUMAN_LABELS[raw.toLowerCase()];
  if (known) return known;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bApi\b/g, "API")
    .replace(/\bSvg\b/g, "SVG")
    .replace(/\bCro\b/g, "CRO")
    .replace(/\bAov\b/g, "AOV")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bJson\b/g, "JSON")
    .replace(/\bId\b/g, "ID")
    .replace(/\bJs\b/g, "JS")
    .replace(/\bCss\b/g, "CSS")
    .replace(/\bSeo\b/g, "SEO");
}

export function humanValue(value) {
  if (value === true) return "Configured / Yes";
  if (value === false) return "Not configured / No";
  if (value == null || value === "") return "—";
  return typeof value === "string" ? humanLabel(value) : String(value);
}

export const FONT_WEIGHT_LABELS = Object.freeze({
  100:"Thin (100)", 200:"Extra Light (200)", 300:"Light (300)",
  400:"Regular (400)", 500:"Medium (500)", 600:"Semi Bold (600)",
  700:"Bold (700)", 800:"Extra Bold (800)", 900:"Black (900)",
});
