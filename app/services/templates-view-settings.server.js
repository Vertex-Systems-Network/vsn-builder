const DEFAULT_COLUMNS = ["select", "image", "name", "status", "template", "views", "updated", "created", "pages", "seo", "author"];
const DEFAULT_WIDGETS = ["total", "published", "draft", "scheduled", "views"];
const VALID_COLUMNS = new Set(DEFAULT_COLUMNS);
const VALID_WIDGETS = new Set(DEFAULT_WIDGETS);

export function defaultTemplatesViewSettings() {
  return { version: 1, columns: [...DEFAULT_COLUMNS], widgets: [...DEFAULT_WIDGETS], pageSize: 12, viewMode: "list" };
}

export function normalizeTemplatesViewSettings(value) {
  const fallback = defaultTemplatesViewSettings();
  const source = value && typeof value === "object" ? value : {};
  const columns = Array.isArray(source.columns) ? [...new Set(source.columns.map(String).filter((key) => VALID_COLUMNS.has(key)))] : fallback.columns;
  const widgets = Array.isArray(source.widgets) ? [...new Set(source.widgets.map(String).filter((key) => VALID_WIDGETS.has(key)))] : fallback.widgets;
  const pageSizeRaw = Math.floor(Number(source.pageSize || fallback.pageSize));
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(100, pageSizeRaw)) : fallback.pageSize;
  const viewMode = ["list", "grid"].includes(String(source.viewMode || "")) ? String(source.viewMode) : fallback.viewMode;
  return { version: 1, columns: columns.length ? columns : fallback.columns, widgets, pageSize, viewMode };
}

export async function loadTemplatesViewSettings(db, shop) {
  const row = await db.builderShopSetting.findUnique({ where: { shop }, select: { templatesViewJson: true } }).catch(() => null);
  if (!row?.templatesViewJson) return defaultTemplatesViewSettings();
  try { return normalizeTemplatesViewSettings(JSON.parse(row.templatesViewJson)); }
  catch { return defaultTemplatesViewSettings(); }
}

export async function saveTemplatesViewSettings(db, shop, input) {
  const value = normalizeTemplatesViewSettings(input);
  await db.builderShopSetting.upsert({
    where: { shop },
    create: { shop, templatesViewJson: JSON.stringify(value) },
    update: { templatesViewJson: JSON.stringify(value) },
  });
  return value;
}
