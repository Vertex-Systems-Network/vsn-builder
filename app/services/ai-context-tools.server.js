import { normalizeAiContextRequests } from "../ai/contextTools.js";
import { getVisitorSummary } from "./visitor-analytics.server.js";

export const AI_CONTEXT_SHOPIFY_QUERIES = Object.freeze({
  products: `#graphql
    query VsnAiContextProducts($first: Int!, $query: String) {
      products(first: $first, query: $query) {
        nodes { id title handle status vendor productType tags totalInventory }
      }
    }
  `,
  product: `#graphql
    query VsnAiContextProduct($id: ID!) {
      product(id: $id) {
        id title handle status vendor productType tags totalInventory
        variants(first: 8) { nodes { id title sku price inventoryQuantity } }
      }
    }
  `,
  collections: `#graphql
    query VsnAiContextCollections($first: Int!, $query: String) {
      collections(first: $first, query: $query) {
        nodes { id title handle updatedAt }
      }
    }
  `,
  collection: `#graphql
    query VsnAiContextCollection($id: ID!, $first: Int!) {
      collection(id: $id) {
        id title handle updatedAt
        products(first: $first) { nodes { id title handle status } }
      }
    }
  `,
  files: `#graphql
    query VsnAiContextFiles($first: Int!, $query: String) {
      files(first: $first, query: $query) {
        nodes {
          __typename
          ... on MediaImage { id alt image { url width height } }
          ... on Video { id alt duration preview { image { url width height } } }
          ... on GenericFile { id alt url }
        }
      }
    }
  `,
  markets: `#graphql
    query VsnAiContextMarkets($first: Int!) {
      markets(first: $first) { nodes { id handle name status type } }
    }
  `,
  locales: `#graphql
    query VsnAiContextLocales {
      shopLocales { locale name primary published }
    }
  `,
  translations: `#graphql
    query VsnAiContextTranslations($first: Int!, $resourceIds: [ID!]!) {
      translatableResourcesByIds(first: $first, resourceIds: $resourceIds) {
        nodes {
          resourceId
          translatableContent { key value locale }
        }
      }
    }
  `,
});

