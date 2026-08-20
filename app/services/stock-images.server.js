import crypto from "node:crypto";
import { loadStockProviderCredentials, STOCK_IMAGE_IMPORT_PROVIDERS, STOCK_IMAGE_PROVIDERS } from "./stock-image-integrations.server.js";
import { trackedStockFetch } from "./stock-api-usage.server.js";
import { searchGetty, searchShutterstock } from "./stock-premium-providers.server.js";

const PROVIDER_LABELS = Object.freeze({ unsplash: "Unsplash", pexels: "Pexels", pixabay: "Pixabay", shutterstock: "Shutterstock", getty: "Getty/iStock" });
const CACHE_TTL_MS = Object.freeze({ unsplash: 60_000, pexels: 300_000, pixabay: 86_400_000, shutterstock: 300_000, getty: 300_000 });
const MAX_IMPORT_BYTES = 18 * 1024 * 1024;
const MAX_SHOPIFY_IMAGE_PIXELS = 18_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SOURCE_HOSTS = Object.freeze({
  unsplash: new Set(["images.unsplash.com", "plus.unsplash.com"]),
  pexels: new Set(["images.pexels.com"]),
  pixabay: new Set(["cdn.pixabay.com", "pixabay.com"]),
  shutterstock: new Set(["shutterstock.com", "picdn.net"]),
  getty: new Set(["gettyimages.com", "istockphoto.com"]),
});
const PAGE_HOSTS = Object.freeze({
  unsplash: new Set(["unsplash.com"]),
  pexels: new Set(["pexels.com"]),
  pixabay: new Set(["pixabay.com"]),
  shutterstock: new Set(["shutterstock.com"]),
  getty: new Set(["gettyimages.com", "istockphoto.com"]),
});
const ATTRIBUTION_UTM = Object.freeze({ utm_source: "vsn_builder", utm_medium: "referral" });

