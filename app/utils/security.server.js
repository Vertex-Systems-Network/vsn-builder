import { isIP } from "node:net";

const SAFE_PROTOCOLS = new Set(["https:"]);
export function sanitizePlainText(value, max = 5000) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max); }

function privateIpv4(host) {
  const parts=String(host||"").split(".").map(Number);if(parts.length!==4||parts.some((n)=>!Number.isInteger(n)||n<0||n>255))return true;
  const [a,b,c]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&c===0)||(b===0&&c===2)))||(a===198&&((b===18||b===19)||(b===51&&c===100)))||(a===203&&b===0&&c===113);
}
function privateIpv6(host) {
  const h=String(host||"").replace(/^\[|\]$/g,"").toLowerCase();
  if(h==="::"||h==="::1"||h.startsWith("fc")||h.startsWith("fd")||/^fe[89ab]/.test(h)||h.startsWith("ff")||h.startsWith("2001:db8:"))return true;
  const mapped=h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);return mapped?privateIpv4(mapped[1]):false;
}
function unsafeExternalHost(hostname) {
  const host=String(hostname||"").replace(/^\[|\]$/g,"").toLowerCase();
  if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))return true;
  const family=isIP(host);return family===4?privateIpv4(host):family===6?privateIpv6(host):false;
}
export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    if(!SAFE_PROTOCOLS.has(url.protocol)||url.username||url.password||unsafeExternalHost(url.hostname))return null;
    return url.toString();
  } catch { return null; }
}

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
export function validateWebhookUrl(value) { const url = safeExternalUrl(value); if (!url) throw new Error("Webhook URL must be a public HTTPS URL without embedded credentials."); return url; }
export function detectSpam(fields = {}) {
  const text = Object.values(fields).map((v) => typeof v === "string" ? v : "").join(" ").toLowerCase();
  if (text.length > 30000) return "payload-too-large";
  const links = (text.match(/https?:\/\//g) || []).length; if (links > 5) return "too-many-links";
  if (/\b(viagra|casino|crypto giveaway|free money)\b/i.test(text)) return "keyword";
  return null;
}
