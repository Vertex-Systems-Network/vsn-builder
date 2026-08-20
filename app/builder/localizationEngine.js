const RTL_LANGS = new Set(["ar", "fa", "he", "ur", "ps", "sd", "dv", "ku"]);

const TEXT_KEYS = new Set([
  "text", "title", "subtitle", "description", "heading", "subheading", "eyebrow", "caption", "label", "buttonText", "buttonLabel", "ctaText", "placeholder", "content", "quote", "author", "notice", "message", "prefix", "suffix", "badgeText", "emptyText", "successMessage", "errorMessage", "html",
]);
const MEDIA_KEYS = new Set(["alt", "src", "image", "imageUrl", "videoUrl", "poster", "backgroundImage", "backgroundImageUrl", "mediaUrl"]);
const LINK_KEYS = new Set(["url", "href", "link", "buttonUrl", "ctaUrl"]);

export function normalizeLocale(value = "") {
  const raw = String(value || "").trim().replace(/_/g, "-");
  if (!raw) return "";
  const [language, ...rest] = raw.split("-");
  return [language.toLowerCase(), ...rest.map((part) => part.length === 2 ? part.toUpperCase() : part)].join("-");
}

export function localeLanguage(value = "") {
  return normalizeLocale(value).split("-")[0].toLowerCase();
}

export function localeDirection(value = "") {
  return RTL_LANGS.has(localeLanguage(value)) ? "rtl" : "ltr";
}

export function isRtlLocale(value = "") {
  return localeDirection(value) === "rtl";
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function isLocalizableProp(key, value) {
  if (typeof value !== "string") return false;
  key = String(key || "").split(".").at(-1) || "";
  if (TEXT_KEYS.has(key) || MEDIA_KEYS.has(key) || LINK_KEYS.has(key)) return true;
  if (/^(text|title|subtitle|description|heading|caption|label|placeholder|alt|message|content)/i.test(key)) return true;
  if (/(image|video|media)(Url|Src)?$/i.test(key)) return true;
  return false;
}

export function collectTranslatableFields(elements = []) {
  const fields = [];
  const walkProp = (node, value, propPath = [], depth = 0) => {
    if (depth > 7 || value == null) return;
    if (typeof value === "string") {
      const leaf = String(propPath.at(-1) || "");
      const key = propPath.join(".");
      if (!key || !isLocalizableProp(leaf, value)) return;
      fields.push({
        id: `${node.id}:${key}`,
        nodeId: String(node.id || ""),
        nodeType: String(node.type || "unknown"),
        nodeLabel: String(node.label || node.type || "Element"),
        key,
        value,
        kind: MEDIA_KEYS.has(leaf) || /(image|video|media|poster|src)/i.test(leaf) ? "media" : LINK_KEYS.has(leaf) || /(url|href|link)$/i.test(leaf) ? "link" : "text",
      });
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 250).forEach((item, index) => walkProp(node, item, [...propPath, String(index)], depth + 1));
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (["style", "styles", "query", "conditions", "interaction", "interactions", "responsive"].includes(key)) continue;
        walkProp(node, child, [...propPath, key], depth + 1);
      }
    }
  };
  const walk = (nodes) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node || typeof node !== "object") continue;
      if (["template-settings", "global-styles"].includes(node.type)) continue;
      const props = node.props && typeof node.props === "object" && !Array.isArray(node.props) ? node.props : {};
      for (const [key, value] of Object.entries(props)) walkProp(node, value, [key], 0);
      walk(node.children || []);
    }
  };
  walk(elements);
  return fields;
}

export function sanitizeLocalizationOverrides(input = {}) {
  const result = {};
  for (const [nodeId, entry] of Object.entries(input && typeof input === "object" && !Array.isArray(input) ? input : {})) {
    if (!nodeId || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const props = {};
    for (const [key, value] of Object.entries(entry.props && typeof entry.props === "object" ? entry.props : {})) {
      if (typeof value !== "string" || !isLocalizableProp(key, value)) continue;
      props[key] = value.slice(0, 100000);
    }
    if (Object.keys(props).length) result[nodeId] = { props };
  }
  return result;
}

export function setLocalizationOverride(overrides = {}, nodeId, key, value) {
  const next = sanitizeLocalizationOverrides(overrides);
  if (!nodeId || !key) return next;
  const text = String(value ?? "");
  if (!next[nodeId]) next[nodeId] = { props: {} };
  next[nodeId].props[key] = text;
  return next;
}

export function removeLocalizationOverride(overrides = {}, nodeId, key) {
  const next = sanitizeLocalizationOverrides(overrides);
  if (!next[nodeId]?.props) return next;
  delete next[nodeId].props[key];
  if (!Object.keys(next[nodeId].props).length) delete next[nodeId];
  return next;
}

export function mergeLocalizationOverrides(...layers) {
  const result = {};
  for (const layer of layers) {
    const safe = sanitizeLocalizationOverrides(layer);
    for (const [nodeId, entry] of Object.entries(safe)) {
      result[nodeId] = { props: { ...(result[nodeId]?.props || {}), ...(entry.props || {}) } };
    }
  }
  return result;
}

function setPathValue(target, path, value) {
  const segments = String(path || "").split(".").filter(Boolean);
  if (!segments.length) return target;
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const numeric = /^\d+$/.test(nextSegment);
    if (Array.isArray(cursor)) {
      const position = Number(segment);
      if (!Number.isInteger(position) || position < 0 || position > 500) return target;
      if (cursor[position] == null || typeof cursor[position] !== "object") cursor[position] = numeric ? [] : {};
      cursor = cursor[position];
    } else {
      if (cursor[segment] == null || typeof cursor[segment] !== "object") cursor[segment] = numeric ? [] : {};
      cursor = cursor[segment];
    }
  }
  const leaf = segments.at(-1);
  if (Array.isArray(cursor) && /^\d+$/.test(leaf)) cursor[Number(leaf)] = value;
  else cursor[leaf] = value;
  return target;
}

