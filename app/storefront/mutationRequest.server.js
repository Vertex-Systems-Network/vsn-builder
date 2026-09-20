import { jsonResponse } from "./responses.server.js";

export const STOREFRONT_MUTATION_MAX_BYTES = 32 * 1024 * 1024;
export const STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS = 16 * 1024;
export const STOREFRONT_WISHLIST_ITEMS_MAX_CHARS = 2 * 1024 * 1024;

function payloadTooLarge(message = "Storefront mutation payload is too large.") {
  return jsonResponse({ ok: false, error: message }, 413);
}

export async function boundedStorefrontFormData(
  request,
  { maxBytes = STOREFRONT_MUTATION_MAX_BYTES } = {},
) {
  const limit = Math.max(1, Number(maxBytes) || STOREFRONT_MUTATION_MAX_BYTES);
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw payloadTooLarge();
  }

  if (!request.body) return request.formData();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      total += value?.byteLength || 0;
      if (total > limit) {
        try {
          await reader.cancel();
        } catch {}
        throw payloadTooLarge();
      }

      if (value?.byteLength) chunks.push(Buffer.from(value));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");

  const replay = new Request(request.url, {
    method: request.method,
    headers,
    body: Buffer.concat(chunks),
    duplex: "half",
  });

  return replay.formData();
}

export function boundedStorefrontText(
  value,
  maxChars,
  message = "Storefront mutation field is too large.",
) {
  const text = String(value ?? "");
  if (text.length > maxChars) throw payloadTooLarge(message);
  return text;
}
