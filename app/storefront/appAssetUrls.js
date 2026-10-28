// Built-in template media lives on the app origin (/vsn-stock/*). The editor runs on
// that origin so relative URLs work there; the storefront runs on the shop domain,
// so server-rendered HTML/CSS must point at the absolute app URL instead.
const APP_ASSET_PREFIX = /(url\(\s*["']?|["'(=]\s*)\/vsn-stock\//g;

export function absolutizeAppAssetUrls(text, appUrl) {
  const base = String(appUrl || "").replace(/\/+$/, "");
  if (!base || !/^https:\/\//.test(base) || typeof text !== "string" || !text.includes("/vsn-stock/")) return text;
  return text.replace(APP_ASSET_PREFIX, (_match, lead) => `${lead}${base}/vsn-stock/`);
}

export function appBaseUrl(context) {
  return String(context?.cloudflare?.env?.SHOPIFY_APP_URL || (typeof globalThis.process !== "undefined" ? globalThis.process.env?.SHOPIFY_APP_URL : "") || "");
}
