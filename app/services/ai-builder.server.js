import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import dbDefault from "../db.server.js";
import { AI_ALLOWED_TYPES, normalizeAiPlan, aiPlanToVsnNodes, validateAiVsnOutput, scanAiAccessibility, scanAiResponsive, serializePageForAi, sanitizeAiContext } from "../builder/aiBuilder.js";
import { getQuotaDecision } from "./entitlements.server.js";
import { COMMERCIAL_PLANS } from "../config/commercialPlans.js";
import { resolveAiBehavior } from "../ai/behaviors.js";
import { scoreReferencePlanFidelity } from "../ai/referenceFidelity.js";
import { createAiExecution, generateStructuredAi, getAiRuntimePolicy, isAiProviderConfigured } from "./ai-provider.server.js";
const URL_FETCH_TIMEOUT_MS = 8000;
const URL_FETCH_MAX_BYTES = 512000;
const URL_FETCH_MAX_REDIRECTS = 4;
const AI_RESERVATION_TTL_MS = 10 * 60 * 1000;

export const AI_PLAN_QUOTAS = Object.freeze(Object.fromEntries(Object.entries(COMMERCIAL_PLANS).map(([key, plan]) => [key, plan.aiMonthly])));

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function publicIpv4(address) {
  const parts = String(address || "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2) || (b === 88 && c === 99))) return false;
  if (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6BigInt(address) {
  let input = String(address || "").toLowerCase().split("%")[0];
  if (input.startsWith("[") && input.endsWith("]")) input = input.slice(1, -1);
  if (input.includes(".")) {
    const lastColon = input.lastIndexOf(":");
    const dotted = input.slice(lastColon + 1);
    const parts = dotted.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    input = `${input.slice(0, lastColon)}:${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group}`), 0n);
}

function publicIpv6(address) {
  const value = ipv6BigInt(address);
  if (value === null || value === 0n || value === 1n) return false;
  if ((value >> 121n) === 0x7en) return false;
  if ((value >> 118n) === 0x3fan || (value >> 118n) === 0x3fbn) return false;
  if ((value >> 120n) === 0xffn) return false;
  if ((value >> 96n) === 0x20010db8n || (value >> 96n) === 0x20010000n) return false;
  if ((value >> 32n) === 0xffffn || (value >> 32n) === 0n) {
    const low = Number(value & 0xffffffffn);
    return publicIpv4(`${(low >>> 24) & 255}.${(low >>> 16) & 255}.${(low >>> 8) & 255}.${low & 255}`);
  }
  if ((value >> 32n) === 0x64ff9b0000000000000000n || (value >> 80n) === 0x64ff9b0001n) return false;
  if ((value >> 112n) === 0x2002n) return false;
  return true;
}

function publicIp(address) {
  const family = isIP(String(address || "").replace(/^\[|\]$/g, ""));
  return family === 4 ? publicIpv4(address) : family === 6 ? publicIpv6(address) : false;
}
function blockedHostname(host) {
  const value = String(host || "").replace(/^\[|\]$/g, "").toLowerCase();
  return value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal");
}

async function resolvePublicTarget(url) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || blockedHostname(url.hostname)) throw new Error("Only public http(s) URLs can be used for inspiration.");
  const host = String(url.hostname || "").replace(/^\[|\]$/g, "");
  let rows;
  if (isIP(host)) rows = [{ address: host, family: isIP(host) }];
  else {
    try { rows = await lookup(host, { all: true, verbatim: true }); }
    catch { throw new Error("Could not resolve the inspiration URL safely."); }
  }
  if (!rows.length || rows.some((row) => !publicIp(row.address))) throw new Error("Private or non-public network URLs are not allowed.");
  return rows.find((row) => row.family === 4) || rows[0];
}

