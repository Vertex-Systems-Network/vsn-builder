// Liquid widgets execute through the Shopify app proxy, which renders `application/liquid` responses.
// Everything except the merchant's Liquid widget code is wrapped in {% raw %} so page text can never run as Liquid.
const MARKER = /<!--vsn-liquid:([A-Za-z0-9_-]*)-->/g;

// Web APIs only, so the same code runs on Node and the Cloudflare Worker.
function encode(value) {
  let binary = "";
  for (const byte of new TextEncoder().encode(String(value || ""))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value) {
  const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function liquidPlaceholder(code) {
  return `<!--vsn-liquid:${encode(code)}-->`;
}

export function hasLiquidPlaceholders(html) {
  return /<!--vsn-liquid:/.test(String(html || ""));
}

function rawSegment(text) {
  if (!text) return "";
  // A literal endraw tag inside page content would close the raw block early; emit its opening brace as a Liquid string.
  return `{% raw %}${text.replace(/\{(?=%-?\s*endraw)/g, "{% endraw %}{{ '{' }}{% raw %}")}{% endraw %}`;
}

export function buildLiquidBody(html, { enabled = true } = {}) {
  const source = String(html || "");
  if (!enabled) return { liquid: false, body: source.replace(MARKER, "") };
  let body = "{% layout none %}";
  let cursor = 0;
  for (const match of source.matchAll(MARKER)) {
    body += rawSegment(source.slice(cursor, match.index)) + decode(match[1]);
    cursor = match.index + match[0].length;
  }
  body += rawSegment(source.slice(cursor));
  return { liquid: true, body };
}