function safeJson(raw, fallback = {}) { try { return JSON.parse(String(raw || "")); } catch { return fallback; } }
function int(value, fallback, min, max) { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function bool(value) { return value === true || String(value) === "true" || String(value) === "1"; }
function cacheKey(input) { return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex"); }
function titleFromTags(tags, fallback = "Stock image") { const value = String(tags || "").split(",")[0]?.trim(); return value ? value.charAt(0).toUpperCase() + value.slice(1) : fallback; }
function rateMeta(response) { return { limit: response.headers.get("x-ratelimit-limit"), remaining: response.headers.get("x-ratelimit-remaining"), reset: response.headers.get("x-ratelimit-reset") }; }

function safeProviderPageUrl(provider, value, { attribution = false } = {}) {
  try {
    const url = new URL(String(value || ""));
    const hosts = PAGE_HOSTS[provider];
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !hosts || (!hosts.has(host) && ![...hosts].some((allowed) => host.endsWith(`.${allowed}`)))) return "";
    if (attribution && provider === "unsplash") for (const [key, val] of Object.entries(ATTRIBUTION_UTM)) if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  } catch { return ""; }
}

function normalizeOrientation(provider, value) {
  const common = String(value || "any");
  if (common === "any") return "";
  if (provider === "unsplash") return common === "square" ? "squarish" : common;
  if (provider === "pexels") return common;
  if (provider === "pixabay") return common === "landscape" ? "horizontal" : common === "portrait" ? "vertical" : "all";
  return "";
}

function unsplashResult(photo) {
  return { provider: "unsplash", providerLabel: "Unsplash", providerId: String(photo.id), width: photo.width || 0, height: photo.height || 0, thumbUrl: photo.urls?.small || photo.urls?.thumb || "", previewUrl: photo.urls?.regular || photo.urls?.small || "", alt: photo.alt_description || photo.description || "", title: photo.description || photo.alt_description || "Unsplash image", author: photo.user?.name || photo.user?.username || "Unsplash contributor", authorUrl: safeProviderPageUrl("unsplash", photo.user?.links?.html || "", { attribution:true }), sourceUrl: safeProviderPageUrl("unsplash", photo.links?.html || "", { attribution:true }), downloadLocation: photo.links?.download_location || "", color: photo.color || "", raw: { blurHash: photo.blur_hash || null } };
}
function pexelsResult(photo) {
  return { provider: "pexels", providerLabel: "Pexels", providerId: String(photo.id), width: photo.width || 0, height: photo.height || 0, thumbUrl: photo.src?.medium || photo.src?.small || "", previewUrl: photo.src?.large || photo.src?.large2x || photo.src?.medium || "", alt: photo.alt || "", title: photo.alt || `Pexels photo ${photo.id}`, author: photo.photographer || "Pexels contributor", authorUrl: safeProviderPageUrl("pexels", photo.photographer_url || ""), sourceUrl: safeProviderPageUrl("pexels", photo.url || ""), downloadLocation: "", color: photo.avg_color || "", raw: {} };
}
function pixabayResult(photo) {
  return { provider: "pixabay", providerLabel: "Pixabay", providerId: String(photo.id), width: photo.imageWidth || photo.webformatWidth || 0, height: photo.imageHeight || photo.webformatHeight || 0, thumbUrl: photo.previewURL || photo.webformatURL || "", previewUrl: photo.webformatURL || photo.largeImageURL || photo.previewURL || "", alt: String(photo.tags || "").replace(/,/g, ", "), title: titleFromTags(photo.tags, `Pixabay image ${photo.id}`), author: photo.user || "Pixabay contributor", authorUrl: safeProviderPageUrl("pixabay", photo.user && photo.user_id ? `https://pixabay.com/users/${encodeURIComponent(photo.user)}-${photo.user_id}/` : ""), sourceUrl: safeProviderPageUrl("pixabay", photo.pageURL || ""), downloadLocation: "", color: "", raw: { imageType: photo.type || "photo" } };
}

async function cached(db, shop, provider, key, ttl, loader) {
  const now = new Date();
  const found = await db.builderStockSearchCache.findUnique({ where: { shop_provider_cacheKey: { shop, provider, cacheKey: key } } }).catch(() => null);
  if (found && found.expiresAt > now) return { ...safeJson(found.responseJson, {}), cached: true };
  const value = await loader();
  const expiresAt = new Date(Date.now() + ttl);
  await db.builderStockSearchCache.upsert({ where: { shop_provider_cacheKey: { shop, provider, cacheKey: key } }, create: { shop, provider, cacheKey: key, responseJson: JSON.stringify(value), expiresAt }, update: { responseJson: JSON.stringify(value), expiresAt } }).catch(() => null);
  return { ...value, cached: false };
}

async function searchProvider(db, shop, provider, input) {
  if (provider === "shutterstock") return searchShutterstock(db, shop, "image", input);
  if (provider === "getty") return searchGetty(db, shop, "image", input);
  const auth = await loadStockProviderCredentials(db, shop, provider);
  if (!auth.enabled || !auth.apiKey) return { provider, results: [], total: 0, skipped: true, reason: !auth.enabled ? "disabled" : "not-configured" };
  const page = int(input.page, 1, 1, 1000); const perPage = int(input.perPage, auth.config?.imagePageSize || 24, 3, provider === "unsplash" ? 30 : provider === "pexels" ? 80 : 200);
  const query = String(input.query || "").trim().slice(0, 100);
  const common = { query, page, perPage, orientation: input.orientation || "any", color: String(input.color || "").trim() };
  const key = cacheKey({ provider, common, advanced: input.advanced || {}, config: auth.config });
  return cached(db, shop, provider, key, CACHE_TTL_MS[provider], async () => {
    let response; let payload;
    if (provider === "unsplash") {
      const headers = { Authorization: `Client-ID ${auth.apiKey}`, "Accept-Version": "v1", Accept: "application/json" };
      if (!query && common.orientation === "any" && !common.color) {
        const listOrder = String(input.advanced?.orderBy || auth.config.orderBy || "relevant") === "latest" ? "latest" : "popular";
        const params = new URLSearchParams({ page: String(page), per_page: String(Math.min(30, perPage)), order_by: listOrder });
        response = await trackedStockFetch(db, { shop, provider:"unsplash", mediaKind:"image", url:`https://api.unsplash.com/photos?${params}`, options:{ headers, signal: AbortSignal.timeout?.(12000) } });
        payload = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(`Unsplash discovery failed (${response.status}): ${payload?.errors?.join?.(" ") || "API error"}`);
        const photos = Array.isArray(payload) ? payload : [];
        return { provider, results: photos.map(unsplashResult), total: 0, totalPages: photos.length >= Math.min(30, perPage) ? page + 1 : page, rateLimit: rateMeta(response), discovery: true };
      }
      const params = new URLSearchParams({ query: query || "featured", page: String(page), per_page: String(Math.min(30, perPage)), order_by: String(input.advanced?.orderBy || auth.config.orderBy || "relevant"), content_filter: String(input.advanced?.contentFilter || auth.config.contentFilter || "high") });
      const orientation = normalizeOrientation(provider, input.orientation); if (orientation) params.set("orientation", orientation); if (common.color) params.set("color", common.color);
      response = await trackedStockFetch(db, { shop, provider:"unsplash", mediaKind:"image", url:`https://api.unsplash.com/search/photos?${params}`, options:{ headers, signal: AbortSignal.timeout?.(12000) } });
      payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Unsplash search failed (${response.status}): ${payload?.errors?.join?.(" ") || "API error"}`);
      return { provider, results: (payload.results || []).map(unsplashResult), total: Number(payload.total || 0), totalPages: Number(payload.total_pages || 1), rateLimit: rateMeta(response) };
    }
    if (provider === "pexels") {
      const headers = { Authorization: auth.apiKey, Accept: "application/json" };
      if (!query && common.orientation === "any" && !common.color) {
        const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
        response = await trackedStockFetch(db, { shop, provider:"pexels", mediaKind:"image", url:`https://api.pexels.com/v1/curated?${params}`, options:{ headers, signal: AbortSignal.timeout?.(12000) } });
        payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Pexels discovery failed (${response.status}): ${payload?.error || "API error"}`);
        return { provider, results: (payload.photos || []).map(pexelsResult), total: Number(payload.total_results || 0), totalPages: Math.max(1, Math.ceil(Number(payload.total_results || 0) / perPage)), rateLimit: rateMeta(response), discovery: true };
      }
      const params = new URLSearchParams({ query: query || "business", page: String(page), per_page: String(perPage) });
      const orientation = normalizeOrientation(provider, input.orientation); if (orientation) params.set("orientation", orientation); if (common.color) params.set("color", common.color);
      const size = String(input.advanced?.size || auth.config.size || ""); if (size) params.set("size", size);
      const locale = String(input.advanced?.locale || auth.config.locale || ""); if (locale) params.set("locale", locale);
      response = await trackedStockFetch(db, { shop, provider:"pexels", mediaKind:"image", url:`https://api.pexels.com/v1/search?${params}`, options:{ headers, signal: AbortSignal.timeout?.(12000) } });
      payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Pexels search failed (${response.status}): ${payload?.error || "API error"}`);
      return { provider, results: (payload.photos || []).map(pexelsResult), total: Number(payload.total_results || 0), totalPages: Math.max(1, Math.ceil(Number(payload.total_results || 0) / perPage)), rateLimit: rateMeta(response) };
    }
    const params = new URLSearchParams({ key: auth.apiKey, q: query, page: String(page), per_page: String(Math.max(3, perPage)), image_type: String(input.advanced?.imageType || auth.config.imageType || "photo"), safesearch: String(input.advanced?.safeSearch == null ? auth.config.safeSearch !== false : bool(input.advanced.safeSearch)), editors_choice: String(input.advanced?.editorsChoice == null ? auth.config.editorsChoice === true : bool(input.advanced.editorsChoice)), order: String(input.advanced?.order || auth.config.order || "popular"), lang: String(input.advanced?.lang || auth.config.lang || "en") });
    const orientation = normalizeOrientation(provider, input.orientation); if (orientation) params.set("orientation", orientation); if (common.color) params.set("colors", common.color);
    for (const [keyName, param] of [["category","category"],["minWidth","min_width"],["minHeight","min_height"]]) { const v = input.advanced?.[keyName]; if (v !== undefined && String(v) !== "") params.set(param, String(v)); }
    response = await trackedStockFetch(db, { shop, provider:"pixabay", mediaKind:"image", url:`https://pixabay.com/api/?${params}`, options:{ headers:{Accept:"application/json"}, signal: AbortSignal.timeout?.(12000) } });
    payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Pixabay search failed (${response.status}): ${typeof payload === "string" ? payload : "API error"}`);
    return { provider, results: (payload.hits || []).map(pixabayResult), total: Number(payload.totalHits || payload.total || 0), totalPages: Math.max(1, Math.ceil(Number(payload.totalHits || 0) / perPage)), rateLimit: rateMeta(response) };
  });
}

function roundRobin(groups, limit) {
  const lists = groups.map((group) => [...(group.results || [])]); const out = [];
  while (out.length < limit && lists.some((list) => list.length)) for (const list of lists) { if (out.length >= limit) break; if (list.length) out.push(list.shift()); }
  return out;
}

export async function searchStockImages(db, shop, input = {}) {
  await db.builderStockSearchCache.deleteMany({ where: { shop, expiresAt: { lt: new Date() } } }).catch(() => null);
  const provider = STOCK_IMAGE_PROVIDERS.includes(String(input.provider)) ? String(input.provider) : "all";
  const page = int(input.page, 1, 1, 1000); const perPage = int(input.perPage, 24, 3, 100);
  const providers = provider === "all" ? STOCK_IMAGE_PROVIDERS : [provider];
  const share = provider === "all" ? Math.max(3, Math.ceil(perPage / providers.length)) : perPage;
  const settled = await Promise.all(providers.map(async (name) => { try { return await searchProvider(db, shop, name, { ...input, page, perPage: share }); } catch (error) { return { provider: name, results: [], total: 0, error: error instanceof Error ? error.message : String(error) }; } }));
  const results = provider === "all" ? roundRobin(settled, perPage) : settled[0]?.results || [];
  const sourceStates = Object.fromEntries(settled.map((row) => [row.provider, { total: row.total || 0, totalPages: row.totalPages || 1, error: row.error || null, skipped: row.skipped || false, reason: row.reason || null, cached: row.cached === true, rateLimit: row.rateLimit || null }]));
  return { query: String(input.query || ""), provider, page, perPage, results, sourceStates, hasMore: settled.some((row) => page < Number(row.totalPages || 1)) };
}

export function safeImageTarget(width, height, maxPixels = MAX_SHOPIFY_IMAGE_PIXELS) {
  const w=Math.max(1,Number(width)||1), h=Math.max(1,Number(height)||1), pixels=w*h;
  if (pixels<=maxPixels) return { width:Math.round(w), height:Math.round(h), resized:false };
  const scale=Math.sqrt(maxPixels/pixels);
  return { width:Math.max(1,Math.floor(w*scale)), height:Math.max(1,Math.floor(h*scale)), resized:true };
}
function unsplashShopifyUrl(value,width,height){
  const url=new URL(String(value||"")); const target=safeImageTarget(width,height);
  url.searchParams.set("w",String(target.width));
  url.searchParams.set("fit","max");
  url.searchParams.set("q","85");
  return {url:url.toString(),target};
}
function targetByMaxDimension(width,height,maxDimension){const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),scale=Math.min(1,maxDimension/Math.max(w,h));return{width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),resized:scale<1};}
function pexelsShopifyUrl(payload){
  return payload.src?.large2x || payload.src?.large || payload.src?.medium || "";
}
function pixabayShopifyUrl(photo){
  return photo.fullHDURL || photo.largeImageURL || photo.webformatURL || photo.previewURL || "";
}

async function providerPhoto(db, shop, provider, id) {
  if (!STOCK_IMAGE_IMPORT_PROVIDERS.includes(provider)) throw new Error(`${PROVIDER_LABELS[provider] || provider} search is available, but Shopify import requires a licensed final-download workflow that is not enabled for this provider.`);
  const auth = await loadStockProviderCredentials(db, shop, provider);
  if (!auth.enabled || !auth.apiKey) throw new Error(`${PROVIDER_LABELS[provider]} API is not configured.`);
  let response; let payload;
  if (provider === "unsplash") {
    response = await trackedStockFetch(db, { shop, provider:"unsplash", mediaKind:"image", url:`https://api.unsplash.com/photos/${encodeURIComponent(id)}`, options:{ headers:{Authorization:`Client-ID ${auth.apiKey}`,"Accept-Version":"v1",Accept:"application/json"}, signal:AbortSignal.timeout?.(12000) } });
    payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Unsplash image lookup failed (${response.status}).`);
    const result=unsplashResult(payload); const optimized=unsplashShopifyUrl(payload.urls?.raw || payload.urls?.full || payload.urls?.regular || "", result.width, result.height); return { result:{...result,shopifyTarget:optimized.target}, downloadUrl:optimized.url, auth };
  }
  if (provider === "pexels") {
    response = await trackedStockFetch(db, { shop, provider:"pexels", mediaKind:"image", url:`https://api.pexels.com/v1/photos/${encodeURIComponent(id)}`, options:{ headers:{Authorization:auth.apiKey,Accept:"application/json"}, signal:AbortSignal.timeout?.(12000) } });
    payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Pexels image lookup failed (${response.status}).`);
    const result=pexelsResult(payload); return { result:{...result,shopifyTarget:targetByMaxDimension(result.width,result.height,1880)}, downloadUrl:pexelsShopifyUrl(payload), auth };
  }
  response = await trackedStockFetch(db, { shop, provider:"pixabay", mediaKind:"image", url:`https://pixabay.com/api/?key=${encodeURIComponent(auth.apiKey)}&id=${encodeURIComponent(id)}`, options:{ headers:{Accept:"application/json"}, signal:AbortSignal.timeout?.(12000) } });
  payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Pixabay image lookup failed (${response.status}).`);
  const photo = payload.hits?.[0]; if (!photo) throw new Error("Pixabay image no longer exists.");
  const result=pixabayResult(photo); return { result:{...result,shopifyTarget:targetByMaxDimension(result.width,result.height,photo.fullHDURL?1920:1280)}, downloadUrl:pixabayShopifyUrl(photo), auth };
}

function assertSourceUrl(provider, value) {
  const url = new URL(String(value || ""));
  const hosts = SOURCE_HOSTS[provider];
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (!hosts.has(host) && ![...hosts].some((allowed) => host.endsWith(`.${allowed}`)))) throw new Error("Stock provider returned an untrusted image host.");
  return url;
}

async function trackUnsplashDownload(db, shop, auth, result) {
  if (!result?.downloadLocation) return;
  const response = await trackedStockFetch(db, { shop, provider:"unsplash", mediaKind:"image", url:result.downloadLocation, options:{ headers:{Authorization:`Client-ID ${auth.apiKey}`,"Accept-Version":"v1",Accept:"application/json"}, signal:AbortSignal.timeout?.(10000) } });
  if (!response.ok) throw new Error(`Unsplash download tracking failed (${response.status}).`);
}

async function downloadImage(provider, url) {
  assertSourceUrl(provider, url);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout?.(30000) });
  if (!response.ok) throw new Error(`Could not download ${PROVIDER_LABELS[provider]} image (${response.status}).`);
  assertSourceUrl(provider, response.url || url);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error(`Unsupported stock image MIME type: ${contentType || "unknown"}.`);
  const contentLength = Number(response.headers.get("content-length") || 0); if (contentLength > MAX_IMPORT_BYTES) throw new Error("Stock image is larger than the safe 18 MB Shopify import limit.");
  const arrayBuffer = await response.arrayBuffer(); if (arrayBuffer.byteLength > MAX_IMPORT_BYTES) throw new Error("Stock image is larger than the safe 18 MB Shopify import limit.");
  return { bytes: new Uint8Array(arrayBuffer), contentType };
}

function fileNameFor(result, mime) {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const stem = `${result.provider}-${result.providerId}-${String(result.title || "stock-image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image"}`;
  return `${stem}.${ext}`;
}

async function stagedUpload(admin, file) {
  const response = await admin.graphql(`#graphql
    mutation VsnStockStagedUpload($input:[StagedUploadInput!]!){ stagedUploadsCreate(input:$input){ stagedTargets{url resourceUrl parameters{name value}} userErrors{field message} } }
  `, { variables: { input: [{ filename: file.filename, mimeType: file.contentType, httpMethod: "POST", resource: "IMAGE" }] } });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.stagedUploadsCreate || {}; if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  const target = payload.stagedTargets?.[0]; if (!target?.url || !target?.resourceUrl) throw new Error("Shopify did not return a staged upload target.");
  const body = new FormData(); for (const parameter of target.parameters || []) body.append(parameter.name, parameter.value); body.append("file", new Blob([file.bytes], { type: file.contentType }), file.filename);
  const upload = await fetch(target.url, { method: "POST", body }); if (!upload.ok) throw new Error(`Shopify staged upload failed (${upload.status}).`);
  return target.resourceUrl;
}

function fileNode(file) {
  return { id: file?.id || "", fileStatus: file?.fileStatus || "PROCESSING", alt: file?.alt || "", url: file?.image?.url || file?.preview?.image?.url || "", width: file?.image?.width || 0, height: file?.image?.height || 0 };
}

async function createShopifyFile(admin, stagedUrl, result, filename) {
  const response = await admin.graphql(`#graphql
    mutation VsnStockFileCreate($files:[FileCreateInput!]!){ fileCreate(files:$files){ files{id fileStatus alt ... on MediaImage{image{url width height}}} userErrors{field message code} } }
  `, { variables: { files: [{ originalSource: stagedUrl, alt: result.alt || result.title || "Stock image", contentType: "IMAGE", duplicateResolutionMode: "APPEND_UUID" }] } });
  const json = await response.json(); if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileCreate || {}; if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  const file = payload.files?.[0]; if (!file?.id) throw new Error("Shopify did not create the stock image file."); return fileNode(file);
}

async function updateShopifyFile(admin, fileId, stagedUrl, result, filename) {
  const statusResponse = await admin.graphql(`#graphql
    query VsnStockFileStatus($id:ID!){node(id:$id){... on MediaImage{id fileStatus}}}`, { variables: { id: fileId } });
  const statusJson = await statusResponse.json(); const status = statusJson.data?.node?.fileStatus;
  if (status && status !== "READY") throw new Error(`Shopify file is ${status}. Wait until it is READY before updating.`);
  const response = await admin.graphql(`#graphql
    mutation VsnStockFileUpdate($files:[FileUpdateInput!]!){ fileUpdate(files:$files){ files{id fileStatus alt ... on MediaImage{image{url width height}}} userErrors{field message code} } }
  `, { variables: { files: [{ id: fileId, originalSource: stagedUrl, alt: result.alt || result.title || "Stock image" }] } });
  const json = await response.json(); if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileUpdate || {}; if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  return fileNode(payload.files?.[0] || { id: fileId, fileStatus: "PROCESSING" });
}

async function deleteShopifyFile(admin, fileId) {
  const response = await admin.graphql(`#graphql
    mutation VsnStockFileDelete($ids:[ID!]!){fileDelete(fileIds:$ids){deletedFileIds userErrors{field message code}}}`, { variables: { ids: [fileId] } });
  const json = await response.json(); if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileDelete || {}; if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  return payload.deletedFileIds?.includes(fileId) || false;
}

function sourceKey(provider, providerId) { return `stock:${provider}:${providerId}`; }
function serializeLibrary(row) { const content = safeJson(row.contentJson, {}); return { id: row.id, provider: content.provider || row.source?.replace(/^stock:/, "") || "", providerId: content.providerId || "", title: row.title, thumbnail: row.thumbnail || content.previewUrl || "", isFavorite: row.isFavorite === true, imported: Boolean(content.shopifyFileId), shopifyFileId: content.shopifyFileId || "", shopifyUrl: content.shopifyUrl || "", fileStatus: content.fileStatus || "", author: content.author || "", sourceUrl: content.sourceUrl || "", updatedAt: row.updatedAt?.toISOString?.() || null, data: content }; }

export async function listStockLibrary(db, shop) {
  const rows = await db.builderLibraryItem.findMany({ where: { shop, kind: "stock-image", deletedAt: null }, orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }], take: 500 });
  const items = rows.map(serializeLibrary); return { favorites: items.filter((row) => row.isFavorite), imports: items.filter((row) => row.imported) };
}

async function findStockLibrary(db, shop, provider, providerId) { return db.builderLibraryItem.findFirst({ where: { shop, kind: "stock-image", sourceKey: sourceKey(provider, providerId), deletedAt: null } }); }

export async function toggleStockFavorite(db, shop, provider, providerId, favorite, metadata = {}) {
  if (!STOCK_IMAGE_PROVIDERS.includes(provider)) throw new Error("Unknown stock image provider.");
  const existing = await findStockLibrary(db, shop, provider, providerId);
  let previewUrl = String(metadata.previewUrl || metadata.thumbUrl || "").slice(0, 1200);
  if (provider === "pixabay") previewUrl = "";
  else { try { assertSourceUrl(provider, previewUrl); } catch { previewUrl = ""; } }
  const clean = { provider, providerId, title: String(metadata.title || "Stock image").slice(0, 180), previewUrl, author: String(metadata.author || "").slice(0, 180), sourceUrl: safeProviderPageUrl(provider, metadata.sourceUrl || "", { attribution:true }) };
  if (existing) {
    const current = safeJson(existing.contentJson, {}); const updated = await db.builderLibraryItem.update({ where: { id: existing.id }, data: { isFavorite: favorite === true, title: clean.title || existing.title, thumbnail: clean.previewUrl || existing.thumbnail, contentJson: JSON.stringify({ ...current, ...clean }) } }); return serializeLibrary(updated);
  }
  if (!favorite) return null;
  const created = await db.builderLibraryItem.create({ data: { shop, title: clean.title, kind: "stock-image", category: "Stock Images", syncMode: "local", contentJson: JSON.stringify(clean), thumbnail: clean.previewUrl || null, isFavorite: true, sourceKey: sourceKey(provider, providerId), source: `stock:${provider}`, description: `${PROVIDER_LABELS[provider]} stock image reference` } }); return serializeLibrary(created);
}

export async function importStockImage({ db, admin, shop, provider, providerId, actor = null, update = false }) {
  if (!STOCK_IMAGE_IMPORT_PROVIDERS.includes(provider)) throw new Error(`${PROVIDER_LABELS[provider] || provider} requires its own licensed final-download workflow before Shopify import.`);
  const { result, downloadUrl, auth } = await providerPhoto(db, shop, provider, providerId); if (!downloadUrl) throw new Error(`${PROVIDER_LABELS[provider]} did not provide a downloadable image URL.`);
  if (provider === "unsplash") await trackUnsplashDownload(db, shop, auth, result);
  const downloaded = await downloadImage(provider, downloadUrl); const filename = fileNameFor(result, downloaded.contentType); const stagedUrl = await stagedUpload(admin, { ...downloaded, filename });
  const existing = await findStockLibrary(db, shop, provider, providerId); const current = safeJson(existing?.contentJson, {});
  let file;
  if (update) {
    if (!existing || !current.shopifyFileId) throw new Error("Import this image to Shopify before updating it.");
    file = await updateShopifyFile(admin, current.shopifyFileId, stagedUrl, result, filename);
  } else file = await createShopifyFile(admin, stagedUrl, result, filename);
  const content = { ...current, ...result, shopifyFileId: file.id, shopifyUrl: file.url || current.shopifyUrl || "", fileStatus: file.fileStatus, filename, importedAt: new Date().toISOString() };
  const safeFavoriteThumbnail = provider === "pixabay" ? null : (result.previewUrl || result.thumbUrl || existing?.thumbnail || null);
  const data = { title: result.title || existing?.title || "Stock image", kind: "stock-image", category: "Stock Images", syncMode: "local", contentJson: JSON.stringify(content), thumbnail: file.url || safeFavoriteThumbnail, sourceKey: sourceKey(provider, providerId), source: `stock:${provider}`, createdBy: actor };
  const row = existing ? await db.builderLibraryItem.update({ where: { id: existing.id }, data }) : await db.builderLibraryItem.create({ data: { shop, isFavorite: false, ...data } }); return serializeLibrary(row);
}

export async function deleteImportedStockImage({ db, admin, shop, provider, providerId }) {
  const existing = await findStockLibrary(db, shop, provider, providerId); if (!existing) throw new Error("Stock image record was not found.");
  const content = safeJson(existing.contentJson, {}); if (!content.shopifyFileId) throw new Error("This stock image is not imported to Shopify Files.");
  await deleteShopifyFile(admin, content.shopifyFileId);
  const next = { ...content, shopifyFileId: "", shopifyUrl: "", fileStatus: "DELETED", deletedFromShopifyAt: new Date().toISOString() };
  if (!existing.isFavorite) { await db.builderLibraryItem.update({ where: { id: existing.id }, data: { deletedAt: new Date(), contentJson: JSON.stringify(next) } }); return null; }
  return serializeLibrary(await db.builderLibraryItem.update({ where: { id: existing.id }, data: { contentJson: JSON.stringify(next) } }));
}
