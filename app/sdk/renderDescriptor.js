const ALLOWED_TAGS = new Set(["div","span","strong","em","small","p","section","article","aside","nav","a","button","ul","ol","li","figure","figcaption","img"]);
const SAFE_STYLE_KEY = /^[a-zA-Z][a-zA-Z0-9-]{0,64}$/;
const SAFE_DATA_ATTR = /^(data|aria)-[a-z0-9_.:-]+$/i;
const SAFE_ATTRS = new Set(["className","id","title","role","href","target","rel","alt","src","width","height","loading","decoding","type","disabled","tabIndex","style"]);

export function vsnElement(tag, props = {}, children = []) {
  return Object.freeze({
    __vsnSdkDescriptor: true,
    tag: ALLOWED_TAGS.has(String(tag || "")) ? String(tag) : "div",
    props: props && typeof props === "object" && !Array.isArray(props) ? { ...props } : {},
    children: Array.isArray(children) ? children : [children],
  });
}

export function isVsnRenderDescriptor(value) {
  return Boolean(value && typeof value === "object" && value.__vsnSdkDescriptor === true && ALLOWED_TAGS.has(String(value.tag || "")));
}

function safeUrl(value, { image = false } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("#")) return raw;
  try {
    const url = new URL(raw);
    if (["https:", "http:"].includes(url.protocol)) return url.toString();
    if (!image && ["mailto:", "tel:"].includes(url.protocol)) return raw;
  } catch {}
  return "";
}

function safeStyleValue(value) {
  const text = String(value ?? "").slice(0, 500);
  if (/expression\s*\(|javascript\s*:|@import|behavior\s*:|url\s*\(\s*['\"]?\s*(?:javascript|data):/i.test(text)) return "";
  return text;
}

export function sanitizeVsnDescriptorProps(props = {}) {
  const out = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (/^on/i.test(key) || key === "dangerouslySetInnerHTML" || key === "ref" || key === "key") continue;
    if (key === "style") {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const style = {};
      for (const [styleKey, styleValue] of Object.entries(value).slice(0, 80)) {
        if (!SAFE_STYLE_KEY.test(styleKey)) continue;
        const safe = safeStyleValue(styleValue);
        if (safe !== "") style[styleKey] = typeof styleValue === "number" ? styleValue : safe;
      }
      out.style = style;
      continue;
    }
    if (!SAFE_ATTRS.has(key) && !SAFE_DATA_ATTR.test(key)) continue;
    if (key === "href") { const safe = safeUrl(value); if (safe) out.href = safe; continue; }
    if (key === "src") { const safe = safeUrl(value, { image: true }); if (safe) out.src = safe; continue; }
    if (key === "target") { out.target = value === "_blank" ? "_blank" : "_self"; continue; }
    if (key === "rel") { out.rel = String(value || "").replace(/[^a-z\s-]/gi, "").slice(0, 120); continue; }
    if (typeof value === "boolean" || typeof value === "number") out[key] = value;
    else out[key] = String(value ?? "").slice(0, 1000);
  }
  if (out.target === "_blank") out.rel = "noopener noreferrer";
  return out;
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function styleToString(style = {}) {
  return Object.entries(style).map(([key, value]) => `${String(key).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}:${safeStyleValue(value)}`).filter((row) => !row.endsWith(":")) .join(";");
}

export function serializeVsnDescriptor(value) {
  if (value == null || value === false) return "";
  if (typeof value === "string" || typeof value === "number") return escapeText(value);
  if (Array.isArray(value)) return value.map(serializeVsnDescriptor).join("");
  if (!isVsnRenderDescriptor(value)) throw new Error("Third-party storefront renderers must return VSN render descriptors, text, or arrays of descriptors.");
  const tag = value.tag;
  const props = sanitizeVsnDescriptorProps(value.props || {});
  const attrs = [];
  for (const [key, raw] of Object.entries(props)) {
    if (key === "style") { const css = styleToString(raw); if (css) attrs.push(`style="${escapeText(css)}"`); continue; }
    const attr = key === "className" ? "class" : key === "tabIndex" ? "tabindex" : key;
    if (raw === true) attrs.push(attr);
    else if (raw !== false && raw != null && raw !== "") attrs.push(`${attr}="${escapeText(raw)}"`);
  }
  const attrText = attrs.length ? ` ${attrs.join(" ")}` : "";
  if (tag === "img") return `<img${attrText}>`;
  return `<${tag}${attrText}>${serializeVsnDescriptor(value.children || [])}</${tag}>`;
}
