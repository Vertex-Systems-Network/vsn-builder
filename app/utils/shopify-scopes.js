// Shopify stores granted scopes compressed: write_X implies read_X, so the
// session lists "write_themes" but never "read_themes". Expand before checking.
export function expandShopifyScopes(value) {
  const list = (Array.isArray(value) ? value : String(value || "").split(",")).map((item) => String(item).trim()).filter(Boolean);
  const scopes = new Set(list);
  for (const scope of list) {
    const match = scope.match(/^(unauthenticated_)?write_(.+)$/);
    if (match) scopes.add(`${match[1] || ""}read_${match[2]}`);
  }
  return scopes;
}
