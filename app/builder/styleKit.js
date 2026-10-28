// Global Style Kit (Elementor "Site Settings" equivalent).
// Global colours and typography presets are stored on the global-styles node and
// exposed as CSS variables; base element rules use :where() (zero specificity) so
// any per-widget setting still wins. The same CSS is used by the editor canvas,
// preview and storefront theme assets.

export const SYSTEM_COLORS = Object.freeze([
  ["primary", "Primary", "primaryColor"],
  ["secondary", "Secondary", "secondaryColor"],
  ["text", "Text", "textColor"],
  ["accent", "Accent", "accentColor"],
]);

export const TYPOGRAPHY_PRESETS = Object.freeze({
  h1: { label: "H1", fontSize: "48px", fontWeight: "700", lineHeight: "1.1", letterSpacing: "", textTransform: "" },
  h2: { label: "H2", fontSize: "36px", fontWeight: "700", lineHeight: "1.15", letterSpacing: "", textTransform: "" },
  h3: { label: "H3", fontSize: "28px", fontWeight: "600", lineHeight: "1.2", letterSpacing: "", textTransform: "" },
  h4: { label: "H4", fontSize: "22px", fontWeight: "600", lineHeight: "1.3", letterSpacing: "", textTransform: "" },
  h5: { label: "H5", fontSize: "18px", fontWeight: "600", lineHeight: "1.4", letterSpacing: "", textTransform: "" },
  h6: { label: "H6", fontSize: "16px", fontWeight: "600", lineHeight: "1.4", letterSpacing: "", textTransform: "" },
  body: { label: "Body", fontSize: "16px", fontWeight: "400", lineHeight: "1.6", letterSpacing: "", textTransform: "" },
  button: { label: "Button", fontSize: "15px", fontWeight: "600", lineHeight: "1.2", letterSpacing: "", textTransform: "" },
});

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const SAFE_VALUE = /^[#a-z0-9.,%()\s-]{0,64}$/i;
const clean = (value) => { const text = String(value ?? "").trim(); return SAFE_VALUE.test(text) ? text : ""; };

export function slugColorId(label = "") {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "color";
}

export function normalizeStyleKit(globals = {}) {
  const customColors = (Array.isArray(globals.customColors) ? globals.customColors : [])
    .map((row) => ({ id: slugColorId(row?.id || row?.label), label: String(row?.label || row?.id || "Color").slice(0, 40), value: clean(row?.value) || "#000000" }))
    .filter((row, index, list) => SAFE_ID.test(row.id) && list.findIndex((other) => other.id === row.id) === index && !SYSTEM_COLORS.some(([id]) => id === row.id));
  const source = globals.typographyPresets && typeof globals.typographyPresets === "object" ? globals.typographyPresets : {};
  const typography = Object.fromEntries(Object.entries(TYPOGRAPHY_PRESETS).map(([key, defaults]) => {
    const row = source[key] || {};
    return [key, Object.fromEntries(["fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform"].map((field) => [field, clean(row[field]) || defaults[field]]))];
  }));
  return {
    customColors,
    typography,
    button: { paddingY: clean(globals.buttonPaddingY) || "12px", paddingX: clean(globals.buttonPaddingX) || "22px", hoverBackground: clean(globals.buttonHoverBackground) || "" },
    image: { radius: clean(globals.imageRadius) || "0px" },
  };
}

export function styleKitVariables(globals = {}) {
  const kit = normalizeStyleKit(globals);
  const vars = {};
  for (const [id, , key] of SYSTEM_COLORS) if (globals[key]) vars[`--vsn-color-${id}`] = clean(globals[key]);
  for (const row of kit.customColors) vars[`--vsn-color-${row.id}`] = row.value;
  for (const [key, row] of Object.entries(kit.typography)) {
    vars[`--vsn-${key}-size`] = row.fontSize; vars[`--vsn-${key}-weight`] = row.fontWeight; vars[`--vsn-${key}-line-height`] = row.lineHeight;
    vars[`--vsn-${key}-letter-spacing`] = row.letterSpacing || "normal"; vars[`--vsn-${key}-transform`] = row.textTransform || "none";
  }
  vars["--vsn-button-padding"] = `${kit.button.paddingY} ${kit.button.paddingX}`;
  if (kit.button.hoverBackground) vars["--vsn-button-hover-bg"] = kit.button.hoverBackground;
  vars["--vsn-image-radius"] = kit.image.radius;
  return vars;
}

// Zero-specificity base rules under `root`; widget-level styles always override.
export function styleKitCss(root) {
  const scope = (selector) => `:where(${root}) :where(${selector})`;
  const typo = (key) => `font-size:var(--vsn-${key}-size);font-weight:var(--vsn-${key}-weight);line-height:var(--vsn-${key}-line-height);letter-spacing:var(--vsn-${key}-letter-spacing);text-transform:var(--vsn-${key}-transform);`;
  return [
    `${scope("p, .vsn-text, li")}{${typo("body")}}`,
    ...["h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => `${scope(tag)}{${typo(tag)}}`),
    `${scope(".vsn-button, button[type=submit]")}{${typo("button")}padding:var(--vsn-button-padding);}`,
    `${scope(".vsn-button:hover")}{background-color:var(--vsn-button-hover-bg, inherit);}`,
    `${scope("img")}{border-radius:var(--vsn-image-radius);}`,
  ].join("\n");
}

export function globalColorValue(id, fallback = "") {
  return `var(--vsn-color-${slugColorId(id)}${fallback ? `, ${fallback}` : ""})`;
}

export function listGlobalColors(globals = {}) {
  const kit = normalizeStyleKit(globals);
  return [
    ...SYSTEM_COLORS.map(([id, label, key]) => ({ id, label, value: globals[key] || "" })).filter((row) => row.value),
    ...kit.customColors,
  ];
}
