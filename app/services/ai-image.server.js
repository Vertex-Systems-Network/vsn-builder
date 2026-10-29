// AI image generation → Shopify Files. Only OpenAI and Gemini generate images
// (Claude does not), so the shop's key for one of those is used; the result is
// uploaded through staged uploads and returned as a ready image widget.
import { resolveShopAiConfig } from "./ai-credentials.server.js";
import { createShopifyMediaFile, createStagedMediaUpload } from "./stock-media-shopify.server.js";
import { reserveAiUsage } from "./ai-builder.server.js";
import { createWidget } from "../builder/widgetRegistry.js";

const SIZES = { square: ["1024x1024", "1:1"], landscape: ["1536x1024", "3:2"], portrait: ["1024x1536", "2:3"] };
const IMAGE_MODELS = { openai: "gpt-image-1", gemini: "gemini-2.5-flash-image" };
const base64ToBytes = (data) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

async function openAiImage({ apiKey, prompt, size }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: IMAGE_MODELS.openai, prompt, size: SIZES[size][0], n: 1 }), signal: AbortSignal.timeout(120000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Image provider request failed (${response.status}).`), { status: response.status });
  const data = payload?.data?.[0]?.b64_json;
  if (!data) throw new Error("Image provider returned no image.");
  return { bytes: base64ToBytes(data), contentType: "image/png" };
}

async function geminiImage({ apiKey, prompt, size }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODELS.gemini}:generateContent`, { method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: SIZES[size][1] } } }), signal: AbortSignal.timeout(120000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Image provider request failed (${response.status}).`), { status: response.status });
  const part = (payload?.candidates?.[0]?.content?.parts || []).find((item) => item?.inlineData?.data);
  if (!part) throw new Error("Image provider returned no image.");
  return { bytes: base64ToBytes(part.inlineData.data), contentType: part.inlineData.mimeType || "image/png" };
}

async function readyFileUrl(admin, file, { attempts = 8, delayMs = 1000 } = {}) {
  let current = file;
  for (let i = 0; i < attempts && !(current.url && current.fileStatus === "READY"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const response = await admin.graphql(`#graphql
      query VsnAiImageStatus($id:ID!){ node(id:$id){ ... on MediaImage{ id fileStatus image{ url } } } }`, { variables: { id: current.id } });
    const node = (await response.json())?.data?.node;
    if (node) current = { ...current, fileStatus: node.fileStatus, url: node.image?.url || current.url };
    if (current.fileStatus === "FAILED") throw new Error("Shopify could not process the generated image.");
  }
  return current;
}

export async function generateAiImage({ db, admin, shop, prompt, size = "landscape", alt = "", env = process.env, request = { openai: openAiImage, gemini: geminiImage }, reserveUsage = reserveAiUsage }) {
  const text = String(prompt || "").trim().slice(0, 2000);
  if (text.length < 3) throw Object.assign(new Error("Describe the image you want."), { status: 400 });
  const shape = SIZES[size] ? size : "landscape";
  const config = await resolveShopAiConfig({ db, shop, env, only: ["openai", "gemini"] });
  if (!config.apiKey) throw Object.assign(new Error("Image generation needs an OpenAI or Gemini key. Add one in AI settings."), { status: 503, code: "AI_IMAGE_NOT_CONFIGURED" });
  const execution = { provider: config.provider, model: IMAGE_MODELS[config.provider], generationId: crypto.randomUUID(), behaviorVersion: "image-1" };
  const usage = await reserveUsage({ db, shop, pageId: null, operation: "image", execution });
  try {
    const image = await request[config.provider]({ apiKey: config.apiKey, prompt: text, size: shape });
    const extension = image.contentType.includes("jpeg") ? "jpg" : image.contentType.includes("webp") ? "webp" : "png";
    const staged = await createStagedMediaUpload(admin, { filename: `vsn-ai-${Date.now()}.${extension}`, contentType: image.contentType, bytes: image.bytes, resource: "IMAGE" });
    const file = await readyFileUrl(admin, await createShopifyMediaFile(admin, { stagedUrl: staged, alt: alt || text.slice(0, 120), contentType: "IMAGE" }));
    await db.builderAiUsage.update({ where: { id: usage.id }, data: { status: "completed" } }).catch(() => {});
    const widget = createWidget("image");
    const label = alt || text.slice(0, 120);
    const node = { ...widget, label: "AI image", props: { ...widget.props, sourceType: "shopify", media: { id: file.id, url: file.url, alt: label }, src: file.url, alt: label, altMode: "custom" } };
    return { ok: true, provider: config.provider, file: { id: file.id, url: file.url, status: file.fileStatus }, nodes: file.url ? [node] : [] };
  } catch (error) {
    await db.builderAiUsage.update({ where: { id: usage.id }, data: { status: "failed" } }).catch(() => {});
    throw error;
  }
}