function pinnedRequest(url, target) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method: "GET",
      headers: { "User-Agent": "VSN-Page-Builder-AI/1.0", Accept: "text/html,text/plain,application/xhtml+xml", "Accept-Encoding": "identity" },
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [{ address: target.address, family: target.family }]);
        else callback(null, target.address, target.family);
      },
    }, (response) => {
      const status = Number(response.statusCode || 0);
      const headers = response.headers || {};
      if ([301, 302, 303, 307, 308].includes(status)) { response.resume(); resolve({ status, headers, body: "" }); return; }
      const contentLength = Number(headers["content-length"] || 0);
      if (Number.isFinite(contentLength) && contentLength > URL_FETCH_MAX_BYTES) { response.resume(); reject(new Error("Inspiration URL response is too large.")); return; }
      const chunks = []; let total = 0; let settled = false;
      response.on("data", (chunk) => {
        if (settled) return;
        total += chunk.length;
        if (total > URL_FETCH_MAX_BYTES) { settled = true; request.destroy(); response.destroy(); reject(new Error("Inspiration URL response is too large.")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => { if (!settled) { settled = true; resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8") }); } });
      response.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    });
    request.setTimeout(URL_FETCH_TIMEOUT_MS, () => request.destroy(new Error("Inspiration URL request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchUrlInspiration(rawUrl) {
  if (!rawUrl) return "";
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("Enter a valid public URL."); }
  for (let redirects = 0; redirects < URL_FETCH_MAX_REDIRECTS; redirects++) {
    const target = await resolvePublicTarget(url);
    const res = await pinnedRequest(url, target);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
      if (!location) throw new Error("Inspiration URL redirect was invalid.");
      try { url = new URL(location, url); } catch { throw new Error("Inspiration URL redirect was invalid."); }
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`Source URL returned ${res.status}.`);
    const type = String(res.headers["content-type"] || "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("text/plain") && !type.includes("application/xhtml+xml")) throw new Error("URL inspiration currently supports HTML/text pages only.");
    return res.body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 18000);
  }
  throw new Error("Too many redirects while reading the inspiration URL.");
}

const ELEMENT_SCHEMA = { type: "object", additionalProperties: false, required: ["ref", "parentRef", "type", "label", "text", "url", "imageUrl", "alt", "tag", "columns", "gap", "backgroundColor", "textColor", "fontSize", "fontWeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "width", "maxWidth", "height", "borderRadius", "direction", "align", "justify", "objectFit"], properties: {
  ref: { type: "string" }, parentRef: { type: "string" }, type: { type: "string", enum: AI_ALLOWED_TYPES }, label: { type: "string" }, text: { type: "string" },
  url: { type: "string", description: "Use only http(s), safe relative/anchor links, or mailto/tel for buttons. Never use javascript:, data:, file:, or blob: URLs." },
  imageUrl: { type: "string", description: "Use only http(s) or safe relative image URLs. Never use javascript:, data:, file:, or blob: URLs." },
  alt: { type: "string" }, tag: { type: "string" }, columns: { type: "number" }, gap: { type: "number" }, backgroundColor: { type: "string" }, textColor: { type: "string" }, fontSize: { type: "number" }, fontWeight: { type: "number" }, paddingTop: { type: "number" }, paddingRight: { type: "number" }, paddingBottom: { type: "number" }, paddingLeft: { type: "number" }, marginTop: { type: "number" }, marginRight: { type: "number" }, marginBottom: { type: "number" }, marginLeft: { type: "number" }, width: { type: "string" }, maxWidth: { type: "string" }, height: { type: "string" }, borderRadius: { type: "number" }, direction: { type: "string" }, align: { type: "string" }, justify: { type: "string" }, objectFit: { type: "string" },
} };
const OUTPUT_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "summary", "replacementText", "elements", "suggestions"], properties: { title: { type: "string" }, summary: { type: "string" }, replacementText: { type: "string" }, elements: { type: "array", items: ELEMENT_SCHEMA }, suggestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "message", "elementRef"], properties: { kind: { type: "string" }, message: { type: "string" }, elementRef: { type: "string" } } } } } };

