import test from "node:test";
import assert from "node:assert/strict";
import { generateAiImage } from "../app/services/ai-image.server.js";

const shop = "demo.myshopify.com";
function db() {
  const usage = [];
  return {
    usage,
    builderShopSetting: { findUnique: async () => null, upsert: async () => ({}) },
    builderAiUsage: { create: async ({ data }) => { const row = { id: `u${usage.length}`, ...data }; usage.push(row); return row; }, update: async ({ where, data }) => Object.assign(usage.find((row) => row.id === where.id), data), count: async () => 0, aggregate: async () => ({ _count: 0 }), findMany: async () => [] },
    builderSubscription: { findUnique: async () => ({ shop, planKey: "platinum", status: "active" }) },
    $transaction: async (fn) => fn(db.current),
  };
}

test("image generation needs an OpenAI or Gemini key", async () => {
  await assert.rejects(generateAiImage({ db: db(), admin: {}, shop, prompt: "a linen shirt on a chair", env: { SHOPIFY_API_SECRET: "s", ANTHROPIC_API_KEY: "claude-only" } }), /OpenAI or Gemini key/);
});

test("generated image is uploaded to Shopify Files and returned as an image widget", async () => {
  const calls = [];
  const admin = { graphql: async (query, { variables } = {}) => { calls.push(query.match(/(stagedUploadsCreate|fileCreate|node\()/)?.[1]); const data = query.includes("stagedUploadsCreate") ? { stagedUploadsCreate: { stagedTargets: [{ url: "https://upload.test", resourceUrl: "https://res.test/x", parameters: [] }], userErrors: [] } } : query.includes("fileCreate") ? { fileCreate: { files: [{ id: "gid://shopify/MediaImage/1", fileStatus: "UPLOADED" }], userErrors: [] } } : { node: { id: variables.id, fileStatus: "READY", image: { url: "https://cdn.shopify.com/ai.png" } } }; return new Response(JSON.stringify({ data })); } };
  const original = globalThis.fetch; globalThis.fetch = async () => new Response(null, { status: 204 });
  const store = db(); db.current = store;
  try {
    const result = await generateAiImage({ db: store, admin, shop, prompt: "a linen shirt on a chair", size: "square", env: { SHOPIFY_API_SECRET: "s", GEMINI_API_KEY: "g" }, reserveUsage: async ({ db: d, operation }) => d.builderAiUsage.create({ data: { operation } }), request: { gemini: async ({ prompt, size }) => { assert.equal(size, "square"); assert.match(prompt, /linen/); return { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }; } } });
    assert.equal(result.provider, "gemini");
    assert.equal(result.file.url, "https://cdn.shopify.com/ai.png");
    assert.equal(result.nodes[0].type, "image");
    assert.equal(result.nodes[0].props.media.url, "https://cdn.shopify.com/ai.png");
    assert.deepEqual(calls.slice(0, 2), ["stagedUploadsCreate", "fileCreate"]);
  } finally { globalThis.fetch = original; }
});
