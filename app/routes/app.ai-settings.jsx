import { authenticate } from "../shopify.server.js";
import { paidMutationDenied } from "../services/paid-mutation-guard.server.js";
import db from "../db.server.js";
import { canAccessBuilderEditor } from "../utils/builder-permissions.server.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { readShopAiSettings, resolveShopAiConfig, saveShopAiSettings } from "../services/ai-credentials.server.js";
import { createAiExecution, generateStructuredAi } from "../services/ai-provider.server.js";
import { AI_PROVIDERS, AI_PROVIDER_ORDER, MODEL_SUGGESTIONS } from "../ai/providers.js";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "../services/mcp-server.server.js";

// Editor AI settings: provider choice (Shopify default), model and the shop's own API keys.
const TEST_BEHAVIOR = Object.freeze({ version: "settings-test-1", instructions: "Reply with ok=true." });
const TEST_SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) return Response.json({ error: "Forbidden" }, { status: 403 });
  const origin = new URL(request.url).origin;
  return Response.json({ settings: await readShopAiSettings({ db, shop: session.shop }), providers: AI_PROVIDER_ORDER.map((id) => AI_PROVIDERS[id]), models: MODEL_SUGGESTIONS, mcpUrl: `${origin}/mcp`, mcpTokens: await listMcpTokens({ db, shop: session.shop }) });
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
  const { session } = await authenticate.admin(request);
  if (!(await canAccessBuilderEditor(db, session))) return Response.json({ ok: false, error: "Your role cannot change AI settings." }, { status: 403 });
  const paidDenial = await paidMutationDenied(db, session.shop); if (paidDenial) return paidDenial;
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  try {
    if (intent === "mcp-create") {
      const created = await createMcpToken({ db, shop: session.shop, label: String(form.get("label") || "") });
      return Response.json({ ok: true, intent, token: created.token, mcpTokens: await listMcpTokens({ db, shop: session.shop }), message: "Token created. Copy it now; it is shown only once." });
    }
    if (intent === "mcp-revoke") {
      await revokeMcpToken({ db, shop: session.shop, id: String(form.get("id") || "") });
      return Response.json({ ok: true, intent, mcpTokens: await listMcpTokens({ db, shop: session.shop }), message: "Token revoked." });
    }
    if (intent === "test") {
      const config = await resolveShopAiConfig({ db, shop: session.shop });
      if (!config.apiKey) return Response.json({ ok: false, intent, error: "No API key yet. Add a Claude, Gemini or OpenAI key." });
      const execution = createAiExecution({ behavior: TEST_BEHAVIOR, shopConfig: config });
      await generateStructuredAi({ execution, behavior: TEST_BEHAVIOR, input: [{ role: "user", content: [{ type: "input_text", text: "Connection test." }] }], schema: TEST_SCHEMA, schemaName: "vsn_connection_test" });
      return Response.json({ ok: true, intent, message: `Connected: ${config.provider} · ${config.model} (${config.keySource === "shop" ? "your key" : "app key"}).` });
    }
    const settings = await saveShopAiSettings({
      db, shop: session.shop,
      provider: String(form.get("provider") || "") || undefined,
      model: form.has("model") ? String(form.get("model") || "") : undefined,
      apiKey: form.has("apiKey") ? String(form.get("apiKey") || "") : undefined,
      clearKey: form.get("clearKey") === "1",
      mcpEnabled: form.has("mcpEnabled") ? form.get("mcpEnabled") === "1" : undefined,
    });
    return Response.json({ ok: true, intent, settings, message: "AI settings saved." });
  } catch (error) {
    return Response.json({ ok: false, intent, error: error instanceof Error ? error.message.replace(/sk-[\w-]+/g, "[key]") : "AI settings failed." }, { status: 400 });
  }
}
