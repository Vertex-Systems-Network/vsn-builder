import crypto from "node:crypto";
import { AI_BEHAVIOR_DEFAULTS } from "../ai/behaviors.js";

const SUPPORTED_PROVIDERS = Object.freeze(["openai"]);
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
      brand: String(env.VSN_AI_BRAND_BEHAVIOR_VERSION || AI_BEHAVIOR_DEFAULTS.brand).trim(),
    }),
  });
}

export function createAiExecution({ behavior, env = process.env } = {}) {
  if (!behavior?.version) throw new Error("AI behavior version is required.");
  const policy = getAiRuntimePolicy({ env });
  if (!SUPPORTED_PROVIDERS.includes(policy.provider)) {
    throw new Error(`Unsupported AI provider: ${policy.provider || "unknown"}.`);
  }
  return Object.freeze({
    generationId: crypto.randomUUID(),
    provider: policy.provider,
    model: policy.model,
    behaviorVersion: behavior.version,
    timeoutMs: policy.timeoutMs,
    maxRetries: policy.maxRetries,
    fallbackProvider: policy.fallbackProvider,
  });
}

export function isAiProviderConfigured({ execution, env = process.env } = {}) {
  const provider = execution?.provider || getAiRuntimePolicy({ env }).provider;
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY);
  return false;
}

async function requestOpenAi({ execution, behavior, input, schema, schemaName, schemaDescription, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the VSN server.");
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
  if (execution.provider !== "openai") throw new Error(`Unsupported AI provider: ${execution.provider}.`);

  const result = await requestOpenAi({
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
