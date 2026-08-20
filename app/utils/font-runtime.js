export const SYSTEM_FONT_FAMILIES = new Set([
  "arial",
  "helvetica",
  "georgia",
  "times new roman",
  "trebuchet ms",
  "verdana",
  "tahoma",
  "courier new",
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "sans-serif",
  "serif",
  "monospace",
  "inherit",
]);

export function primaryFontFamily(value = "") {
  return String(value || "").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

function addPrimitiveValues(value, out) {
  if (value == null || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((item) => addPrimitiveValues(item, out));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => addPrimitiveValues(item, out));
    return;
  }
  out.add(String(value));
}

export function normalizeFontWeights(value, fallback = [400]) {
  const raw = new Set();
  addPrimitiveValues(value, raw);
  const weights = [...raw]
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item) && item >= 100 && item <= 900)
    .map((item) => Math.round(item / 100) * 100);
  return [...new Set(weights.length ? weights : fallback)].sort((a, b) => a - b);
}

export function normalizeFontStyles(value, fallback = ["normal"]) {
  const raw = new Set();
  addPrimitiveValues(value, raw);
  const styles = [...raw]
    .map((item) => String(item || "").toLowerCase())
    .map((item) => item === "oblique" ? "italic" : item)
    .filter((item) => item === "normal" || item === "italic");
  return [...new Set(styles.length ? styles : fallback)];
}

export function mergeFontUsage(target, familyValue, { weight, weights, style, styles } = {}) {
  const family = primaryFontFamily(familyValue);
  if (!family || family.toLowerCase() === "inherit") return target;
  const key = family.toLowerCase();
  const existing = target.get(key) || { family, weights: new Set(), styles: new Set() };
  normalizeFontWeights(weights ?? weight).forEach((item) => existing.weights.add(item));
  normalizeFontStyles(styles ?? style).forEach((item) => existing.styles.add(item));
  target.set(key, existing);
  return target;
}

export function collectFontUsages(value, target = new Map(), key = "") {
  if (value == null) return target;
  if (Array.isArray(value)) {
    value.forEach((item) => collectFontUsages(item, target, key));
    return target;
  }
  if (typeof value === "object") {
    if (typeof value.fontFamily === "string") {
      mergeFontUsage(target, value.fontFamily, { weight: value.fontWeight, style: value.fontStyle });
    }
    if (typeof value.headingFontFamily === "string") {
      mergeFontUsage(target, value.headingFontFamily, { weight: value.headingFontWeight, style: value.headingFontStyle });
    }
    for (const [childKey, child] of Object.entries(value)) {
      if ((childKey === "fontFamily" || childKey === "headingFontFamily") && typeof child === "string") continue;
      collectFontUsages(child, target, childKey);
    }
    return target;
  }
  if (typeof value === "string" && /fontfamily$/i.test(key)) mergeFontUsage(target, value);
  return target;
}

function catalogVariants(font = {}) {
  const weights = normalizeFontWeights(font.weights, []);
  const styles = normalizeFontStyles(font.styles, []);
  return { weights, styles };
}

export function resolveGoogleUsage(usage, font = {}) {
  const available = catalogVariants(font);
  let weights = [...(usage?.weights || [])];
  let styles = [...(usage?.styles || [])];
  if (available.weights.length) {
    const supported = weights.filter((weight) => available.weights.includes(weight));
    weights = supported.length ? supported : available.weights.includes(400) ? [400] : [available.weights[0]];
  }
  if (available.styles.length) {
    const supported = styles.filter((style) => available.styles.includes(style));
    styles = supported.length ? supported : available.styles.includes("normal") ? ["normal"] : [available.styles[0]];
  }
  return {
    family: usage.family,
    weights: weights.length ? weights : [400],
    styles: styles.length ? styles : ["normal"],
    hasVariantMetadata: Boolean(available.weights.length || available.styles.length),
  };
}

export function buildGoogleFontHref(usages, googleCatalog = []) {
  const catalogByFamily = new Map((googleCatalog || []).map((font) => [String(font.family || "").toLowerCase(), font]));
  const params = [];
  for (const usage of usages instanceof Map ? usages.values() : usages || []) {
    const family = primaryFontFamily(usage?.family);
    if (!family || SYSTEM_FONT_FAMILIES.has(family.toLowerCase())) continue;
    const font = catalogByFamily.get(family.toLowerCase()) || {};
    const resolved = resolveGoogleUsage({ ...usage, family }, font);
    const encodedFamily = encodeURIComponent(family).replace(/%20/g, "+");
    if (!resolved.hasVariantMetadata) {
      params.push(`family=${encodedFamily}`);
      continue;
    }
    const weights = [...new Set(resolved.weights)].sort((a, b) => a - b);
    const styles = [...new Set(resolved.styles)];
    if (styles.includes("italic")) {
      const rows = [];
      if (styles.includes("normal")) weights.forEach((weight) => rows.push(`0,${weight}`));
      weights.forEach((weight) => rows.push(`1,${weight}`));
      params.push(`family=${encodedFamily}:ital,wght@${rows.join(";")}`);
    } else {
      params.push(`family=${encodedFamily}:wght@${weights.join(";")}`);
    }
  }
  return params.length ? `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap` : "";
}
