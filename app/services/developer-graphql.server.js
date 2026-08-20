const SCHEMA_CACHE = new Map();
const SCHEMA_TTL_MS = 5 * 60 * 1000;

function stripGraphqlLiterals(source = "") {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < source.length) {
    const ch = source[i];
    const next3 = source.slice(i, i + 3);
    if (state === "code") {
      if (next3 === '"""') { state = "block"; out += "   "; i += 3; continue; }
      if (ch === '"') { state = "string"; out += " "; i += 1; continue; }
      if (ch === '#') { state = "comment"; out += " "; i += 1; continue; }
      out += ch; i += 1; continue;
    }
    if (state === "string") {
      if (ch === "\\") { out += "  "; i += 2; continue; }
      if (ch === '"') state = "code";
      out += " "; i += 1; continue;
    }
    if (state === "block") {
      if (next3 === '"""') { state = "code"; out += "   "; i += 3; continue; }
      out += ch === "\n" ? "\n" : " "; i += 1; continue;
    }
    if (state === "comment") {
      if (ch === "\n") { state = "code"; out += "\n"; } else out += " ";
      i += 1;
    }
  }
  return out;
}

export function describeGraphqlOperation(query = "") {
  const cleaned = stripGraphqlLiterals(String(query || "")).trim();
  if (!cleaned) return { type: "query", name: null, shorthand: true, destructive: false };
  if (cleaned.startsWith("{")) return { type: "query", name: null, shorthand: true, destructive: false };
  const match = cleaned.match(/^(query|mutation|subscription)\b\s*([_A-Za-z][_0-9A-Za-z]*)?/i);
  const type = String(match?.[1] || "query").toLowerCase();
  const name = match?.[2] || null;
  const destructive = type === "mutation" && /\b(delete|remove|revoke|cancel|destroy|archive|uninstall|reset|erase|purge)\w*\b/i.test(cleaned);
  return { type, name, shorthand: false, destructive };
}

export function parseGraphqlVariables(value = "{}") {
  if (value == null || String(value).trim() === "") return {};
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("GraphQL variables must be a JSON object.");
  return parsed;
}

function serializeSaved(row) {
  return { ...row, variables: (() => { try { return JSON.parse(row.variablesJson || "{}"); } catch { return {}; } })() };
}

function serializeHistory(row) {
  return {
    ...row,
    throttle: (() => { try { return JSON.parse(row.throttleJson || "null"); } catch { return null; } })(),
    errors: (() => { try { return JSON.parse(row.errorsJson || "[]"); } catch { return []; } })(),
  };
}

export async function loadDeveloperGraphqlStudio(db, admin, shop) {
  const [saved, history, schema] = await Promise.all([
    db.builderGraphqlSavedQuery.findMany({ where: { shop, deletedAt: null }, orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }], take: 100 }).catch(() => []),
    db.builderGraphqlHistory.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []),
    loadGraphqlSchema(admin, shop).catch((error) => ({ scopes: [], queryFields: [], mutationFields: [], error: error instanceof Error ? error.message : "Schema inspection failed." })),
  ]);
  return { saved: saved.map(serializeSaved), history: history.map(serializeHistory), schema };
}

export async function loadGraphqlSchema(admin, shop) {
  const cached = SCHEMA_CACHE.get(shop);
  if (cached && Date.now() - cached.at < SCHEMA_TTL_MS) return cached.value;
  const response = await admin.graphql(`#graphql
    query VsnDeveloperStudioSchema {
      currentAppInstallation { accessScopes { handle } }
      __schema {
        queryType { fields { name description isDeprecated deprecationReason args { name description type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } } }
        mutationType { fields { name description isDeprecated deprecationReason args { name description type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } } }
      }
    }
  `);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((row) => row.message).join("; "));
  const value = {
    scopes: (payload.data?.currentAppInstallation?.accessScopes || []).map((row) => row.handle).filter(Boolean).sort(),
    queryFields: payload.data?.__schema?.queryType?.fields || [],
    mutationFields: payload.data?.__schema?.mutationType?.fields || [],
    fetchedAt: new Date().toISOString(),
  };
  SCHEMA_CACHE.set(shop, { at: Date.now(), value });
  return value;
}

