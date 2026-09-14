import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const SAFE_PROTOCOLS = new Set(["https:"]);
export function sanitizePlainText(value, max = 5000) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max); }

function normalizeHost(value = "") { return String(value || "").trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, ""); }
function ipv4IsNonPublic(address) { const parts=String(address||"").split(".").map(Number); if(parts.length!==4||parts.some((part)=>!Number.isInteger(part)||part<0||part>255))return true; const[a,b,c]=parts; return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===0&&c===0)||(a===192&&b===0&&c===2)||(a===192&&b===168)||(a===198&&(b===18||b===19))||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113)||a>=224; }
function ipv6IsNonPublic(address) { const value=normalizeHost(address); return value==="::"||value==="::1"||value.startsWith("::ffff:")||value.startsWith("64:ff9b:")||value.startsWith("fc")||value.startsWith("fd")||/^fe[89ab]/.test(value)||value.startsWith("ff")||value.startsWith("2001:db8:")||value.startsWith("2001:0:")||value.startsWith("2002:"); }
export function hostIsNonPublic(host) { const value=normalizeHost(host); if(!value||value==="localhost"||value.endsWith(".localhost")||value.endsWith(".local")||value.endsWith(".internal")||value.endsWith(".home.arpa"))return true; const family=isIP(value); if(family===4)return ipv4IsNonPublic(value); if(family===6)return ipv6IsNonPublic(value); return false; }

export function safeExternalUrl(value) { try { const url = new URL(String(value)); if(!SAFE_PROTOCOLS.has(url.protocol)||url.username||url.password||hostIsNonPublic(url.hostname))return null; return url.toString(); } catch { return null; } }
export function validateWebhookUrl(value) { const url=safeExternalUrl(value); if(!url)throw new Error("Webhook URL must be a public HTTPS URL without embedded credentials."); return url; }
export async function validateWebhookTarget(value) { const url=validateWebhookUrl(value); const parsed=new URL(url); try { const rows=await lookup(normalizeHost(parsed.hostname),{all:true,verbatim:true}); if(!rows.length||rows.some((row)=>hostIsNonPublic(row.address)))throw new Error("Webhook URL resolves to a private or non-public network address."); } catch(error) { if(String(error?.message||"").includes("private or non-public"))throw error; throw new Error("Webhook URL could not be resolved safely."); } return url; }

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
export function detectSpam(fields = {}) {
  const text = Object.values(fields).map((v) => typeof v === "string" ? v : "").join(" ").toLowerCase();
  if (text.length > 30000) return "payload-too-large";
  const links = (text.match(/https?:\/\//g) || []).length; if (links > 5) return "too-many-links";
  if (/\b(viagra|casino|crypto giveaway|free money)\b/i.test(text)) return "keyword";
  return null;
}