export function applyLocalizationOverrides(elements = [], overrides = {}) {
  const safe = sanitizeLocalizationOverrides(overrides);
  const walk = (nodes) => (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (!node || typeof node !== "object") return node;
    const entry = safe[String(node.id || "")];
    const props = clone(node.props || {});
    for (const [path, value] of Object.entries(entry?.props || {})) setPathValue(props, path, value);
    return {
      ...node,
      props,
      children: walk(node.children || []),
    };
  });
  return walk(clone(elements));
}

export function translationCompletion(elements = [], overrides = {}) {
  const fields = collectTranslatableFields(elements);
  if (!fields.length) return { total: 0, translated: 0, missing: 0, percent: 100 };
  const safe = sanitizeLocalizationOverrides(overrides);
  let translated = 0;
  for (const field of fields) {
    const value = safe[field.nodeId]?.props?.[field.key];
    if (typeof value === "string" && value.trim()) translated += 1;
  }
  return { total: fields.length, translated, missing: Math.max(0, fields.length - translated), percent: Math.round((translated / fields.length) * 100) };
}

function containsRtl(text) { return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(String(text || "")); }
function containsLatin(text) { return /[A-Za-z]/.test(String(text || "")); }

export function localizationDiagnostics({ locale = "", elements = [], overrides = {}, seo = {} } = {}) {
  const direction = localeDirection(locale);
  const safe = sanitizeLocalizationOverrides(overrides);
  const fields = collectTranslatableFields(elements);
  const issues = [];
  for (const field of fields) {
    const translated = safe[field.nodeId]?.props?.[field.key];
    if (typeof translated !== "string" || !translated.trim()) continue;
    if (direction === "rtl" && containsLatin(translated) && containsRtl(translated)) issues.push({ level: "info", code: "mixed-direction", nodeId: field.nodeId, key: field.key, message: `${field.nodeLabel} · ${field.key} mixes RTL and Latin scripts. Verify punctuation and number order.` });
    if (direction === "rtl" && field.kind === "text" && !containsRtl(translated) && translated.length > 8) issues.push({ level: "warn", code: "rtl-script-missing", nodeId: field.nodeId, key: field.key, message: `${field.nodeLabel} · ${field.key} contains no RTL characters for ${locale}.` });
  }
  if (!String(seo?.seoTitle || "").trim()) issues.push({ level: "warn", code: "seo-title-missing", message: `Localized meta title is missing for ${locale || "this locale"}.` });
  if (!String(seo?.seoDescription || "").trim()) issues.push({ level: "warn", code: "seo-description-missing", message: `Localized meta description is missing for ${locale || "this locale"}.` });
  return { direction, issues };
}

export function normalizeLocaleCatalog(locales = [], fallback = "en") {
  const seen = new Set();
  const normalized = [];
  for (const item of Array.isArray(locales) ? locales : []) {
    const locale = normalizeLocale(typeof item === "string" ? item : item?.locale);
    if (!locale || seen.has(locale)) continue;
    seen.add(locale);
    normalized.push({
      locale,
      name: typeof item === "object" && item?.name ? String(item.name) : locale,
      primary: Boolean(typeof item === "object" && item?.primary),
      published: typeof item === "object" ? item?.published !== false : true,
      direction: localeDirection(locale),
    });
  }
  const base = normalizeLocale(fallback) || "en";
  if (!seen.has(base)) normalized.unshift({ locale: base, name: base, primary: true, published: true, direction: localeDirection(base) });
  if (!normalized.some((item) => item.primary)) normalized[0].primary = true;
  return normalized;
}

export function normalizeMarketCatalog(markets = []) {
  const seen = new Set();
  return (Array.isArray(markets) ? markets : []).flatMap((item) => {
    const key = String(item?.handle || item?.id || item?.key || "").trim();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ id: String(item?.id || ""), key, handle: String(item?.handle || key), name: String(item?.name || key), status: String(item?.status || "ACTIVE") }];
  });
}
