const DEFAULT_TIMEOUT_MS = 45_000;

function allowedHost(hostname, allowedHosts = []) {
  const host = String(hostname || "").toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function assertTrustedMediaUrl(value, allowedHosts = []) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" || !allowedHost(url.hostname, allowedHosts)) throw new Error("Stock provider returned an untrusted media URL.");
  return url;
}

export async function downloadStockMedia({ url, allowedHosts, allowedMimeTypes, maxBytes, label = "media", timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  assertTrustedMediaUrl(url, allowedHosts);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout?.(timeoutMs) });
  if (!response.ok) throw new Error(`Could not download ${label} (${response.status}).`);
  assertTrustedMediaUrl(response.url || url, allowedHosts);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (allowedMimeTypes?.size && !allowedMimeTypes.has(contentType)) throw new Error(`Unsupported ${label} MIME type: ${contentType || "unknown"}.`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxBytes) throw new Error(`${label} is larger than the safe ${Math.floor(maxBytes / 1024 / 1024)} MB import limit.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error(`${label} is larger than the safe ${Math.floor(maxBytes / 1024 / 1024)} MB import limit.`);
  return { bytes: new Uint8Array(buffer), contentType, size: buffer.byteLength };
}

export async function createStagedMediaUpload(admin, { filename, contentType, bytes, resource = "FILE" } = {}) {
  const variables = { input: [{ filename, mimeType: contentType, httpMethod: "POST", resource, ...(resource === "VIDEO" ? { fileSize: String(bytes.byteLength) } : {}) }] };
  const response = await admin.graphql(`#graphql
    mutation VsnStockMediaStagedUpload($input:[StagedUploadInput!]!){ stagedUploadsCreate(input:$input){ stagedTargets{url resourceUrl parameters{name value}} userErrors{field message} } }
  `, { variables });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.stagedUploadsCreate || {};
  if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  const target = payload.stagedTargets?.[0];
  if (!target?.url || !target?.resourceUrl) throw new Error("Shopify did not return a staged upload target.");
  const body = new FormData();
  for (const parameter of target.parameters || []) body.append(parameter.name, parameter.value);
  body.append("file", new Blob([bytes], { type: contentType }), filename);
  const upload = await fetch(target.url, { method: "POST", body });
  if (!upload.ok) throw new Error(`Shopify staged upload failed (${upload.status}).`);
  return target.resourceUrl;
}

function normalizeFileNode(file) {
  return {
    id: file?.id || "",
    fileStatus: file?.fileStatus || "PROCESSING",
    alt: file?.alt || "",
    url: file?.url || file?.image?.url || file?.preview?.image?.url || "",
    previewUrl: file?.preview?.image?.url || file?.image?.url || "",
  };
}

const FILE_FRAGMENT = `
  id fileStatus alt
  ... on GenericFile { url }
  ... on MediaImage { image { url width height } }
  ... on Video { preview { image { url width height } } }
`;

export async function createShopifyMediaFile(admin, { stagedUrl, filename, alt = "Stock media", contentType = "FILE" } = {}) {
  // stagedUploadsCreate already owns the filename. Shopify staged resource URLs do not carry a file extension,
  // so sending filename again to fileCreate can trigger MISMATCHED_FILENAME_AND_ORIGINAL_SOURCE.
  const response = await admin.graphql(`#graphql
    mutation VsnStockMediaFileCreate($files:[FileCreateInput!]!){ fileCreate(files:$files){ files{${FILE_FRAGMENT}} userErrors{field message code} } }
  `, { variables: { files: [{ originalSource: stagedUrl, alt, contentType, duplicateResolutionMode: "APPEND_UUID" }] } });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileCreate || {};
  if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  const file = payload.files?.[0];
  if (!file?.id) throw new Error("Shopify did not create the stock media file.");
  return normalizeFileNode(file);
}

export async function updateShopifyMediaFile(admin, { fileId, stagedUrl, filename, alt = "Stock media" } = {}) {
  const statusResponse = await admin.graphql(`#graphql
    query VsnStockMediaFileStatus($id:ID!){ node(id:$id){ ... on GenericFile{id fileStatus} ... on Video{id fileStatus} ... on MediaImage{id fileStatus} } }
  `, { variables: { id: fileId } });
  const statusJson = await statusResponse.json();
  const status = statusJson.data?.node?.fileStatus;
  if (status && status !== "READY") throw new Error(`Shopify file is ${status}. Wait until it is READY before updating.`);
  const response = await admin.graphql(`#graphql
    mutation VsnStockMediaFileUpdate($files:[FileUpdateInput!]!){ fileUpdate(files:$files){ files{${FILE_FRAGMENT}} userErrors{field message code} } }
  `, { variables: { files: [{ id: fileId, originalSource: stagedUrl, alt }] } });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileUpdate || {};
  if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  return normalizeFileNode(payload.files?.[0] || { id: fileId, fileStatus: "PROCESSING" });
}

export async function deleteShopifyMediaFile(admin, fileId) {
  const response = await admin.graphql(`#graphql
    mutation VsnStockMediaFileDelete($ids:[ID!]!){ fileDelete(fileIds:$ids){ deletedFileIds userErrors{field message code} } }
  `, { variables: { ids: [fileId] } });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((row) => row.message).join(" "));
  const payload = json.data?.fileDelete || {};
  if (payload.userErrors?.length) throw new Error(payload.userErrors.map((row) => row.message).join(" "));
  return payload.deletedFileIds?.includes(fileId) || false;
}
