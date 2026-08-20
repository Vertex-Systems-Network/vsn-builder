export const LIBRARY_TRANSFER_VERSION = 4;
export const LIBRARY_TRANSFER_FORMAT = "vsn-resource-package";

function parseJson(value, fallback = null) {
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function checksum(value) {
  // Small deterministic transport checksum. This detects accidental package corruption; it is not a security signature.
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function scanLibraryDependencies(content) {
  const widgets = new Set();
  const components = new Set();
  const libraryRefs = new Set();
  const assets = new Set();
  const fonts = new Set();
  const svgAssets = new Set();
  const queries = new Set();

  const visitValue = (value, key = "") => {
    if (value == null) return;
    if (Array.isArray(value)) { value.forEach((entry) => visitValue(entry, key)); return; }
    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => visitValue(childValue, childKey));
      return;
    }
    const text = String(value).trim();
    if (!text) return;
    if (/^(https?:\/\/|\/\/|\/files\/|shopify:\/\/)/i.test(text) && /(src|url|image|poster|media|asset|href)/i.test(key)) assets.add(text);
    if (/fontfamily/i.test(key)) fonts.add(text);
    if (/svgassetid/i.test(key)) svgAssets.add(text);
    if (/query(id|key)?/i.test(key) && text.length < 180) queries.add(text);
  };

  const walk = (nodes) => {
    for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
      if (!node || typeof node !== "object") continue;
      if (node.type) widgets.add(String(node.type));
      if (node.props?.componentId) components.add(String(node.props.componentId));
      if (node.meta?.libraryItemId) libraryRefs.add(String(node.meta.libraryItemId));
      visitValue(node.props || {});
      visitValue(node.styles || {});
      visitValue(node.meta || {});
      walk(node.children || []);
    }
  };
  walk(Array.isArray(content) ? content : [content]);

  return {
    widgets: unique([...widgets]),
    components: unique([...components]),
    libraryRefs: unique([...libraryRefs]),
    assets: unique([...assets]),
    fonts: unique([...fonts]),
    svgAssets: unique([...svgAssets]),
    queries: unique([...queries]),
  };
}

export function libraryTransferItem(item) {
  if (!item) return null;
  const content = item.content ?? parseJson(item.contentJson, null);
  if (content == null) return null;
  const resourceId = String(item.resourceId || item.id || item.sourceKey || `${item.kind || "section"}:${item.title || "item"}`);
  const rawTransferKey = String(item.transferKey || item.sourceKey || `library:${resourceId}`);
  const transferKey = rawTransferKey.startsWith("import:") ? rawTransferKey.slice(7) : rawTransferKey;
  return {
    resourceId,
    transferKey,
    title: String(item.title || "Saved item"),
    kind: String(item.kind || "section"),
    category: String(item.category || "General"),
    syncMode: item.syncMode === "global" ? "global" : "local",
    content: clone(content),
    thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : null,
    templateType: typeof item.templateType === "string" ? item.templateType : null,
    sourceVersion: Number(item.sourceVersion || 1),
    description: typeof item.description === "string" ? item.description : null,
    industry: typeof item.industry === "string" ? item.industry : null,
    style: typeof item.style === "string" ? item.style : null,
    planTier: typeof item.planTier === "string" ? item.planTier : null,
    colorTags: typeof item.colorTags === "string" ? item.colorTags : JSON.stringify(item.colorTags || []),
    layoutTags: typeof item.layoutTags === "string" ? item.layoutTags : JSON.stringify(item.layoutTags || []),
    qualityScore: Number.isFinite(Number(item.qualityScore)) ? Number(item.qualityScore) : null,
    compatibilityJson: typeof item.compatibilityJson === "string" ? item.compatibilityJson : JSON.stringify(item.compatibility || {}),
    screenshotJson: typeof item.screenshotJson === "string" ? item.screenshotJson : JSON.stringify(item.screenshot || {}),
    dependencies: scanLibraryDependencies(content),
  };
}

function aggregateDependencies(items) {
  const merged = { widgets: [], components: [], libraryRefs: [], assets: [], fonts: [], svgAssets: [], queries: [] };
  for (const item of items) {
    const deps = item?.dependencies || scanLibraryDependencies(item?.content);
    for (const key of Object.keys(merged)) merged[key].push(...(deps?.[key] || []));
  }
  return Object.fromEntries(Object.entries(merged).map(([key, values]) => [key, unique(values)]));
}

