// Shopify Admin API blog lookup via blogs(query:), not the Storefront-only
// blogByHandle field. Never interpolate user-controlled handles into GraphQL.
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;

export function normalizeShopifyContentHandle(raw) {
  const handle = String(raw ?? "").trim().toLowerCase();
  return HANDLE.test(handle) ? handle : null;
}

export function shopifyHandleQuery(raw) {
  const handle = normalizeShopifyContentHandle(raw);
  return handle === null ? null : "handle:" + handle;
}

// Shopify search can be fuzzy in certain cases. Check the returned resource
// handle before allowing a preview to display data from another blog/article.
export function selectShopifyContentByHandle(nodes, raw) {
  const handle = normalizeShopifyContentHandle(raw);
  if (!handle || !Array.isArray(nodes)) return null;
  return nodes.find((node) =>
    typeof node?.handle === "string" && node.handle.toLowerCase() === handle
  ) || null;
}
