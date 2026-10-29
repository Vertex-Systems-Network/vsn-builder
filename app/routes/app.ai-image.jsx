import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";
import { paidMutationDenied } from "../services/paid-mutation-guard.server.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { generateAiImage } from "../services/ai-image.server.js";

// Generates an image with the shop's OpenAI/Gemini key and stores it in Shopify Files.
export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { admin, session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) return Response.json({ ok: false, error: "Your role cannot use AI." }, { status: 403 });
  const paidDenial = await paidMutationDenied(db, session.shop); if (paidDenial) return paidDenial;
  const form = await request.formData();
  try {
    return Response.json(await generateAiImage({ db, admin, shop: session.shop, prompt: String(form.get("prompt") || ""), size: String(form.get("size") || "landscape"), alt: String(form.get("alt") || "") }));
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
    return Response.json({ ok: false, code: error?.code || "AI_IMAGE_FAILED", error: error instanceof Error ? error.message : "Image generation failed." }, { status: status === 429 ? 429 : status >= 500 ? 502 : status });
  }
}
