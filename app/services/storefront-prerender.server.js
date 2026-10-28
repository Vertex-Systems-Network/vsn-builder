// Publish-safe storefront prerender cache.
// A cacheable builder fragment is stored in an app-data metafield so the theme
// app embed can print it inline (Liquid, same response as the Shopify page) and
// the runtime swaps it in without a network round trip or loading state.
// The key must match the one computed in blocks/vsn-page-renderer.liquid.

export const PRERENDER_NAMESPACE = "vsn_prerender";
export const PRERENDER_TTL_SECONDS = 6 * 60 * 60;
export const PRERENDER_MAX_BYTES = 256 * 1024;
// Product/collection stay on the live fetch: price and stock must never be stale.
export const PRERENDER_TEMPLATES = Object.freeze(["index", "blog", "article"]);

const PERSONALIZED_KEYS = /"(customer|cart|condition|conditions|visibilityRules|serverConditions|personaliz)[A-Za-z]*"\s*:/i;

export function prerenderKey(template, handle = "") {
  const raw = `p_${String(template || "")}__${String(handle || "") || "default"}`.toLowerCase();
  return raw.replace(/[^a-z0-9_-]/g, "-").slice(0, 64);
}

function isEmpty(value) {
  if (!value) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function isPrerenderCacheable({ template, html = "", experiment = null, localizationEnabled = false, hasLiquid = false, dynamicData = [], elementGroups = [], ruleCount = 0 } = {}) {
  if (!PRERENDER_TEMPLATES.includes(String(template || ""))) return false;
  if (experiment || localizationEnabled || hasLiquid || ruleCount > 0) return false;
  if (!html || new TextEncoder().encode(html).length > PRERENDER_MAX_BYTES) return false;
  if (!dynamicData.every(isEmpty)) return false;
  return !PERSONALIZED_KEYS.test(JSON.stringify(elementGroups || []));
}

async function appInstallationId(admin) {
  const response = await admin.graphql(`#graphql\nquery VsnPrerenderInstallation { currentAppInstallation { id } }`);
  const result = await response.json();
  return result.data?.currentAppInstallation?.id || null;
}

export async function storePrerender(admin, { key, html, now = Date.now() }) {
  const ownerId = await appInstallationId(admin);
  if (!ownerId) return false;
  const value = JSON.stringify({ html, exp: Math.floor(now / 1000) + PRERENDER_TTL_SECONDS });
  const response = await admin.graphql(`#graphql
    mutation VsnPrerenderStore($metafields:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$metafields){ userErrors{ message } } }
  `, { variables: { metafields: [{ ownerId, namespace: PRERENDER_NAMESPACE, key, type: "json", value }] } });
  const result = await response.json();
  return !(result.data?.metafieldsSet?.userErrors || []).length;
}

// Drops every cached fragment; called whenever published content changes.
export async function clearPrerenders(admin) {
  const response = await admin.graphql(`#graphql
    query VsnPrerenderList($namespace:String!){ currentAppInstallation { id metafields(namespace:$namespace, first:250){ nodes{ key } } } }
  `, { variables: { namespace: PRERENDER_NAMESPACE } });
  const result = await response.json();
  const installation = result.data?.currentAppInstallation;
  const keys = (installation?.metafields?.nodes || []).map((node) => node.key).filter(Boolean);
  if (!installation?.id || !keys.length) return 0;
  await admin.graphql(`#graphql
    mutation VsnPrerenderClear($metafields:[MetafieldIdentifierInput!]!){ metafieldsDelete(metafields:$metafields){ userErrors{ message } } }
  `, { variables: { metafields: keys.map((key) => ({ ownerId: installation.id, namespace: PRERENDER_NAMESPACE, key })) } });
  return keys.length;
}
