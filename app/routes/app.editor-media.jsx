import { authenticate } from "../shopify.server";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function absoluteCdnUrl(value = "") {
  const url = String(value || "").trim();
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function normalizeFile(node) {
  if (!node?.id) return null;
  const typename = node.__typename || "";

  if (typename === "MediaImage") {
    const image = node.image || node.preview?.image || null;
    const url = absoluteCdnUrl(image?.url || node.preview?.image?.url || "");
    return {
      id: node.id,
      type: "image",
      mediaType: typename,
      url,
      previewUrl: absoluteCdnUrl(node.preview?.image?.url || url),
      alt: node.alt || image?.altText || "",
      width: image?.width || null,
      height: image?.height || null,
      mimeType: node.mimeType || "image/*",
      status: node.fileStatus || node.status || "",
      errors: (node.fileErrors || []).map((error) => error?.message || error?.details || error?.code).filter(Boolean),
      fileName: url?.split("/").pop()?.split("?")[0] || "",
    };
  }

  if (typename === "GenericFile") {
    const url = absoluteCdnUrl(node.url || "");
    return {
      id: node.id,
      type: "file",
      mediaType: typename,
      url,
      previewUrl: absoluteCdnUrl(node.preview?.image?.url || url),
      alt: node.alt || "",
      mimeType: node.mimeType || "",
      status: node.fileStatus || "",
      errors: (node.fileErrors || []).map((error) => error?.message || error?.details || error?.code).filter(Boolean),
      fileName: url?.split("/").pop()?.split("?")[0] || "",
    };
  }

  if (typename === "Video") {
    const source = node.sources?.find((item) => item?.url) || node.originalSource || null;
    return {
      id: node.id,
      type: "video",
      mediaType: typename,
      url: absoluteCdnUrl(source?.url || ""),
      previewUrl: absoluteCdnUrl(node.preview?.image?.url || source?.url || ""),
      alt: node.alt || "",
      mimeType: source?.mimeType || "video/*",
      status: node.fileStatus || node.status || "",
      errors: (node.fileErrors || []).map((error) => error?.message || error?.details || error?.code).filter(Boolean),
      fileName: node.filename || source?.url?.split("/").pop()?.split("?")[0] || "",
    };
  }

  return null;
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value
        .map((item) => {
          if (typeof item === "string" || typeof item === "number") return String(item);
          if (item && typeof item === "object") return item.id || item.value || "";
          return "";
        })
        .map((id) => String(id || "").trim())
        .filter(Boolean))]
    : [];
}

function numericIdentity(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/(?:\/|^)(\d+)(?:\?.*)?$/);
  return match?.[1] || (/^\d+$/.test(text) ? text : "");
}

function identityKeys(value = "") {
  const raw = String(value || "").trim();
  const numeric = numericIdentity(raw);
  return new Set([raw, numeric].filter(Boolean));
}

function fileMatchesRequestedId(file, requestedId) {
  if (!file?.id || !requestedId) return false;
  const fileKeys = identityKeys(file.id);
  return [...identityKeys(requestedId)].some((key) => fileKeys.has(key));
}

const FILE_FIELDS = `
  __typename
  ... on MediaImage {
    id
    alt
    mimeType
    status
    fileStatus
    fileErrors { code message details }
    image { url altText width height }
    preview { status image { url altText width height } }
  }
  ... on GenericFile {
    id
    alt
    url
    mimeType
    fileStatus
    fileErrors { code message details }
    preview { status image { url altText width height } }
  }
  ... on Video {
    id
    alt
    filename
    fileStatus
    fileErrors { code message details }
    status
    preview { status image { url altText width height } }
    originalSource { url mimeType width height }
    sources { url mimeType width height }
  }
`;

async function resolveByNodes(admin, ids) {
  const nodeIds = ids.filter((id) => /^gid:\/\/shopify\/[A-Za-z0-9_]+\/\d+/.test(id));
  if (!nodeIds.length) return { errors: [], files: [] };
  const response = await admin.graphql(
    `#graphql
      query VsnResolveEditorFiles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ${FILE_FIELDS}
        }
      }`,
    { variables: { ids: nodeIds } },
  );
  const result = await response.json();
  return {
    errors: result?.errors || [],
    files: (result?.data?.nodes || []).map(normalizeFile).filter(Boolean),
  };
}

function mediaQueryFromTypes(mediaTypes = []) {
  const types = Array.isArray(mediaTypes) ? mediaTypes : [];
  if (types.length !== 1) return "";
  if (types[0] === "MediaImage") return "media_type:IMAGE";
  if (types[0] === "Video") return "media_type:VIDEO";
  if (types[0] === "GenericFile") return "media_type:GENERIC_FILE";
  if (types[0] === "Model3d") return "media_type:MODEL3D";
  return "";
}

