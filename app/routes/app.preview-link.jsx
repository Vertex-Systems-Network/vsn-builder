import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { previewSecret, signPreviewToken } from "../services/preview-token.server.js";
import { storefrontPreviewUrl } from "../storefront/storefrontPreview.server.js";

// Signed storefront preview link for a draft page or a marketplace template. The
// admin opens it in a new tab, so the merchant sees the page on the shop domain.
const RESOURCE_PARAM = { product: "resourceHandle", collection: "resourceHandle", blog: "blogHandle", article: "articleHandle" };

export async function loader({ request, context }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderAction(db, session, "pages", "view"))) return Response.json({ error: "Your role cannot preview pages." }, { status: 403 });
  const url = new URL(request.url);
  const templateId = String(url.searchParams.get("template") || "").trim();
  if (templateId) return Response.json({ url: storefrontPreviewUrl(session.shop, { vsnTemplate: templateId }) });
  const pageId = String(url.searchParams.get("page") || "").trim();
  const page = pageId ? await db.builderPage.findFirst({ where: { id: pageId, shop: session.shop, deletedAt: null }, select: { id: true, template: true, resourceHandle: true } }) : null;
  if (!page) return Response.json({ error: "Page not found." }, { status: 404 });
  const token = await signPreviewToken({ shop: session.shop, pageId: page.id, secret: previewSecret(context) });
  if (!token) return Response.json({ error: "Preview signing is not configured." }, { status: 503 });
  const handle = String(url.searchParams.get("handle") || page.resourceHandle || "").trim();
  const params = { vsnPreview: page.id, vsnPreviewToken: token };
  if (RESOURCE_PARAM[page.template]) { params.template = page.template; if (handle) params[RESOURCE_PARAM[page.template]] = handle; }
  return Response.json({ url: storefrontPreviewUrl(session.shop, params) });
}
