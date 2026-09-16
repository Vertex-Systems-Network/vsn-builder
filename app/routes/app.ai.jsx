import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { aiUsageStatus, runAiBuilder } from "../services/ai-builder.server.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DATA_CHARS = 6 * 1024 * 1024;
const MAX_CURRENT_PAGE_CHARS = 1_500_000;
const MAX_CONTEXT_CHARS = 250_000;

function parseJson(value, fallback) {
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}
function field(form, name, max) {
  const value = String(form.get(name) || "");
  if (value.length > max) throw new Response(`${name} is too large.`, { status: 413 });
  return value;
}
function imageDataField(form) {
  const value = field(form, "imageData", MAX_IMAGE_DATA_CHARS);
  if (!value) return "";
  if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(value)) {
    throw new Response("Unsupported screenshot image data.", { status: 400 });
  }
  return value;
}
function aiEnabled() {
  return getServerFeatureFlags().aiBuilderV1 === true;
}

export async function loader({ request }) {
  if (!aiEnabled()) throw new Response("AI Builder is disabled.", { status: 404 });
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) throw new Response("Forbidden", { status: 403 });
  return Response.json(await aiUsageStatus({ db, shop: session.shop }));
}

export async function action({ request }) {
  if (!aiEnabled()) return Response.json({ ok: false, code: "AI_DISABLED", error: "AI Builder is disabled." }, { status: 404 });
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) return Response.json({ ok: false, error: "Your role cannot use AI Builder." }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ ok: false, code: "AI_NOT_CONFIGURED", error: "AI Builder is not configured for this developer environment. Add OPENAI_API_KEY to your .env file and restart Shopify CLI." }, { status: 503 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ ok: false, error: "AI Builder request is too large." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const operation = field(form, "operation", 40) || "section";
    const allowed = new Set(["section", "page", "screenshot", "url", "rewrite", "responsive", "accessibility", "alternatives"]);
    if (!allowed.has(operation)) return Response.json({ ok: false, error: "Unsupported AI operation." }, { status: 400 });

    const currentPage = migrateBuilderContent(parseJson(field(form, "currentPage", MAX_CURRENT_PAGE_CHARS), []));
    const globalStyles = parseJson(field(form, "globalStyles", MAX_CONTEXT_CHARS), {});
    const commerceContext = parseJson(field(form, "commerceContext", MAX_CONTEXT_CHARS), {});
    const result = await runAiBuilder({
      db,
      shop: session.shop,
      pageId: field(form, "pageId", 200) || null,
      operation,
      prompt: field(form, "prompt", 8000),
      imageData: imageDataField(form),
      currentPage,
      globalStyles,
      pageTemplate: field(form, "pageTemplate", 120) || "page",
      sourceUrl: field(form, "sourceUrl", 2048),
      selectedElementId: field(form, "selectedElementId", 200),
      commerceContext,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "AI Builder failed.";
    if (process.env.NODE_ENV === "production") console.error("VSN AI Builder error:", message);
    else console.warn("VSN AI Builder request failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