async function getFilesPage(admin, { first = 100, after = null, query = "" } = {}) {
  const response = await admin.graphql(
    `#graphql
      query VsnEditorFilesPage($first: Int!, $after: String, $query: String) {
        files(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            ${FILE_FIELDS}
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
    { variables: { first, after, query: query || null } },
  );
  const result = await response.json();
  return {
    errors: result?.errors || [],
    files: (result?.data?.files?.nodes || []).map(normalizeFile).filter(Boolean),
    pageInfo: result?.data?.files?.pageInfo || { hasNextPage: false, endCursor: null },
  };
}

async function resolveByFilesQuery(admin, requestedIds) {
  const numericIds = [...new Set(requestedIds.map(numericIdentity).filter(Boolean))];
  if (!numericIds.length) return { errors: [], files: [] };
  const query = numericIds.map((id) => `id:${id}`).join(" OR ");
  const response = await admin.graphql(
    `#graphql
      query VsnResolveFilesById($first: Int!, $query: String!) {
        files(first: $first, query: $query, sortKey: ID) {
          nodes { ${FILE_FIELDS} }
        }
      }`,
    { variables: { first: Math.min(100, Math.max(1, numericIds.length * 2)), query } },
  );
  const result = await response.json();
  return {
    errors: result?.errors || [],
    files: (result?.data?.files?.nodes || []).map(normalizeFile).filter(Boolean),
  };
}

async function scanFilesForIds(admin, requestedIds, { mediaTypes = [], maxPages = 25 } = {}) {
  const unresolved = new Set(requestedIds);
  const found = new Map();
  const errors = [];
  let after = null;
  const query = mediaQueryFromTypes(mediaTypes);

  for (let page = 0; page < maxPages && unresolved.size; page += 1) {
    const result = await getFilesPage(admin, { first: 100, after, query });
    errors.push(...result.errors);
    for (const file of result.files) {
      for (const requestedId of [...unresolved]) {
        if (fileMatchesRequestedId(file, requestedId)) {
          found.set(requestedId, file);
          unresolved.delete(requestedId);
        }
      }
    }
    if (!result.pageInfo?.hasNextPage || !result.pageInfo?.endCursor) break;
    after = result.pageInfo.endCursor;
  }

  return { found, unresolvedIds: [...unresolved], errors };
}

async function getSvgFiles(admin, { maxPages = 30 } = {}) {
  const files = [];
  const errors = [];
  let after = null;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await getFilesPage(admin, { first: 100, after, query: "media_type:GENERIC_FILE" });
    errors.push(...result.errors);
    files.push(...result.files.filter((file) =>
      file?.mediaType === "GenericFile" &&
      (file?.mimeType === "image/svg+xml" || /\.svg(?:\?|$)/i.test(file?.url || "") || /\.svg$/i.test(file?.fileName || "")),
    ));
    if (!result.pageInfo?.hasNextPage || !result.pageInfo?.endCursor) break;
    after = result.pageInfo.endCursor;
  }

  const unique = new Map(files.map((file) => [file.id || file.url, file]));
  return { files: [...unique.values()], errors };
}

function sessionScopes(session) {
  return new Set(String(session?.scope || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function hasFilesReadCapability(session) {
  const scopes = sessionScopes(session);
  return ["read_files", "read_themes", "read_images"].some((scope) => scopes.has(scope));
}

function filesPermissionHint(session) {
  const scopes=[...sessionScopes(session)];
  return {
    currentScopes: scopes,
    acceptableScopes: ["read_files", "read_themes", "read_images"],
    hasFilesReadCapability: hasFilesReadCapability(session),
  };
}

function usableFile(item) {
  return Boolean(item?.id && (item?.url || item?.previewUrl));
}

function mediaProcessing(item) {
  const status = String(item?.status || "").toUpperCase();
  return !usableFile(item) || ["UPLOADED", "PROCESSING", "PENDING"].includes(status);
}

function permissionError(errors = []) {
  const message = errors.map((item) => item?.message).filter(Boolean).join(" ");
  if (/access|scope|permission|denied/i.test(message)) {
    return "Shopify Files access is unavailable for this session. Refresh the embedded app; if it persists, re-run shopify app dev and approve Files/theme read access.";
  }
  return message;
}

function mapResolvedFiles(requestedIds, candidates = []) {
  const ordered = [];
  for (const requestedId of requestedIds) {
    const file = candidates.find((candidate) => fileMatchesRequestedId(candidate, requestedId));
    if (file && usableFile(file)) ordered.push({ ...file, requestedId });
  }
  return ordered;
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "";

  if (mode !== "svg-library") {
    return json({ ok: true, files: [] });
  }
  if (!hasFilesReadCapability(session)) {
    return json({ ok: false, permissionError: true, ...filesPermissionHint(session), error: "This Shopify session cannot read Files. The app needs read_files, read_themes, or read_images. Re-run shopify app dev and approve the updated permissions, then refresh the embedded app." }, 403);
  }

  try {
    const result = await getSvgFiles(admin);
    if (result.errors.length && !result.files.length) {
      return json({ ok: false, error: permissionError(result.errors) || "Could not load Shopify SVG files." }, 400);
    }
    return json({ ok: true, files: result.files, count: result.files.length });
  } catch (error) {
    console.error("VSN SVG library error:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Could not load SVG files." }, 500);
  }
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid media request." }, 400);
  }

  const ids = normalizeIds(payload?.ids);
  const mediaTypes = Array.isArray(payload?.mediaTypes) ? payload.mediaTypes : [];
  if (!ids.length) return json({ ok: false, error: "Shopify returned no usable file identifiers.", requestedIds: [] }, 400);
  if (ids.length > 50) return json({ ok: false, error: "You can resolve up to 50 files at once." }, 400);
  if (!hasFilesReadCapability(session)) {
    return json({ ok: false, permissionError: true, ...filesPermissionHint(session), error: "This Shopify session cannot read Files. The app needs read_files, read_themes, or read_images. Re-run shopify app dev and approve the updated permissions, then refresh the embedded app." }, 403);
  }

  try {
    const allErrors = [];
    let candidates = [];

    // First use Shopify's canonical Node lookup for concrete GraphQL GIDs.
    const primary = await resolveByNodes(admin, ids);
    allErrors.push(...primary.errors);
    candidates.push(...primary.files);

    // The Intents API returns Shopify File IDs. Resolve their stable numeric IDs
    // directly through files(query: "id:...") so old files are not missed by
    // a recent-files pagination scan and mismatched GID prefixes are tolerated.
    const directFiles = await resolveByFilesQuery(admin, ids);
    allErrors.push(...directFiles.errors);
    candidates.push(...directFiles.files);

    let ordered = mapResolvedFiles(ids, candidates);
    let unresolvedIds = ids.filter((id) => !ordered.some((item) => item.requestedId === id));

    // Intents may return identifiers whose resource prefix doesn't match the concrete
    // File node type. Fall back to paginated Files lookup and match by the stable
    // numeric file identity as well as by exact GID.
    if (unresolvedIds.length || ordered.some(mediaProcessing)) {
      const scan = await scanFilesForIds(admin, unresolvedIds.length ? unresolvedIds : ids, { mediaTypes });
      allErrors.push(...scan.errors);
      candidates = [...candidates, ...scan.found.values()];
      ordered = mapResolvedFiles(ids, candidates);
      unresolvedIds = ids.filter((id) => !ordered.some((item) => item.requestedId === id));
    }

    const accessMessage = permissionError(allErrors);
    if (accessMessage && !ordered.length) {
      return json({ ok: false, permissionError: true, error: accessMessage, requestedIds: ids }, 403);
    }

    const unresolvedDetails = unresolvedIds.map((requestedId) => {
      const candidate = candidates.find((item) => fileMatchesRequestedId(item, requestedId));
      return {
        requestedId,
        fileId: candidate?.id || null,
        status: candidate?.status || "NOT_RETURNED",
        errors: Array.isArray(candidate?.errors) ? candidate.errors : [],
        hasUrl: Boolean(candidate?.url || candidate?.previewUrl),
      };
    });
    const statusSummary=[...new Set(unresolvedDetails.map((item)=>item.status).filter(Boolean))].join(", ");
    const processingErrors=[...new Set(unresolvedDetails.flatMap((item)=>item.errors||[]).filter(Boolean))].slice(0,3);
    const unresolvedMessage=unresolvedIds.length
      ? unresolvedDetails.some((item)=>item.fileId)
        ? `Shopify found the selected file${unresolvedIds.length===1?"":"s"}, but no usable URL is available yet. Status: ${statusSummary||"processing"}.${processingErrors.length?` Shopify reported: ${processingErrors.join("; ")}.`:""} Wait until the file status is Ready, then try again.`
        : `Shopify returned ${unresolvedIds.length} selected file ID${unresolvedIds.length===1?"":"s"}, but the Files API could not find those IDs. The file may have been removed, or the current Shopify session may not have access to that resource. Check System Health → Shopify & Permissions.`
      : "";

    return json({
      ok: unresolvedIds.length === 0,
      files: ordered,
      resolvedCount: ordered.length,
      requestedCount: ids.length,
      unresolvedIds,
      unresolvedDetails,
      retryable: unresolvedIds.length > 0 && unresolvedDetails.some((item)=>item.fileId && String(item.status).toUpperCase()!=="FAILED"),
      permission: filesPermissionHint(session),
      selectedIdTypes: ids.map((id) => ({ id, type: String(id).match(/^gid:\/\/shopify\/([^/]+)\//)?.[1] || "numeric/unknown" })),
      error: unresolvedMessage,
    }, 200);
  } catch (error) {
    console.error("VSN editor media resolve error:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Could not read Shopify files." }, 500);
  }
}

