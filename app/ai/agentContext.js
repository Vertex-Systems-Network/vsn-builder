import {
  AI_CONTEXT_MAX_REQUESTS,
  AI_CONTEXT_TOOL_NAMES,
  normalizeAiContextRequests,
} from "./contextTools.js";

export const AI_AGENT_CONTEXT_REQUEST_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["requests"],
  properties: {
    requests: {
      type: "array",
      maxItems: AI_CONTEXT_MAX_REQUESTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tool", "query", "id", "resourceIdsJson", "first", "hours"],
        properties: {
          tool: { type: "string", enum: AI_CONTEXT_TOOL_NAMES },
          query: { type: "string" },
          id: { type: "string" },
          resourceIdsJson: { type: "string", description: "JSON array string of Shopify GraphQL GIDs; use [] when unused." },
          first: { type: "number" },
          hours: { type: "number" },
        },
      },
    },
  },
});

function parseResourceIds(value) {
  const raw = String(value || "[]").trim() || "[]";
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Agent context resourceIdsJson must be valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("Agent context resourceIdsJson must be a JSON array.");
  return parsed;
}

function requestInput(row = {}) {
  switch (String(row.tool || "")) {
    case "shopify.products.search":
    case "shopify.collections.search":
    case "shopify.files.search":
      return { query: row.query, first: row.first };
    case "shopify.product.get":
      return { id: row.id };
    case "shopify.collection.get":
      return { id: row.id, first: row.first };
    case "shopify.markets.list":
      return { first: row.first };
    case "shopify.translations.get":
      return { resourceIds: parseResourceIds(row.resourceIdsJson) };
    case "vsn.analytics.summary":
      return { hours: row.hours };
    default:
      return {};
  }
}

export function normalizeAgentContextRequests(plan = {}) {
  const rows = Array.isArray(plan?.requests) ? plan.requests : [];
  return normalizeAiContextRequests(rows.map((row) => ({
    tool: String(row?.tool || ""),
    input: requestInput(row),
  })));
}
