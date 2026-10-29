// Per-shop AI provider choice and bring-your-own API keys.
// Keys are encrypted (AES-GCM, WebCrypto) with a key derived from the app secret,
// stored in BuilderShopSetting.appSettingsJson.ai and never returned to the browser.
import { AI_PROVIDERS, DEFAULT_SHOP_AI_PROVIDER, apiProviderFor, defaultModelFor } from "../ai/providers.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function cipherKey(secret) {
  if (!secret) throw new Error("AI key storage needs SHOPIFY_API_SECRET.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`vsn-ai-keys:${secret}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cipherKey(secret), encoder.encode(String(plain)));
  return `v1.${b64(iv)}.${b64(data)}`;
}

export async function decryptSecret(sealed, secret) {
  const [version, iv, data] = String(sealed || "").split(".");
  if (version !== "v1" || !iv || !data) return "";
  try { return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await cipherKey(secret), unb64(data))); } catch { return ""; }
}

function parse(value) { try { return JSON.parse(value || "{}") || {}; } catch { return {}; } }
const appSecret = (env) => String(env?.SHOPIFY_API_SECRET || "");
const ENV_KEYS = Object.freeze({ openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" });

async function readRaw(db, shop) {
  const row = await Promise.resolve(db?.builderShopSetting?.findUnique?.({ where: { shop }, select: { appSettingsJson: true } })).catch(() => null);
  return parse(row?.appSettingsJson);
}

// Safe view for the editor: provider, model and which keys exist (never the keys).
export async function readShopAiSettings({ db, shop, env = process.env }) {
  const ai = (await readRaw(db, shop)).ai || {};
  const provider = AI_PROVIDERS[ai.provider] ? ai.provider : DEFAULT_SHOP_AI_PROVIDER;
  const keys = Object.fromEntries(Object.keys(ENV_KEYS).map((id) => [id, { shop: Boolean(ai.keys?.[id]), app: Boolean(env?.[ENV_KEYS[id]]) }]));
  return { provider, models: { ...(ai.models || {}) }, keys, mcpEnabled: ai.mcpEnabled === true };
}

export async function saveShopAiSettings({ db, shop, env = process.env, provider, model, apiKey, clearKey = false, mcpEnabled }) {
  if (provider && !AI_PROVIDERS[provider]) throw new Error("Unknown AI provider.");
  const current = await readRaw(db, shop);
  const ai = { ...(current.ai || {}), keys: { ...(current.ai?.keys || {}) }, models: { ...(current.ai?.models || {}) } };
  if (provider) ai.provider = provider;
  const apiProvider = apiProviderFor(provider || ai.provider);
  if (apiProvider && typeof model === "string" && model.trim()) ai.models[apiProvider] = model.trim().slice(0, 80);
  if (apiProvider && clearKey) delete ai.keys[apiProvider];
  else if (apiProvider && typeof apiKey === "string" && apiKey.trim()) ai.keys[apiProvider] = await encryptSecret(apiKey.trim().slice(0, 400), appSecret(env));
  if (typeof mcpEnabled === "boolean") ai.mcpEnabled = mcpEnabled;
  const next = { ...current, ai };
  await db.builderShopSetting.upsert({ where: { shop }, create: { shop, appSettingsJson: JSON.stringify(next) }, update: { appSettingsJson: JSON.stringify(next) } });
  return readShopAiSettings({ db, shop, env });
}

// Which API backs a generation for this shop: the shop's own key first, then the
// app-level key. Shopify (Sidekick) and MCP clients have no generation API, so the
// in-editor generator falls back to the first API with a key.
export async function resolveShopAiConfig({ db, shop, env = process.env }) {
  const raw = db && shop ? (await readRaw(db, shop)).ai || {} : {};
  const chosen = AI_PROVIDERS[raw.provider] ? raw.provider : DEFAULT_SHOP_AI_PROVIDER;
  const order = [apiProviderFor(chosen), "anthropic", "openai", "gemini"].filter((id, index, list) => id && list.indexOf(id) === index);
  for (const id of order) {
    const shopKey = raw.keys?.[id] ? await decryptSecret(raw.keys[id], appSecret(env)) : "";
    const apiKey = shopKey || String(env?.[ENV_KEYS[id]] || "");
    if (apiKey) return { provider: id, model: raw.models?.[id] || (id === "openai" && env?.VSN_AI_MODEL) || defaultModelFor(id), apiKey, keySource: shopKey ? "shop" : "app", chosen };
  }
  return { provider: apiProviderFor(chosen) || "anthropic", model: defaultModelFor(apiProviderFor(chosen) || "anthropic"), apiKey: "", keySource: null, chosen };
}