export async function executeDeveloperGraphql({ db, admin, shop, actor, query, variablesJson = "{}", mutationConfirmation = "", destructiveConfirmation = "" }) {
  const source = String(query || "").trim();
  if (!source) throw new Error("Enter a GraphQL query before running it.");
  if (source.length > 120000) throw new Error("GraphQL Studio limits a query document to 120 KB.");
  const operation = describeGraphqlOperation(source);
  if (operation.type === "subscription") throw new Error("GraphQL subscriptions are not supported by Shopify Admin API Studio.");
  if (operation.type === "mutation" && String(mutationConfirmation || "").trim() !== "MUTATE") throw new Error("Mutations are disabled by default. Type MUTATE in the confirmation dialog to run this mutation.");
  if (operation.destructive && String(destructiveConfirmation || "").trim() !== "DELETE") throw new Error("This looks destructive. Type DELETE in the destructive-action confirmation dialog.");
  const variables = parseGraphqlVariables(variablesJson);
  const started = Date.now();
  let payload = null;
  let success = false;
  let responseStatus = 200;
  try {
    const response = await admin.graphql(source, { variables });
    responseStatus = Number(response.status || 200);
    payload = await response.json();
    success = responseStatus < 400 && !payload.errors?.length;
  } catch (error) {
    payload = { errors: [{ message: error instanceof Error ? error.message : "Shopify Admin GraphQL request failed." }] };
  }
  const durationMs = Math.max(0, Date.now() - started);
  const cost = payload?.extensions?.cost || {};
  const throttle = cost.throttleStatus || null;
  const errors = payload?.errors || [];
  await db.builderGraphqlHistory.create({ data: {
    shop, actor: actor || null, operationType: operation.type, operationName: operation.name, query: source,
    success, durationMs, requestedCost: Number.isFinite(Number(cost.requestedQueryCost)) ? Number(cost.requestedQueryCost) : null,
    actualCost: Number.isFinite(Number(cost.actualQueryCost)) ? Number(cost.actualQueryCost) : null,
    throttleJson: throttle ? JSON.stringify(throttle) : null,
    errorsJson: errors.length ? JSON.stringify(errors.slice(0, 20)) : null,
  } }).catch(() => null);
  const stale = await db.builderGraphqlHistory.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, skip: 100, select: { id: true } }).catch(() => []);
  if (stale.length) await db.builderGraphqlHistory.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } }).catch(() => null);
  return { ok: success, payload, durationMs, responseStatus, operation, cost: { requested: cost.requestedQueryCost ?? null, actual: cost.actualQueryCost ?? null, throttle } };
}

export async function saveDeveloperQuery(db, shop, input = {}) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim().slice(0, 120);
  const query = String(input.query || "").trim();
  if (!name) throw new Error("Saved query name is required.");
  if (!query) throw new Error("Saved query cannot be empty.");
  const variables = parseGraphqlVariables(input.variablesJson || "{}");
  const operation = describeGraphqlOperation(query);
  const data = { name, query, variablesJson: JSON.stringify(variables, null, 2), operationType: operation.type, deletedAt: null };
  if (id) {
    const existing = await db.builderGraphqlSavedQuery.findFirst({ where: { id, shop } });
    if (!existing) throw new Error("Saved query not found for this store.");
    return serializeSaved(await db.builderGraphqlSavedQuery.update({ where: { id }, data }));
  }
  return serializeSaved(await db.builderGraphqlSavedQuery.create({ data: { shop, ...data } }));
}

export async function mutateDeveloperQuery(db, shop, id, intent) {
  const row = await db.builderGraphqlSavedQuery.findFirst({ where: { id, shop } });
  if (!row) throw new Error("Saved query not found.");
  if (intent === "favorite") return serializeSaved(await db.builderGraphqlSavedQuery.update({ where: { id }, data: { isFavorite: !row.isFavorite } }));
  if (intent === "trash") return serializeSaved(await db.builderGraphqlSavedQuery.update({ where: { id }, data: { deletedAt: new Date() } }));
  if (intent === "hard-delete") { await db.builderGraphqlSavedQuery.delete({ where: { id } }); return { id, deleted: true }; }
  throw new Error("Unsupported saved-query action.");
}
