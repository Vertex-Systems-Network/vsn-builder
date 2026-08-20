export const QUERY_AST_VERSION = 2;

export const QUERY_SOURCE_OPTIONS = Object.freeze([
  { value: "products", label: "Products" },
  { value: "collections", label: "Collections" },
  { value: "blogs", label: "Blogs" },
  { value: "articles", label: "Articles" },
  { value: "search", label: "Search Results" },
  { value: "metaobjects", label: "Metaobjects" },
  { value: "metafield-references", label: "Metafield Reference List" },
  { value: "sdk-provider", label: "SDK Data Provider" },
]);

export const QUERY_SORT_OPTIONS = Object.freeze({
  products: [
    { value: "featured", label: "Featured / Shopify default" },
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
    { value: "price-asc", label: "Price Low → High" },
    { value: "price-desc", label: "Price High → Low" },
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
  ],
  collections: [
    { value: "featured", label: "Shopify default" },
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
    { value: "newest", label: "Newest First" },
  ],
  blogs: [
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
  ],
  articles: [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
  ],
  search: [
    { value: "relevance", label: "Relevance" },
    { value: "title-asc", label: "Title A → Z" },
    { value: "title-desc", label: "Title Z → A" },
  ],
  metaobjects: [
    { value: "display-name", label: "Display name" },
    { value: "updated-desc", label: "Recently updated" },
  ],
  "metafield-references": [
    { value: "source", label: "Reference order" },
  ],
  "sdk-provider": [
    { value: "source", label: "Provider order" },
  ],
});

export const QUERY_FILTER_FIELDS = Object.freeze({
  products: ["tag", "vendor", "product_type", "availability", "title", "handle"],
  collections: ["title", "handle"],
  blogs: ["title", "handle"],
  articles: ["title", "tag", "author", "blog_handle"],
  search: ["type"],
  metaobjects: ["field", "handle"],
  "metafield-references": ["namespace", "key"],
  "sdk-provider": ["title", "type"],
});

const FILTER_OPERATORS = new Set(["equals", "not-equals", "contains", "not-contains", "starts-with", "exists"]);
const SOURCES = new Set(QUERY_SOURCE_OPTIONS.map((item) => item.value));

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.round(numeric))) : fallback;
}

export function createQueryFilter(field = "tag") {
  return { id: `qf-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`, field, operator: "equals", value: "" };
}

export function normalizeQueryDefinition(input = {}) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const source = SOURCES.has(String(value.source || "")) ? String(value.source) : "products";
  const allowedSort = new Set((QUERY_SORT_OPTIONS[source] || []).map((item) => item.value));
  const filters = (Array.isArray(value.filters) ? value.filters : [])
    .slice(0, 12)
    .map((filter, index) => ({
      id: String(filter?.id || `filter-${index}`),
      field: String(filter?.field || QUERY_FILTER_FIELDS[source]?.[0] || "title"),
      operator: FILTER_OPERATORS.has(String(filter?.operator || "")) ? String(filter.operator) : "equals",
      value: String(filter?.value ?? ""),
    }));
  return {
    version: QUERY_AST_VERSION,
    source,
    query: String(value.query || "").slice(0, 500),
    filters,
    sort: allowedSort.has(String(value.sort || "")) ? String(value.sort) : (QUERY_SORT_OPTIONS[source]?.[0]?.value || "featured"),
    limit: clamp(value.limit, 1, 50, 12),
    offset: clamp(value.offset, 0, 500, 0),
    pagination: ["none", "load-more", "cursor"].includes(value.pagination) ? value.pagination : "none",
    metaobjectType: String(value.metaobjectType || "").trim().slice(0, 120),
    metafieldOwner: ["product", "collection"].includes(value.metafieldOwner) ? value.metafieldOwner : "product",
    metafieldNamespace: String(value.metafieldNamespace || "custom").trim().slice(0, 120),
    metafieldKey: String(value.metafieldKey || "").trim().slice(0, 120),
    providerId: String(value.providerId || "").trim().slice(0, 120),
    providerInputJson: String(value.providerInputJson || "{}").trim().slice(0, 4000),
    emptyText: String(value.emptyText || "No items found.").slice(0, 240),
    loadingText: String(value.loadingText || "Loading…").slice(0, 120),
    errorText: String(value.errorText || "Items could not be loaded.").slice(0, 160),
  };
}