function text(value, max = 400) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function rows(value, max = 10) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}
function safeUrl(value) {
  const raw = text(value, 1200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

function productSummary(node) {
  if (!node?.id) return null;
  return {
    id: text(node.id, 220),
    title: text(node.title, 240),
    handle: text(node.handle, 220),
    status: text(node.status, 40),
    vendor: text(node.vendor, 160),
    productType: text(node.productType, 160),
    tags: rows(node.tags, 20).map((item) => text(item, 100)).filter(Boolean),
    totalInventory: number(node.totalInventory),
  };
}
function productDetail(node) {
  const base = productSummary(node);
  if (!base) return null;
  return {
    ...base,
    variants: rows(node.variants?.nodes, 8).map((variant) => ({
      id: text(variant?.id, 220),
      title: text(variant?.title, 220),
      sku: text(variant?.sku, 120),
      price: text(variant?.price, 80),
      inventoryQuantity: number(variant?.inventoryQuantity),
    })).filter((variant) => variant.id),
  };
}
function collectionSummary(node) {
  if (!node?.id) return null;
  return {
    id: text(node.id, 220),
    title: text(node.title, 240),
    handle: text(node.handle, 220),
    updatedAt: iso(node.updatedAt),
  };
}
function collectionDetail(node) {
  const base = collectionSummary(node);
  if (!base) return null;
  return {
    ...base,
    products: rows(node.products?.nodes, 8).map((item) => productSummary(item)).filter(Boolean),
  };
}
function fileSummary(node) {
  if (!node?.id) return null;
  const type = text(node.__typename, 40);
  if (type === "MediaImage") {
    return {
      id: text(node.id, 220), type: "image", alt: text(node.alt, 500),
      url: safeUrl(node.image?.url), width: number(node.image?.width), height: number(node.image?.height),
    };
  }
  if (type === "Video") {
    return {
      id: text(node.id, 220), type: "video", alt: text(node.alt, 500), duration: number(node.duration),
      previewUrl: safeUrl(node.preview?.image?.url),
      width: number(node.preview?.image?.width), height: number(node.preview?.image?.height),
    };
  }
  if (type === "GenericFile") {
    return { id: text(node.id, 220), type: "file", alt: text(node.alt, 500), url: safeUrl(node.url) };
  }
  return { id: text(node.id, 220), type: type || "file" };
}
function marketSummary(node) {
  if (!node?.id) return null;
  return {
    id: text(node.id, 220),
    handle: text(node.handle, 160),
    name: text(node.name, 220),
    status: text(node.status, 40),
    type: text(node.type, 40),
  };
}
function localeSummary(node) {
  const locale = text(node?.locale, 32);
  if (!locale) return null;
  return {
    locale,
    name: text(node?.name, 120),
    primary: node?.primary === true,
    published: node?.published === true,
  };
}
function translationSummary(node) {
  const resourceId = text(node?.resourceId, 220);
  if (!resourceId) return null;
  return {
    resourceId,
    content: rows(node?.translatableContent, 30).map((item) => ({
      key: text(item?.key, 160),
      value: text(item?.value, 1500),
      locale: text(item?.locale, 32),
    })).filter((item) => item.key),
  };
}

async function adminData(admin, query, variables = {}) {
  if (!admin?.graphql) throw new Error("Shopify Admin GraphQL is unavailable for context lookup.");
  if (!/^\s*#graphql\s*\n?\s*query\b/i.test(query) || /\bmutation\b/i.test(query)) {
    throw new Error("AI context Shopify operations must use fixed read-only queries.");
  }
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();
  if (payload?.errors?.length) throw new Error("Shopify context query failed.");
  return payload?.data || {};
}

async function loadCurrentPage(db, shop, pageId) {
  if (!db || !shop || !pageId) throw new Error("AI context requires db, shop and pageId.");
  const page = await db.builderPage.findFirst({
    where: { id: String(pageId), shop, deletedAt: null },
    select: {
      id: true, title: true, handle: true, template: true, resourceId: true, resourceHandle: true,
      isDefault: true, status: true, workflowStatus: true, shopifyPageId: true, shopifyPageUrl: true,
      version: true, publishedVersion: true, updatedAt: true,
    },
  });
  if (!page) throw new Error("Builder page not found for AI context.");
  return {
    id: text(page.id, 220),
    title: text(page.title, 240),
    handle: text(page.handle, 220),
    template: text(page.template, 120),
    resourceId: text(page.resourceId, 220) || null,
    resourceHandle: text(page.resourceHandle, 220) || null,
    isDefault: page.isDefault === true,
    status: text(page.status, 40),
    workflowStatus: text(page.workflowStatus, 40),
    shopifyPageId: text(page.shopifyPageId, 220) || null,
    shopifyPageUrl: safeUrl(page.shopifyPageUrl) || text(page.shopifyPageUrl, 1000) || null,
    version: Number(page.version || 1),
    publishedVersion: Number(page.publishedVersion || 0),
    updatedAt: iso(page.updatedAt),
  };
}

async function loadPageExperiments(db, shop, pageId) {
  const experiments = await db.builderExperiment.findMany({
    where: { shop, pageId },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true, name: true, status: true, targetType: true, targetNodeId: true,
      goalType: true, goalValue: true, trafficPercent: true, minimumSessions: true,
      confidenceThreshold: true, winnerVariantId: true, startedAt: true, endedAt: true, updatedAt: true,
      variants: {
        orderBy: [{ isControl: "desc" }, { createdAt: "asc" }],
        take: 8,
        select: { id: true, key: true, name: true, weight: true, isControl: true },
      },
    },
  }).catch(() => []);
  return experiments.map((item) => ({
    id: text(item.id, 220),
    name: text(item.name, 220),
    status: text(item.status, 40),
    targetType: text(item.targetType, 60),
    targetNodeId: text(item.targetNodeId, 220) || null,
    goalType: text(item.goalType, 80),
    goalValue: text(item.goalValue, 240) || null,
    trafficPercent: Number(item.trafficPercent || 0),
    minimumSessions: Number(item.minimumSessions || 0),
    confidenceThreshold: number(item.confidenceThreshold),
    winnerVariantId: text(item.winnerVariantId, 220) || null,
    startedAt: iso(item.startedAt),
    endedAt: iso(item.endedAt),
    updatedAt: iso(item.updatedAt),
    variants: rows(item.variants, 8).map((variant) => ({
      id: text(variant.id, 220), key: text(variant.key, 80), name: text(variant.name, 180),
      weight: Number(variant.weight || 0), isControl: variant.isControl === true,
    })),
  }));
}

async function executeOne({ db, admin, shop, page, request }) {
  const { tool, input } = request;
  switch (tool) {
    case "vsn.page.current":
      return page;
    case "shopify.products.search": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.products, { first: input.first, query: input.query || null });
      return rows(data.products?.nodes, input.first).map(productSummary).filter(Boolean);
    }
    case "shopify.product.get": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.product, { id: input.id });
      return productDetail(data.product);
    }
    case "shopify.collections.search": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.collections, { first: input.first, query: input.query || null });
      return rows(data.collections?.nodes, input.first).map(collectionSummary).filter(Boolean);
    }
    case "shopify.collection.get": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.collection, { id: input.id, first: input.first });
      return collectionDetail(data.collection);
    }
    case "shopify.files.search": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.files, { first: input.first, query: input.query || null });
      return rows(data.files?.nodes, input.first).map(fileSummary).filter(Boolean);
    }
    case "shopify.markets.list": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.markets, { first: input.first });
      return rows(data.markets?.nodes, input.first).map(marketSummary).filter(Boolean);
    }
    case "shopify.locales.list": {
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.locales);
      return rows(data.shopLocales, 30).map(localeSummary).filter(Boolean);
    }
    case "shopify.translations.get": {
      const first = Math.min(input.resourceIds.length, 5);
      const data = await adminData(admin, AI_CONTEXT_SHOPIFY_QUERIES.translations, { first, resourceIds: input.resourceIds });
      return rows(data.translatableResourcesByIds?.nodes, first).map(translationSummary).filter(Boolean);
    }
    case "vsn.analytics.summary":
      return getVisitorSummary(db, shop, { hours: input.hours });
    case "vsn.experiments.page":
      return loadPageExperiments(db, shop, page.id);
    default:
      throw new Error(`Unsupported AI context tool: ${tool}.`);
  }
}

export async function runAiContextTools({ db, admin, shop, pageId, requests = [] } = {}) {
  const normalized = normalizeAiContextRequests(requests);
  const page = await loadCurrentPage(db, shop, pageId);
  const results = [];
  for (const request of normalized) {
    try {
      const data = await executeOne({ db, admin, shop, page, request });
      results.push(Object.freeze({ tool: request.tool, ok: true, data }));
    } catch (error) {
      results.push(Object.freeze({
        tool: request.tool,
        ok: false,
        error: text(error instanceof Error ? error.message : error, 500) || "Context lookup failed.",
      }));
    }
  }
  return Object.freeze({
    version: 1,
    page: Object.freeze({ id: page.id, template: page.template, resourceId: page.resourceId, resourceHandle: page.resourceHandle }),
    results: Object.freeze(results),
  });
}
