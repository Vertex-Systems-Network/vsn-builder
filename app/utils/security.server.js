const SAFE_PROTOCOLS = new Set(["https:"]);
export function sanitizePlainText(value, max = 5000) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max); }
export function safeExternalUrl(value) { try { const url = new URL(String(value)); return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null; } catch { return null; } }

function stripDangerousSvgMarkup(value) {
  return String(value || "")
    .replace(/<\s*(script|iframe|object|embed|foreignObject|audio|video)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|foreignObject|audio|video)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*(?:javascript:|data:text\/html)[^)]*\1\s*\)/gi, "none");
}

export function sanitizeSvg(svg) {
  let out = stripDangerousSvgMarkup(String(svg || "").slice(0, 200000));
  if (!/^\s*<svg[\s>]/i.test(out)) throw new Error("Only SVG markup is allowed.");
  if (/<\s*(script|iframe|object|embed|foreignObject)\b/i.test(out) || /\son[a-z0-9:_-]+\s*=/i.test(out) || /javascript\s*:/i.test(out)) {
    throw new Error("SVG contains executable or embedded document content that VSN cannot store safely.");
  }
  return out;
}
export function validateWebhookUrl(value) { const url = safeExternalUrl(value); if (!url) throw new Error("Webhook URL must be HTTPS."); return url; }
export function detectSpam(fields = {}) {
  const text = Object.values(fields).map((v) => typeof v === "string" ? v : "").join(" ").toLowerCase();
  if (text.length > 30000) return "payload-too-large";
  const links = (text.match(/https?:\/\//g) || []).length; if (links > 5) return "too-many-links";
  if (/\b(viagra|casino|crypto giveaway|free money)\b/i.test(text)) return "keyword";
  return null;
}
