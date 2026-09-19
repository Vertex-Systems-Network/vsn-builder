export const AI_CONTEXT_TOOLS_VERSION = 1;
export const AI_CONTEXT_MAX_REQUESTS = 4;
export const AI_CONTEXT_MAX_ITEMS = 10;
export const AI_CONTEXT_MAX_MARKETS = 20;
export const AI_CONTEXT_MAX_RESOURCE_IDS = 5;
export const AI_CONTEXT_MAX_QUERY_CHARS = 160;

export const AI_CONTEXT_TOOL_NAMES = Object.freeze([
  "vsn.page.current",
  "shopify.products.search",
  "shopify.product.get",
  "shopify.collections.search",
  "shopify.collection.get",
  "shopify.files.search",
  "shopify.markets.list",
  "shopify.locales.list",
  "shopify.translations.get",
  "vsn.analytics.summary",
  "vsn.experiments.page",
]);

const TOOL_SET = new Set(AI_CONTEXT_TOOL_NAMES);

function text(value, max = AI_CONTEXT_MAX_QUERY_CHARS) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function boundedInt(value, fallback, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(max, n)) : fallback;
}

function gid(value, type = "") {
  const id = text(value, 220);
  if (!id || !/^gid:\/\/shopify\/[A-Za-z][A-Za-z0-9_]*\/[^\s/]+$/.test(id)) {
    throw new Error("Context resource ID must be a Shopify GraphQL GID.");
  }
  if (type && !id.startsWith(`gid://shopify/${type}/`)) {
    throw new Error(`Context resource ID must reference a Shopify ${type}.`);
  }
  return id;
}

function normalizeInput(tool, input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  switch (tool) {
    case "vsn.page.current":
    case "shopify.locales.list":
    case "vsn.experiments.page":
      return Object.freeze({});
    case "shopify.products.search":
    case "shopify.collections.search":
    case "shopify.files.search":
      return Object.freeze({
        query: text(source.query),
        first: boundedInt(source.first, 6, AI_CONTEXT_MAX_ITEMS),
      });
    case "shopify.product.get":
      return Object.freeze({ id: gid(source.id, "Product") });
    case "shopify.collection.get":
      return Object.freeze({
        id: gid(source.id, "Collection"),
        first: boundedInt(source.first, 6, 8),
      });
    case "shopify.markets.list":
      return Object.freeze({ first: boundedInt(source.first, 10, AI_CONTEXT_MAX_MARKETS) });
    case "shopify.translations.get": {
      const ids = Array.isArray(source.resourceIds) ? source.resourceIds : [];
      if (!ids.length) throw new Error("Translation context requires at least one resource ID.");
      if (ids.length > AI_CONTEXT_MAX_RESOURCE_IDS) {
        throw new Error(`Translation context accepts at most ${AI_CONTEXT_MAX_RESOURCE_IDS} resource IDs.`);
      }
      return Object.freeze({ resourceIds: Object.freeze([...new Set(ids.map((id) => gid(id)))].slice(0, AI_CONTEXT_MAX_RESOURCE_IDS)) });
    }
    case "vsn.analytics.summary": {
      const hours = Number(source.hours) === 168 ? 168 : 24;
      return Object.freeze({ hours });
    }
    default:
      throw new Error(`Unsupported AI context tool: ${tool || "missing"}.`);
  }
}

export function normalizeAiContextRequests(value = []) {
  if (!Array.isArray(value)) throw new Error("AI context requests must be an array.");
  if (value.length > AI_CONTEXT_MAX_REQUESTS) {
    throw new Error(`AI context requests exceed the ${AI_CONTEXT_MAX_REQUESTS}-request limit.`);
  }
  return Object.freeze(value.map((request, index) => {
    const tool = text(request?.tool, 80);
    if (!TOOL_SET.has(tool)) throw new Error(`Unsupported AI context tool at request ${index + 1}: ${tool || "missing"}.`);
    return Object.freeze({
      tool,
      input: normalizeInput(tool, request?.input),
    });
  }));
}