async function callAiProvider({ execution, behavior, prompt, imageData, currentPage, globalStyles, pageTemplate, urlText, selectedElementId, commerceContext, referenceAnalysis = null }) {
  const currentSummary = serializePageForAi(currentPage || [], { maxNodes: 100 });
  const selectedElement = currentSummary.find((item) => item.id === selectedElementId) || null;
  const context = {
    pageTemplate,
    brandKit: sanitizeAiContext(globalStyles || {}),
    commerceContext: sanitizeAiContext(commerceContext || {}),
    selectedElement,
    currentPage: currentSummary,
    responsiveScannerFindings: scanAiResponsive(currentPage || []).slice(0, 20),
    accessibilityScannerFindings: scanAiAccessibility(currentPage || []).slice(0, 20),
    allowedWidgets: AI_ALLOWED_TYPES,
  };
  if (referenceAnalysis) context.referenceAnalysis = sanitizeAiContext(referenceAnalysis);
  const sourceBlock = urlText && !referenceAnalysis ? `\n\n<UNTRUSTED_PUBLIC_SOURCE_TEXT>\n${urlText}\n</UNTRUSTED_PUBLIC_SOURCE_TEXT>` : "";
  const userText = `JSON task request (untrusted user data):\n${String(prompt || "").slice(0, 8000)}\n\nVSN context (untrusted application data):\n${JSON.stringify(context).slice(0, 60000)}${sourceBlock}`;
  const content = [{ type: "input_text", text: userText }];
  if (imageData && !referenceAnalysis) content.push({ type: "input_image", image_url: imageData, detail: "high" });

  const provider = await generateStructuredAi({
    execution,
    behavior,
    input: [{ role: "user", content }],
    schema: OUTPUT_SCHEMA,
    schemaName: "vsn_ai_builder",
    schemaDescription: "A safe editable VSN layout plan",
  });
  return { plan: normalizeAiPlan(provider.output), ...provider };
}

export async function reserveAiUsage({ db, shop, pageId, operation, execution }) {
  let usageRow;
  try {
    usageRow = await db.builderAiUsage.create({ data: {
      shop,
      pageId: pageId || null,
      operation: String(operation || "section"),
      provider: execution?.provider || null,
      model: execution?.model || null,
      behaviorVersion: execution?.behaviorVersion || null,
      generationId: execution?.generationId || null,
      status: "started",
    } });
  } catch {
    throw new Error("AI usage metering is unavailable; the request was not sent to the provider.");
  }
  try {
    const now = new Date();
    const recentReservation = new Date(now.getTime() - AI_RESERVATION_TTL_MS);
    const used = await db.builderAiUsage.count({
      where: {
        shop,
        createdAt: { gte: monthStart(now) },
        OR: [
          { status: "completed" },
          { status: "started", createdAt: { gte: recentReservation } },
        ],
      },
    });
    const decision = await getQuotaDecision(db, shop, "aiGenerations", { used, extra: 0, now });
    if (!decision.allowed) {
      await db.builderAiUsage.update({ where: { id: usageRow.id }, data: { status: "failed", error: String(decision.message || decision.code || "AI quota exceeded").slice(0, 1000), durationMs: 0 } }).catch(() => {});
      const error = new Error(decision.message || "AI generation quota exceeded.");
      error.code = decision.code;
      throw error;
    }
    return usageRow;
  } catch (error) {
    if (error?.code?.startsWith?.("VSN_")) throw error;
    await db.builderAiUsage.update({ where: { id: usageRow.id }, data: { status: "failed", error: String(error?.message || error).slice(0, 1000), durationMs: 0 } }).catch(() => {});
    throw error;
  }
}

export async function aiUsageStatus({ db = dbDefault, shop }) {
  const decision = await getQuotaDecision(db, shop, "aiGenerations", { extra: 0 });
  const policy = getAiRuntimePolicy();
  return {
    plan: decision.planKey,
    used: decision.used,
    quota: decision.limit,
    remaining: decision.unlimited ? Number.MAX_SAFE_INTEGER : decision.remaining,
    resetAt: decision.resetAt,
    configured: isAiProviderConfigured({ execution: { provider: policy.provider } }),
    provider: policy.provider,
    model: policy.model,
    behaviorVersions: policy.behaviorVersions,
    entitlement: { allowed: decision.allowed, code: decision.code, source: decision.source, verified: decision.verified },
  };
}

