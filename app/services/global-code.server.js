const KINDS = new Set(["css", "js"]);
const SCOPES = new Set(["storefront", "header", "footer", "product", "collection", "search", "article", "page", "market", "locale"]);
const LOCATIONS = new Set(["head", "body-start", "body-end"]);

function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback; }
function parseJson(value, fallback = {}) { try { const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }
function normalizePath(value = "") { const raw = String(value || "").trim(); if (!raw) return "/"; try { return new URL(raw, "https://vsn.local").pathname || "/"; } catch { return raw.startsWith("/") ? raw : `/${raw}`; } }

export function inspectGlobalCode(kind, code = "") {
  const source = String(code || "");
  const warnings = [];
  if (source.length > 200000) warnings.push("Code is larger than 200 KB and can hurt storefront performance.");
  if (kind === "js") {
    if (/\beval\s*\(/.test(source) || /\bnew\s+Function\s*\(/.test(source)) warnings.push("eval/new Function can violate Content Security Policy and is difficult to audit.");
    if (/document\.write\s*\(/.test(source)) warnings.push("document.write can block rendering and replace page content.");
    if (/innerHTML\s*=/.test(source)) warnings.push("Direct innerHTML writes can introduce XSS if values are not trusted.");
    if (/https?:\/\//i.test(source)) warnings.push("External network dependencies should be reviewed for CSP, privacy and failure behavior.");
  } else {
    if (/@import\s+/i.test(source)) warnings.push("CSS @import adds a render-blocking dependency; prefer Shopify-hosted or existing assets.");
    if (/!important/g.test(source) && (source.match(/!important/g) || []).length > 10) warnings.push("Heavy !important usage can make theme overrides difficult to maintain.");
  }
  return warnings;
}

export function criticalGlobalCodeRisks(kind, code = "") {
  const source = String(code || "");
  const risks = [];
  if (kind === "js") {
    if (/\beval\s*\(/.test(source)) risks.push("eval() is blocked in Global JavaScript.");
    if (/\bnew\s+Function\s*\(/.test(source)) risks.push("new Function() is blocked in Global JavaScript.");
    if (/document\.write(?:ln)?\s*\(/.test(source)) risks.push("document.write() is blocked because it can replace or block storefront content.");
    if (/javascript\s*:/i.test(source)) risks.push("javascript: URLs are blocked in Global JavaScript.");
  } else if (/expression\s*\(|javascript\s*:|url\s*\(\s*["']?\s*data:text\/html/i.test(source)) {
    risks.push("Executable CSS constructs are blocked in Global CSS.");
  }
  return risks;
}

export function normalizeGlobalCode(input = {}) {
  const kind = KINDS.has(String(input.kind || "")) ? String(input.kind) : "css";
  const scope = SCOPES.has(String(input.scope || "")) ? String(input.scope) : "storefront";
  let location = LOCATIONS.has(String(input.location || "")) ? String(input.location) : (kind === "css" ? "head" : "body-end");
  if (kind === "css") location = "head";
  const name = String(input.name || "").trim().slice(0, 120);
  const code = String(input.code || "");
  if (!name) throw new Error("Code snippet name is required.");
  if (!code.trim()) throw new Error("Code snippet cannot be empty.");
  if (code.length > 300000) throw new Error("A single Global Code snippet cannot exceed 300 KB.");
  const critical = criticalGlobalCodeRisks(kind, code);
  if (critical.length) throw new Error(critical.join(" "));
  const target = String(input.target || "").trim().slice(0, 500) || null;
  if (["page", "market", "locale"].includes(scope) && !target) throw new Error(`A target is required for ${scope} scope.`);
  return { name, kind, scope, target, location, priority: clamp(input.priority, 0, 9999, 100), enabled: input.enabled !== false && String(input.enabled) !== "false", code, conditionsJson: JSON.stringify(parseJson(input.conditionsJson || input.conditions || {}, {})) };
}

function serialize(row) { return { ...row, conditions: parseJson(row.conditionsJson, {}), warnings: inspectGlobalCode(row.kind, row.code) }; }
function snapshot(row) { return { name: row.name, kind: row.kind, scope: row.scope, target: row.target, location: row.location, priority: row.priority, enabled: row.enabled, code: row.code, conditionsJson: row.conditionsJson || "{}" }; }

export async function loadGlobalCodeStudio(db, shop) {
  const [active, trash] = await Promise.all([
    db.builderGlobalCode.findMany({ where: { shop, deletedAt: null }, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }] }).catch(() => []),
    db.builderGlobalCode.findMany({ where: { shop, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 50 }).catch(() => []),
  ]);
  const ids = active.map((row) => row.id);
  const revisions = ids.length ? await db.builderGlobalCodeRevision.findMany({ where: { shop, globalCodeId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []) : [];
  return { entries: active.map(serialize), trash: trash.map(serialize), revisions };
}

async function createRevision(db, shop, row) {
  if (!row) return null;
  return db.builderGlobalCodeRevision.create({ data: { shop, globalCodeId: row.id, ...snapshot(row) } });
}

export async function saveGlobalCode(db, shop, input = {}) {
  const id = String(input.id || "").trim();
  const data = normalizeGlobalCode(input);
  if (id) {
    const existing = await db.builderGlobalCode.findFirst({ where: { id, shop } });
    if (!existing) throw new Error("Global Code snippet not found for this store.");
    await createRevision(db, shop, existing);
    const updated = await db.builderGlobalCode.update({ where: { id }, data: { ...data, deletedAt: null } });
    return serialize(updated);
  }
  const created = await db.builderGlobalCode.create({ data: { shop, ...data } });
  await createRevision(db, shop, created);
  return serialize(created);
}

export async function mutateGlobalCode(db, shop, { id, intent, revisionId = null }) {
  const row = await db.builderGlobalCode.findFirst({ where: { id, shop } });
  if (!row) throw new Error("Global Code snippet not found.");
  if (intent === "toggle") { await createRevision(db, shop, row); return serialize(await db.builderGlobalCode.update({ where: { id }, data: { enabled: !row.enabled } })); }
  if (intent === "trash") { await createRevision(db, shop, row); return serialize(await db.builderGlobalCode.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } })); }
  if (intent === "restore") return serialize(await db.builderGlobalCode.update({ where: { id }, data: { deletedAt: null } }));
  if (intent === "duplicate") return saveGlobalCode(db, shop, { ...snapshot(row), name: `${row.name} Copy`, enabled: false });
  if (intent === "hard-delete") {
    await db.$transaction([db.builderGlobalCodeRevision.deleteMany({ where: { shop, globalCodeId: id } }), db.builderGlobalCode.delete({ where: { id } })]);
    return { id, deleted: true };
  }
  if (intent === "rollback") {
    const revision = await db.builderGlobalCodeRevision.findFirst({ where: { id: String(revisionId || ""), shop, globalCodeId: id } });
    if (!revision) throw new Error("Global Code revision not found.");
    await createRevision(db, shop, row);
    const updated = await db.builderGlobalCode.update({ where: { id }, data: { ...snapshot(revision), deletedAt: null } });
    return serialize(updated);
  }
  throw new Error("Unsupported Global Code action.");
}

export function globalCodeMatches(row, context = {}) {
  if (!row?.enabled || row.deletedAt) return false;
  const scope = row.scope || "storefront";
  const template = String(context.template || context.pageType || "").toLowerCase();
  const target = String(row.target || "").trim().toLowerCase();
  if (scope === "storefront" || scope === "header" || scope === "footer") return true;
  if (["product", "collection", "search", "article"].includes(scope)) return template === scope;
  if (scope === "page") return normalizePath(context.path || context.visitorPath || "/").toLowerCase() === normalizePath(target).toLowerCase();
  if (scope === "market") return String(context.market || context.country || "").trim().toLowerCase() === target;
  if (scope === "locale") return String(context.locale || context.language || "").trim().toLowerCase() === target;
  return false;
}

export async function resolveGlobalCodeBundle(db, shop, kind, context = {}) {
  if (!KINDS.has(kind)) return [];
  const rows = await db.builderGlobalCode.findMany({ where: { shop, kind, enabled: true, deletedAt: null }, orderBy: [{ priority: "asc" }, { updatedAt: "asc" }] }).catch(() => []);
  return rows.filter((row) => globalCodeMatches(row, context) && criticalGlobalCodeRisks(row.kind, row.code).length === 0);
}

function safeComment(value = "") { return String(value || "").replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ").slice(0, 160); }
export function buildGlobalCssBundle(rows = []) {
  return rows.map((row) => `/* VSN Global CSS: ${safeComment(row.name)} · ${safeComment(row.scope)} · priority ${row.priority} */\n${row.code}`).join("\n\n");
}
export function buildGlobalJsBundle(rows = []) {
  const groups = { head: [], "body-start": [], "body-end": [] };
  for (const row of rows) (groups[row.location] || groups["body-end"]).push(row);
  const renderRows = (items) => items.map((row) => `try {\n/* ${safeComment(row.name)} · ${safeComment(row.scope)} · priority ${row.priority} */\n${row.code}\n} catch (error) { console.error(${JSON.stringify(`VSN Global JS failed: ${row.name}`)}, error); }`).join("\n");
  return `/* VSN Global JavaScript bundle. Generated at request time. */\n(function(){\n${renderRows(groups.head)}\n${renderRows(groups["body-start"])}\nvar runBodyEnd=function(){\n${renderRows(groups["body-end"])}\n};\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',runBodyEnd,{once:true});else runBodyEnd();\n})();`;
}
