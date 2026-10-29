import crypto from "node:crypto";
import { AI_BEHAVIOR_DEFAULTS } from "../ai/behaviors.js";

const SUPPORTED_PROVIDERS = Object.freeze(["openai", "anthropic", "gemini"]);
const ENV_KEYS = Object.freeze({ openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" });
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) return content.text;
    }
  }
  return "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getAiRuntimePolicy({ env = process.env } = {}) {
  return Object.freeze({
    provider: String(env.VSN_AI_PROVIDER || "openai").trim().toLowerCase(),
    model: String(env.VSN_AI_MODEL || "gpt-5-mini").trim() || "gpt-5-mini",
    timeoutMs: boundedInt(env.VSN_AI_TIMEOUT_MS, 45000, 5000, 120000),
    maxRetries: boundedInt(env.VSN_AI_MAX_RETRIES, 0, 0, 2),
    fallbackProvider: null,
    behaviorVersions: Object.freeze({
      page: String(env.VSN_AI_PAGE_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.page).trim(),
      email: String(env.VSN_AI_EMAIL_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.email).trim(),
      agent: String(env.VSN_AI_AGENT_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.agent).trim(),
      agentContext: String(env.VSN_AI_AGENT_CONTEXT_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.agentContext).trim(),
      reference: String(env.VSN_AI_REFERENCE_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.reference).trim(),
      brand: String(env.VSN_AI_BRAND_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.brand).trim(),
      quality: String(env.VSN_AI_QUALITY_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.quality).trim(),
    }),
  });
}

