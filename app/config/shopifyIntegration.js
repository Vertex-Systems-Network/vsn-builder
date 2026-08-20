export const SHOPIFY_API_VERSION_HANDLE = "2026-07";
export const SHOPIFY_APP_PROXY = Object.freeze({
  url: "/builder-proxy",
  prefix: "apps",
  subpath: "vsn-builder",
  storefrontPath: "/apps/vsn-builder",
});
export const SHOPIFY_AUTH_CALLBACK_PATH = "/auth/callback";
export const SHOPIFY_REQUIRED_WEBHOOK_TOPICS = Object.freeze([
  "app/uninstalled",
  "app/scopes_update",
  "orders/paid",
]);
export const SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS = Object.freeze([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);
export const SHOPIFY_EXPECTED_SCOPES = Object.freeze([
  "read_files",
  "read_locales",
  "read_markets",
  "read_metaobject_definitions",
  "read_metaobjects",
  "read_online_store_pages",
  "read_orders",
  "read_products",
  "read_themes",
  "read_translations",
  "write_files",
  "write_app_proxy",
  "write_metaobject_definitions",
  "write_metaobjects",
  "write_online_store_pages",
  "write_products",
  "write_themes",
  "write_translations",
]);

export function normalizeShopifyScopes(input) {
  const rows = Array.isArray(input) ? input : String(input || "").split(",");
  return [...new Set(rows.map((row) => String(row || "").trim()).filter(Boolean))].sort();
}

export function isProductionHttpsUrl(input) {
  try {
    const url = new URL(String(input || "").trim());
    const host = url.hostname.toLowerCase();
    const ephemeral = [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"].some((suffix) => host.endsWith(suffix));
    return url.protocol === "https:" && !ephemeral && !["localhost", "127.0.0.1", "::1", "example.com"].includes(host) && !host.endsWith(".example.com");
  } catch {
    return false;
  }
}

export function productionRedirectUrl(appUrl) {
  return `${String(appUrl || "").replace(/\/+$/, "")}${SHOPIFY_AUTH_CALLBACK_PATH}`;
}
