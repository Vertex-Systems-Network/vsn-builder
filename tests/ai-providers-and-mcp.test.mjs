import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, readShopAiSettings, resolveShopAiConfig, saveShopAiSettings } from "../app/services/ai-credentials.server.js";
import { createAiExecution, generateStructuredAi } from "../app/services/ai-provider.server.js";
import { authenticateMcpToken, createMcpToken, handleMcpMessage, listMcpTokens, revokeMcpToken } from "../app/services/mcp-server.server.js";

const shop = "demo.myshopify.com";
const env = { SHOPIFY_API_SECRET: "test-secret" };
function memoryDb() {
  const settings = new Map(); const pages = [];
  return {
    pages,
    builderShopSetting: {
      findUnique: async ({ where }) => settings.get(where.shop) || null,
      upsert: async ({ where, create, update }) => { const row = { ...(settings.get(where.shop) || create), ...update }; settings.set(where.shop, row); return row; },
    },
    builderPage: { findMany: async () => pages.map((p) => ({ ...p })) },
  };
}

test("API keys are encrypted at rest and never exposed by the settings view", async () => {
  const sealed = await encryptSecret("sk-ant-123", "s1");
  assert.notEqual(sealed, "sk-ant-123");
  assert.equal(await decryptSecret(sealed, "s1"), "sk-ant-123");
  assert.equal(await decryptSecret(sealed, "other"), "");
  const db = memoryDb();
  const view = await saveShopAiSettings({ db, shop, env, provider: "claude", apiKey: "sk-ant-123", model: "claude-opus-5-5" });
  assert.equal(view.provider, "claude");
  assert.deepEqual(view.keys.anthropic, { shop: true, app: false });
  assert.doesNotMatch(JSON.stringify(view), /sk-ant/);
  const config = await resolveShopAiConfig({ db, shop, env });
  assert.deepEqual([config.provider, config.model, config.apiKey, config.keySource], ["anthropic", "claude-opus-5-5", "sk-ant-123", "shop"]);
});

test("Shopify is the default and falls back to whichever app key exists", async () => {
  const db = memoryDb();
  assert.equal((await readShopAiSettings({ db, shop, env })).provider, "shopify");
  const config = await resolveShopAiConfig({ db, shop, env: { ...env, OPENAI_API_KEY: "sk-app" } });
  assert.deepEqual([config.provider, config.keySource, config.chosen], ["openai", "app", "shopify"]);
  assert.equal((await resolveShopAiConfig({ db, shop, env })).apiKey, "");
});

const behavior = { version: "t1", instructions: "Return the plan." };
const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
async function withFetch(reply, run) {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init, body: JSON.parse(init.body) }); return new Response(JSON.stringify(reply), { status: 200 }); };
  try { return { result: await run(), calls }; } finally { globalThis.fetch = original; }
}
const input = [{ role: "user", content: [{ type: "input_text", text: "hi" }, { type: "input_image", image_url: "data:image/png;base64,QUJD" }] }];

test("Claude adapter forces a tool call with the plan schema and reads its input", async () => {
  const execution = createAiExecution({ behavior, shopConfig: { provider: "anthropic", model: "claude-sonnet-5-5", apiKey: "k" } });
  const { result, calls } = await withFetch({ id: "msg", model: "claude-sonnet-5-5", content: [{ type: "tool_use", name: "plan", input: { ok: true } }], usage: { input_tokens: 5, output_tokens: 2 } },
    () => generateStructuredAi({ execution, behavior, input, schema, schemaName: "plan", env: {} }));
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "k");
  assert.deepEqual(calls[0].body.tool_choice, { type: "tool", name: "plan" });
  assert.equal(calls[0].body.messages[0].content[1].source.media_type, "image/png");
  assert.deepEqual(result.output, { ok: true });
  assert.equal(result.usage.output_tokens, 2);
});

test("Gemini adapter uses JSON mode with the schema", async () => {
  const execution = createAiExecution({ behavior, shopConfig: { provider: "gemini", model: "gemini-2.5-flash", apiKey: "g" } });
  const { result, calls } = await withFetch({ candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } },
    () => generateStructuredAi({ execution, behavior, input, schema, env: {} }));
  assert.match(calls[0].url, /models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(calls[0].body.generationConfig.responseMimeType, "application/json");
  assert.equal(calls[0].body.contents[0].parts[1].inlineData.data, "QUJD");
  assert.deepEqual(result.output, { ok: true });
});

test("MCP: token auth, initialize, tools and revocation", async () => {
  const db = memoryDb(); db.pages.push({ id: "p1", title: "Home", template: "index", status: "draft", version: 3 });
  const { token, id } = await createMcpToken({ db, shop, label: "Cursor" });
  assert.match(token, /^vsnmcp_/);
  assert.doesNotMatch(JSON.stringify(await listMcpTokens({ db, shop })), new RegExp(token));
  const session = await authenticateMcpToken({ db, token });
  assert.equal(session.shop, shop);
  assert.equal(await authenticateMcpToken({ db, token: token.slice(0, -1) + (token.endsWith("0") ? "1" : "0") }), null);
  const init = await handleMcpMessage({ db, session, message: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } });
  assert.equal(init.result.serverInfo.name, "vsn-builder");
  const tools = (await handleMcpMessage({ db, session, message: { jsonrpc: "2.0", id: 2, method: "tools/list" } })).result.tools.map((t) => t.name);
  for (const name of ["vsn_list_pages", "vsn_list_widgets", "vsn_create_page", "vsn_page_read", "vsn_element_insert"]) assert.ok(tools.includes(name), name);
  assert.ok(!tools.some((name) => name.includes("publish")), "publish is never an MCP tool");
  const pages = await handleMcpMessage({ db, session, message: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "vsn_list_pages", arguments: {} } } });
  assert.equal(pages.result.structuredContent.items[0].id, "p1");
  assert.equal(await handleMcpMessage({ db, session, message: { jsonrpc: "2.0", method: "notifications/initialized" } }), null);
  await revokeMcpToken({ db, shop, id });
  assert.equal(await authenticateMcpToken({ db, token }), null);
});