// shopConfig (from resolveShopAiConfig) picks the shop's provider, model and key.
export function createAiExecution({ behavior, env = process.env, shopConfig = null } = {}) {
  if (!behavior?.version) throw new Error("AI behavior version is required.");
  const policy = getAiRuntimePolicy({ env });
  const provider = shopConfig?.provider || policy.provider;
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported AI provider: ${provider || "unknown"}.`);
  }
  return Object.freeze({
    generationId: crypto.randomUUID(),
    provider,
    model: shopConfig?.model || policy.model,
    apiKey: shopConfig?.apiKey || "",
    keySource: shopConfig?.keySource || null,
    behaviorVersion: behavior.version,
    timeoutMs: policy.timeoutMs,
    maxRetries: policy.maxRetries,
    fallbackProvider: policy.fallbackProvider,
  });
}

export function isAiProviderConfigured({ execution, env = process.env } = {}) {
  if (execution?.apiKey) return true;
  const provider = execution?.provider || getAiRuntimePolicy({ env }).provider;
  return Boolean(ENV_KEYS[provider] && env?.[ENV_KEYS[provider]]);
}

async function requestOpenAi({ execution, behavior, input, schema, schemaName, schemaDescription, env }) {
  const apiKey = execution.apiKey || env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No OpenAI API key is configured.");
  const body = {
    model: execution.model,
    instructions: behavior.instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        description: schemaDescription,
        strict: true,
        schema,
      },
    },
  };

  let lastError = null;
  for (let attempt = 0; attempt <= execution.maxRetries; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(execution.timeoutMs),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`AI provider request failed (${response.status}).`);
        error.status = response.status;
        if (attempt < execution.maxRetries && RETRYABLE_STATUS.has(response.status)) {
          lastError = error;
          await wait(Math.min(2000, 250 * (2 ** attempt)));
          continue;
        }
        throw error;
      }
      const text = responseText(payload);
      if (!text) throw new Error("AI provider returned no structured output.");
      let output;
      try {
        output = JSON.parse(text);
      } catch {
        throw new Error("AI provider output could not be parsed as structured JSON.");
      }
      return {
        output,
        usage: payload?.usage || {},
        model: payload?.model || execution.model,
        responseId: payload?.id || "",
      };
    } catch (error) {
      if (attempt < execution.maxRetries && !Number.isFinite(error?.status)) {
        lastError = error;
        await wait(Math.min(2000, 250 * (2 ** attempt)));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("AI provider request failed.");
}

// Responses-API style input → provider-neutral parts.
function inputParts(input = []) {
  const parts = [];
  for (const message of Array.isArray(input) ? input : []) {
    for (const item of Array.isArray(message?.content) ? message.content : [{ type: "input_text", text: String(message?.content || "") }]) {
      if (item?.type === "input_text" && item.text) parts.push({ text: String(item.text) });
      if (item?.type === "input_image" && typeof item.image_url === "string") {
        const match = item.image_url.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
        if (match) parts.push({ image: { mediaType: match[1].toLowerCase(), data: match[2].replace(/\s+/g, "") } });
      }
    }
  }
  return parts;
}

async function withRetries(execution, run) {
  let lastError = null;
  for (let attempt = 0; attempt <= execution.maxRetries; attempt += 1) {
    try { return await run(); } catch (error) {
      lastError = error;
      const retryable = !Number.isFinite(error?.status) || RETRYABLE_STATUS.has(error.status);
      if (attempt >= execution.maxRetries || !retryable) throw error;
      await wait(Math.min(2000, 250 * (2 ** attempt)));
    }
  }
  throw lastError || new Error("AI provider request failed.");
}

async function postJson(url, headers, body, execution) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(execution.timeoutMs) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(`AI provider request failed (${response.status}).`); error.status = response.status; throw error; }
  return payload;
}

// Claude: structured output through a forced tool call whose input_schema is the plan schema.
async function requestAnthropic({ execution, behavior, input, schema, schemaName, schemaDescription, env }) {
  const apiKey = execution.apiKey || env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No Anthropic API key is configured.");
  const content = inputParts(input).map((part) => part.image ? { type: "image", source: { type: "base64", media_type: part.image.mediaType, data: part.image.data } } : { type: "text", text: part.text });
  return withRetries(execution, async () => {
    const payload = await postJson("https://api.anthropic.com/v1/messages", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, {
      model: execution.model, max_tokens: 16000, system: behavior.instructions,
      messages: [{ role: "user", content }],
      tools: [{ name: schemaName, description: schemaDescription, input_schema: schema }],
      tool_choice: { type: "tool", name: schemaName },
    }, execution);
    const tool = (payload?.content || []).find((item) => item?.type === "tool_use");
    if (!tool?.input || typeof tool.input !== "object") throw new Error("AI provider returned no structured output.");
    return { output: tool.input, usage: { input_tokens: payload?.usage?.input_tokens || 0, output_tokens: payload?.usage?.output_tokens || 0 }, model: payload?.model || execution.model, responseId: payload?.id || "" };
  });
}

// Gemini: JSON mode with the plan schema.
async function requestGemini({ execution, behavior, input, schema, env }) {
  const apiKey = execution.apiKey || env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key is configured.");
  const parts = inputParts(input).map((part) => part.image ? { inlineData: { mimeType: part.image.mediaType, data: part.image.data } } : { text: part.text });
  return withRetries(execution, async () => {
    const payload = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(execution.model)}:generateContent`, { "x-goog-api-key": apiKey }, {
      systemInstruction: { parts: [{ text: behavior.instructions }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
    }, execution);
    const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || "").join("");
    if (!text) throw new Error("AI provider returned no structured output.");
    let output;
    try { output = JSON.parse(text); } catch { throw new Error("AI provider output could not be parsed as structured JSON."); }
    return { output, usage: { input_tokens: payload?.usageMetadata?.promptTokenCount || 0, output_tokens: payload?.usageMetadata?.candidatesTokenCount || 0 }, model: payload?.modelVersion || execution.model, responseId: payload?.responseId || "" };
  });
}

export async function generateStructuredAi({
  execution,
  behavior,
  input,
  schema,
  schemaName,
  schemaDescription,
  env = process.env,
} = {}) {
  if (!execution?.generationId || !execution?.provider) throw new Error("AI execution context is required.");
  if (!behavior?.version || behavior.version !== execution.behaviorVersion) throw new Error("AI behavior/execution version mismatch.");
  if (!schema || typeof schema !== "object") throw new Error("AI structured-output schema is required.");
  if (!SUPPORTED_PROVIDERS.includes(execution.provider)) throw new Error(`Unsupported AI provider: ${execution.provider}.`);
  const request = execution.provider === "anthropic" ? requestAnthropic : execution.provider === "gemini" ? requestGemini : requestOpenAi;

  const result = await request({
    execution,
    behavior,
    input,
    schema,
    schemaName: String(schemaName || "vsn_ai_output"),
    schemaDescription: String(schemaDescription || "Structured VSN AI output"),
    env,
  });
  return {
    ...result,
    provider: execution.provider,
    behaviorVersion: execution.behaviorVersion,
    generationId: execution.generationId,
    fallbackProvider: execution.fallbackProvider,
  };
}