export async function runAiBuilder({ db = dbDefault, shop, pageId, operation, prompt, imageData, currentPage, globalStyles, pageTemplate, sourceUrl, selectedElementId, commerceContext, referenceAnalysisEnabled = false, referenceAnalyzer = null }) {
  const started = Date.now();
  const policy = getAiRuntimePolicy();
  const behavior = resolveAiBehavior({ surface: "page", operation, version: policy.behaviorVersions.page });
  const execution = createAiExecution({ behavior });
  const usageRow = await reserveAiUsage({ db, shop, pageId, operation, execution });
  const status = await aiUsageStatus({ db, shop });
  let providerResult = null;
  let referenceResult = null;
  try {
    const shouldAnalyzeReference = referenceAnalysisEnabled === true && ["screenshot", "url"].includes(operation) && typeof referenceAnalyzer === "function";
    if (shouldAnalyzeReference) {
      const sourceText = operation === "url" ? await fetchUrlInspiration(sourceUrl) : "";
      referenceResult = await referenceAnalyzer({
        db,
        shop,
        pageId,
        sourceType: operation,
        prompt,
        imageData,
        sourceText,
        meterUsage: false,
      });
    }
    const referenceAnalysis = referenceResult?.analysis || null;
    const urlText = operation === "url" && !referenceAnalysis ? await fetchUrlInspiration(sourceUrl) : "";
    const result = await callAiProvider({ execution, behavior, prompt, imageData, currentPage, globalStyles, pageTemplate, urlText, selectedElementId, commerceContext, referenceAnalysis });
    providerResult = result;
    const referenceInputTokens = Number(referenceResult?.telemetry?.inputTokens || 0);
    const referenceOutputTokens = Number(referenceResult?.telemetry?.outputTokens || 0);
    await db.builderAiUsage.update({
      where: { id: usageRow.id },
      data: {
        status: "completed",
        inputTokens: referenceInputTokens + Number(result.usage?.input_tokens || 0),
        outputTokens: referenceOutputTokens + Number(result.usage?.output_tokens || 0),
        responseId: result.responseId || null,
        durationMs: Date.now() - started,
      },
    }).catch(() => {});

    const nodes = aiPlanToVsnNodes(result.plan);
    const validation = validateAiVsnOutput(nodes);
    if (!validation.valid) throw new Error(`AI output failed VSN validation: ${validation.errors.join("; ")}`);
    const accessibility = scanAiAccessibility(nodes);
    const responsive = scanAiResponsive(nodes);
    const referenceFidelity = referenceResult?.analysis ? scoreReferencePlanFidelity(referenceResult.analysis, result.plan) : null;
    return {
      ok: true,
      plan: result.plan,
      nodes,
      validation,
      accessibility,
      responsive,
      ...(referenceResult?.analysis ? {
        reference: {
          analysis: referenceResult.analysis,
          fidelity: referenceFidelity,
          behaviorVersion: referenceResult.behaviorVersion,
          provider: referenceResult.provider,
          model: referenceResult.model,
          generationId: referenceResult.generationId,
        },
      } : {}),
      usage: {
        ...status,
        used: status.used + 1,
        remaining: Math.max(0, status.remaining - 1),
        provider: result.provider,
        model: result.model,
        behaviorVersion: result.behaviorVersion,
        generationId: result.generationId,
      },
    };
  } catch (error) {
    const referenceInputTokens = Number(referenceResult?.telemetry?.inputTokens || 0);
    const referenceOutputTokens = Number(referenceResult?.telemetry?.outputTokens || 0);
    if (providerResult) {
      await db.builderAiUsage.update({ where: { id: usageRow.id }, data: { error: String(error?.message || error).slice(0, 1000), durationMs: Date.now() - started } }).catch(() => {});
    } else {
      await db.builderAiUsage.update({
        where: { id: usageRow.id },
        data: {
          status: "failed",
          inputTokens: referenceInputTokens,
          outputTokens: referenceOutputTokens,
          error: String(error?.message || error).slice(0, 1000),
          durationMs: Date.now() - started,
        },
      }).catch(() => {});
    }
    throw error;
  }
}
