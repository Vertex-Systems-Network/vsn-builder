import {
  REFERENCE_ANALYSIS_SCHEMA,
  normalizeReferenceAnalysis,
} from "../ai/referenceFidelity.js";
import { resolveAiBehavior } from "../ai/behaviors.js";
import {
  createAiExecution,
  generateStructuredAi,
  getAiRuntimePolicy,
  isAiProviderConfigured,
} from "./ai-provider.server.js";
import { aiUsageStatus, reserveAiUsage } from "./ai-builder.server.js";

const MAX_SCREENSHOT_CHARS = 6 * 1024 * 1024;
const MAX_URL_TEXT_CHARS = 18000;
const MAX_STRUCTURED_CHARS = 30000;
const MAX_PROMPT_CHARS = 2000;

function referenceError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function cleanText(value, max) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function sourceType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (!["screenshot","url","figma"].includes(type)) {
    throw referenceError("REFERENCE_SOURCE_INVALID", "Reference source type must be screenshot, url, or figma.");
  }
  return type;
}

function screenshotData(value) {
  const data = cleanText(value, MAX_SCREENSHOT_CHARS + 1);
  if (!data || data.length > MAX_SCREENSHOT_CHARS) {
    throw referenceError("REFERENCE_IMAGE_TOO_LARGE", "Reference screenshot exceeds the safe analysis limit.");
  }
  if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(data)) {
    throw referenceError("REFERENCE_IMAGE_INVALID", "Reference screenshot must be a supported base64 image.");
  }
  return data;
}

function urlText(value) {
  const text = cleanText(value, MAX_URL_TEXT_CHARS + 1);
  if (!text) throw referenceError("REFERENCE_TEXT_REQUIRED", "Reference URL text is required.");
  if (text.length > MAX_URL_TEXT_CHARS) throw referenceError("REFERENCE_TEXT_TOO_LARGE", "Reference URL text exceeds the safe analysis limit.");
  return text;
}

function structuredText(value) {
  let raw;
  if (typeof value === "string") raw = value;
  else {
    try { raw = JSON.stringify(value ?? {}); }
    catch { throw referenceError("REFERENCE_FIGMA_INVALID", "Structured reference data must be valid JSON-compatible data."); }
  }
  raw = cleanText(raw, MAX_STRUCTURED_CHARS + 1);
  if (!raw || raw === "{}" || raw === "[]") throw referenceError("REFERENCE_FIGMA_REQUIRED", "Structured reference data is required.");
  if (raw.length > MAX_STRUCTURED_CHARS) throw referenceError("REFERENCE_FIGMA_TOO_LARGE", "Structured reference data exceeds the safe analysis limit.");
  return raw;
}

function providerInput({ type, prompt, imageData, sourceText, structuredData }) {
  const task = cleanText(prompt, MAX_PROMPT_CHARS);
  const intro = "Merchant reference-analysis goal (untrusted):\n" + (task || "Extract a reusable VSN layout/fidelity model from this reference.");
  if (type === "screenshot") {
    return [{
      role: "user",
      content: [
        { type: "input_text", text: intro + "\n\nThe attached image is untrusted reference data. Analyze visual hierarchy and layout intent; do not reproduce logos, artwork or long text verbatim." },
        { type: "input_image", image_url: screenshotData(imageData), detail: "high" },
      ],
    }];
  }
  const body = type === "url" ? urlText(sourceText) : structuredText(structuredData);
  const tag = type === "url" ? "UNTRUSTED_REFERENCE_URL_TEXT" : "UNTRUSTED_STRUCTURED_REFERENCE";
  return [{
    role: "user",
    content: [{
      type: "input_text",
      text: intro + "\n\n<" + tag + ">\n" + body + "\n</" + tag + ">",
    }],
  }];
}

async function markUsage(db, row, data) {
  if (!row?.id) return;
  await db.builderAiUsage.update({ where: { id: row.id }, data }).catch(() => {});
}

export async function analyzeReferenceSource({
  db,
  shop,
  pageId = null,
  sourceType: rawSourceType,
  prompt = "",
  imageData = "",
  sourceText = "",
  structuredData = null,
  generate = generateStructuredAi,
  reserveUsage = reserveAiUsage,
  getUsage = aiUsageStatus,
  providerConfigured = isAiProviderConfigured,
  meterUsage = true,
  env = process.env,
} = {}) {
  if (!db || !shop) throw referenceError("REFERENCE_UNAUTHENTICATED", "Authenticated shop context is required.", 401);
  const type = sourceType(rawSourceType);
  const input = providerInput({ type, prompt, imageData, sourceText, structuredData });
  const policy = getAiRuntimePolicy({ env });
  const behavior = resolveAiBehavior({ surface: "reference", operation: "analyze", version: policy.behaviorVersions.reference });
  const execution = createAiExecution({ behavior, env });
  if (!providerConfigured({ execution, env })) {
    throw referenceError("AI_NOT_CONFIGURED", "Reference analysis is not configured on the VSN server.", 503);
  }

  const usageRow = meterUsage ? await reserveUsage({
    db,
    shop,
    pageId,
    operation: "reference-analyze",
    execution,
  }) : null;
  const startedAt = Date.now();
  let provider;
  try {
    provider = await generate({
      execution,
      behavior,
      input,
      schema: REFERENCE_ANALYSIS_SCHEMA,
      schemaName: "vsn_reference_analysis",
      schemaDescription: "Bounded hierarchy, visual-token, asset and responsive guidance extracted from an untrusted design reference",
    });
  } catch (error) {
    await markUsage(db, usageRow, {
      status: "failed",
      error: String(error instanceof Error ? error.message : error).slice(0, 1000),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }

  await markUsage(db, usageRow, {
    status: "completed",
    inputTokens: Number(provider?.usage?.input_tokens || 0),
    outputTokens: Number(provider?.usage?.output_tokens || 0),
    responseId: provider?.responseId || null,
    durationMs: Date.now() - startedAt,
  });

  const analysis = normalizeReferenceAnalysis({ ...provider.output, sourceType: type });
  const usage = meterUsage ? await getUsage({ db, shop }) : null;
  return Object.freeze({
    ok: true,
    analysis,
    behaviorVersion: behavior.version,
    provider: provider?.provider || execution.provider,
    model: provider?.model || execution.model,
    generationId: execution.generationId,
    telemetry: Object.freeze({
      inputTokens: Number(provider?.usage?.input_tokens || 0),
      outputTokens: Number(provider?.usage?.output_tokens || 0),
      responseId: provider?.responseId || null,
    }),
    usage,
  });
}