function id(prefix = "loop") {
  try { if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`; } catch {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createLoopItemTemplate() {
  return {
    id: id("loop-item"),
    type: "container",
    label: "Loop Item",
    props: { __loopItem: true },
    styles: {
      spacing: { paddingTop: "12px", paddingRight: "12px", paddingBottom: "12px", paddingLeft: "12px" },
      border: { width: "1px", style: "solid", color: "#e5e5e5", radius: "12px" },
      layout: { display: "flex", flexDirection: "column", gap: "10px" },
    },
    children: [
      {
        id: id("loop-image"), type: "image", label: "Item Image",
        props: { sourceType: "dynamic", src: "", altMode: "custom", alt: "", resolution: "640", loading: "lazy", fetchPriority: "auto" },
        bindings: {
          "props.src": { enabled: true, type: "image", source: "loop.image.url", fallback: "" },
          "props.alt": { enabled: true, type: "text", source: "loop.title", fallback: "Item image" },
        },
        styles: { size: { width: "100%", height: "220px" }, objectFit: "cover", border: { radius: "8px" } },
        children: [],
      },
      {
        id: id("loop-title"), type: "heading", label: "Item Title", props: { text: "Item title", tag: "h3" },
        bindings: { "props.text": { enabled: true, type: "text", source: "loop.title", fallback: "Item title" } },
        styles: { typography: { fontSize: "18px", fontWeight: "600", lineHeight: "1.3", color: "#1a1a1a" } }, children: [],
      },
      {
        id: id("loop-meta"), type: "text", label: "Item Meta", props: { text: "Item details" },
        bindings: { "props.text": { enabled: true, type: "text", source: "loop.meta", fallback: "" } },
        styles: { typography: { fontSize: "14px", color: "#6d7175", lineHeight: "1.5" } }, children: [],
      },
    ],
  };
}

export function queryCostEstimate(query = {}) {
  const q = normalizeQueryDefinition(query);
  const base = { products: 12, collections: 8, blogs: 8, articles: 10, search: 14, metaobjects: 16, "metafield-references": 18, "sdk-provider": 20 }[q.source] || 10;
  const filterCost = q.filters.length * 2;
  const itemCost = Math.ceil(q.limit / 5) * (q.source === "metaobjects" ? 4 : 2);
  const estimate = base + filterCost + itemCost;
  return { estimate, level: estimate >= 45 ? "high" : estimate >= 28 ? "medium" : "low" };
}

export function querySummary(query = {}) {
  const q = normalizeQueryDefinition(query);
  const sourceLabel = QUERY_SOURCE_OPTIONS.find((item) => item.value === q.source)?.label || q.source;
  const providerLabel = q.source === "sdk-provider" && q.providerId ? ` (${q.providerId})` : "";
  const filters = q.filters.length ? `${q.filters.length} filter${q.filters.length === 1 ? "" : "s"}` : "no filters";
  return `${sourceLabel}${providerLabel} · ${filters} · ${q.sort} · limit ${q.limit}${q.offset ? ` · offset ${q.offset}` : ""}`;
}

export function normalizeLoopItem(raw = {}, source = "products") {
  if (!raw || typeof raw !== "object") return { id: "", title: "Item", meta: "", image: null, url: "#", raw: {} };
  const price = raw?.priceRangeV2?.minVariantPrice || raw?.price;
  let meta = raw.vendor || raw.excerpt || raw.description || raw.displayName || raw.type || "";
  if (source === "blogs" && raw?.articlesCount?.count != null) meta = `${raw.articlesCount.count} article${Number(raw.articlesCount.count) === 1 ? "" : "s"}`;
  if (source === "articles" && raw?.author?.name) meta = raw.author.name;
  if (price?.amount != null) {
    try { meta = new Intl.NumberFormat("en-US", { style: "currency", currency: price.currencyCode || "USD" }).format(Number(price.amount)); }
    catch { meta = `${price.amount} ${price.currencyCode || ""}`.trim(); }
  }
  const image = raw.featuredImage || raw.image || raw.media || null;
  const handle = raw.handle || "";
  const url = raw.url || (source === "products" && handle ? `/products/${handle}` : source === "collections" && handle ? `/collections/${handle}` : source === "blogs" && handle ? `/blogs/${handle}` : "#");
  return {
    id: String(raw.id || raw.handle || raw.title || Math.random()),
    title: String(raw.title || raw.displayName || raw.name || raw.handle || "Item"),
    description: String(raw.description || raw.excerpt || raw.body || ""),
    meta: String(meta || ""),
    handle: String(handle),
    url,
    image: image?.url ? image : image?.image?.url ? image.image : null,
    price: price || null,
    vendor: raw.vendor || "",
    type: raw.productType || raw.type || source,
    date: raw.publishedAt || raw.createdAt || raw.updatedAt || "",
    fields: Array.isArray(raw.fields) ? Object.fromEntries(raw.fields.map((field) => [field.key, field.value])) : {},
    raw,
  };
}

export function applyQueryFilters(items = [], query = {}) {
  const q = normalizeQueryDefinition(query);
  const text = (value) => String(value ?? "").toLowerCase();
  const read = (item, field) => {
    if (field === "tag") return item.raw?.tags || [];
    if (field === "availability") return item.raw?.variants?.nodes?.some?.((v) => v?.availableForSale) ? "available" : "sold-out";
    if (field === "product_type") return item.raw?.productType || item.type;
    if (field === "blog_handle") return item.raw?.blog?.handle || item.raw?.blogHandle || "";
    if (field === "author") return item.raw?.author?.name || item.raw?.author || "";
    if (field === "field") return JSON.stringify(item.fields || {});
    return item[field] ?? item.raw?.[field];
  };
  const compare = (actual, filter) => {
    if (filter.operator === "exists") return actual != null && actual !== "";
    const expected = text(filter.value);
    const list = Array.isArray(actual) ? actual.map(text) : [text(actual)];
    if (filter.operator === "equals") return list.some((v) => v === expected);
    if (filter.operator === "not-equals") return list.every((v) => v !== expected);
    if (filter.operator === "contains") return list.some((v) => v.includes(expected));
    if (filter.operator === "not-contains") return list.every((v) => !v.includes(expected));
    if (filter.operator === "starts-with") return list.some((v) => v.startsWith(expected));
    return true;
  };
  let result = items.filter((item) => q.filters.every((filter) => compare(read(item, filter.field), filter)));
  const titleSort = (a, b) => String(a.title || "").localeCompare(String(b.title || ""));
  if (q.sort === "title-asc") result.sort(titleSort);
  if (q.sort === "title-desc") result.sort((a, b) => titleSort(b, a));
  if (q.sort === "price-asc" || q.sort === "price-desc") {
    const amount = (item) => Number(item.price?.amount || item.raw?.priceRangeV2?.minVariantPrice?.amount || 0);
    result.sort((a, b) => q.sort === "price-asc" ? amount(a) - amount(b) : amount(b) - amount(a));
  }
  if (q.sort === "newest" || q.sort === "updated-desc") result.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (q.sort === "oldest") result.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return result.slice(q.offset, q.offset + q.limit);
}