export function makeLibraryBundleExport(items, options = {}) {
  const resources = (items || []).map(libraryTransferItem).filter(Boolean);
  const dependencies = aggregateDependencies(resources);
  const payload = {
    format: LIBRARY_TRANSFER_FORMAT,
    version: LIBRARY_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    manifest: {
      name: String(options.name || (resources.length === 1 ? resources[0]?.title : "VSN Saved Library package")),
      sourceBuilderVersion: String(options.builderVersion || "unknown"),
      resourceCount: resources.length,
      kinds: unique(resources.map((item) => item.kind)),
      dependencies,
      conflictPolicy: "copy",
    },
    resources: {
      library: resources,
      components: resources.filter((item) => item.kind === "component"),
    },
  };
  return { ...payload, checksum: checksum(payload) };
}

export function makeLibrarySingleExport(item, options = {}) {
  return makeLibraryBundleExport([item], { ...options, name: item?.title || "VSN Saved Library item" });
}

export function extractLibraryImportItems(payload) {
  if (!payload) return [];
  if (payload.format === LIBRARY_TRANSFER_FORMAT && Array.isArray(payload.resources?.library)) return payload.resources.library;
  // Backward compatibility with transfer v1-v3 and ad-hoc legacy exports.
  if (Array.isArray(payload)) return payload;
  if (payload.format === "vsn-library-item" && payload.item) return [payload.item];
  if (payload.item && !Array.isArray(payload.items)) return [payload.item];
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.title && (payload.content != null || payload.contentJson != null)) return [payload];
  return [];
}

export function inspectLibraryImportPackage(payload, existingItems = []) {
  const items = extractLibraryImportItems(payload).map(libraryTransferItem).filter(Boolean);
  const exactKeys = new Map((existingItems || []).filter(Boolean).map((item) => [String(item.sourceKey || ""), item]).filter(([key]) => key));
  const titleKeys = new Set((existingItems || []).map((item) => `${String(item.kind || "section")}:${String(item.title || "").toLowerCase()}`));
  const conflicts = [];
  for (const item of items) {
    const importKey = `import:${item.transferKey}`;
    if (exactKeys.has(importKey)) conflicts.push({ resourceId: item.resourceId, title: item.title, type: "previous-import", existingId: exactKeys.get(importKey)?.id || null });
    else if (titleKeys.has(`${item.kind}:${item.title.toLowerCase()}`)) conflicts.push({ resourceId: item.resourceId, title: item.title, type: "same-title", existingId: null });
  }
  const dependencies = aggregateDependencies(items);
  const supportedKinds = new Set(["widget", "container", "section", "page", "style", "component"]);
  const invalid = items.filter((item) => !supportedKinds.has(item.kind) || item.content == null).map((item) => ({ title: item.title, reason: "Unsupported resource type or empty content." }));
  const checksumValue = typeof payload?.checksum === "string" ? payload.checksum : null;
  const checksumValid = checksumValue ? (()=>{ const { checksum:ignored, ...unsigned } = payload; return checksum(unsigned) === checksumValue; })() : null;
  return {
    valid: items.length > 0 && invalid.length === 0 && checksumValid !== false,
    format: payload?.format || "legacy",
    version: Number(payload?.version || 1),
    checksum: checksumValue,
    checksumValid,
    resources: items.length,
    kinds: unique(items.map((item) => item.kind)),
    conflicts,
    dependencies,
    invalid,
    items,
  };
}

export function remapLibraryContent(content, idMap = {}) {
  const cloned = clone(content);
  const walk = (nodes) => {
    for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
      if (!node || typeof node !== "object") continue;
      if (node.props?.componentId && idMap[node.props.componentId]) node.props.componentId = idMap[node.props.componentId];
      if (node.meta?.libraryItemId && idMap[node.meta.libraryItemId]) node.meta.libraryItemId = idMap[node.meta.libraryItemId];
      else if (node.meta?.libraryItemId && !idMap[node.meta.libraryItemId]) {
        // Imported content must not retain a live global-library link to another store.
        delete node.meta.libraryItemId;
        if (node.meta.librarySync === "global") node.meta.librarySync = "local";
      }
      walk(node.children || []);
    }
  };
  walk(Array.isArray(cloned) ? cloned : [cloned]);
  return cloned;
}
