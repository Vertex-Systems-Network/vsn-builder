// Short-lived signed token for the standalone /preview tab. The editor runs inside
// the Shopify admin iframe, where the new tab may get no window.opener (App Bridge /
// iframe sandbox), so the preview must be able to load the page on its own.
// HMAC-SHA256 over shop|pageId|exp with the app secret (WebCrypto: Node and Workers).
const encoder = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export const PREVIEW_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export async function signPreviewToken({ shop, pageId, secret, now = Date.now() }) {
  if (!secret || !shop || !pageId) return "";
  const exp = Math.floor(now / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
  return `${exp}.${await hmac(secret, `${shop}|${pageId}|${exp}`)}`;
}

export async function verifyPreviewToken({ token, shop, pageId, secret, now = Date.now() }) {
  const [expText, signature] = String(token || "").split(".");
  const exp = Number(expText);
  if (!secret || !shop || !pageId || !signature || !Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await hmac(secret, `${shop}|${pageId}|${exp}`);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export function previewSecret(context) {
  return String(context?.cloudflare?.env?.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET || "");
}
