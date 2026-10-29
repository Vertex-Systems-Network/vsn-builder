// Storefront preview through the app proxy: the merchant sees a draft page or a
// marketplace template on the real shop domain, in a new tab outside the admin.
// Drafts need a short-lived signed token; built-in templates are public catalog data.
import { BUILTIN_MARKETPLACE_CATALOG } from "../data/marketplaceCatalog.js";
import { verifyPreviewToken } from "../services/preview-token.server.js";

export const STOREFRONT_PREVIEW_PATH = "/apps/vsn-builder/preview";

export function isStorefrontPreviewRequest(url) {
  return url.searchParams.has("vsnPreview") || url.searchParams.has("vsnTemplate");
}

// Returns { page } to render, { error } for a refused request, or null when not a preview.
export async function resolveStorefrontPreview({ db, url, shop, secret, catalog = BUILTIN_MARKETPLACE_CATALOG }) {
  const pageId = String(url.searchParams.get("vsnPreview") || "").trim();
  if (pageId) {
    const token = String(url.searchParams.get("vsnPreviewToken") || "");
    if (!(await verifyPreviewToken({ token, shop, pageId, secret }))) return { error: "This preview link has expired. Click Preview in the VSN editor again." };
    const page = await db.builderPage.findFirst({ where: { id: pageId, shop, deletedAt: null } });
    return page ? { page: { ...page, publishedJson: page.contentJson } } : { error: "This page no longer exists." };
  }
  const templateId = String(url.searchParams.get("vsnTemplate") || "").trim();
  if (templateId) {
    const item = catalog.find((entry) => entry.catalogId === templateId);
    if (!item) return { error: "This template is not available." };
    return { page: { id: `marketplace-${item.catalogId}`, shop, title: item.title, template: "page", handle: "", isDefault: false, publishedJson: JSON.stringify(item.content || []) } };
  }
  return null;
}

export function storefrontPreviewUrl(shop, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return `https://${shop}${STOREFRONT_PREVIEW_PATH}?${query}`;
}

// Previews are private drafts: never cached by the proxy or indexed.
export function privatePreviewResponse(response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
