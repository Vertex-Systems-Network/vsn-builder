import { DASHBOARD_WIDGET_IDS, DEFAULT_DASHBOARD_VISIBLE_WIDGETS, DEFAULT_DASHBOARD_WIDGET_ORDER } from "../config/dashboard-widgets.js";

const VALID_IDS = new Set(DASHBOARD_WIDGET_IDS);

function uniqueKnownIds(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map(String).filter((id) => VALID_IDS.has(id)))];
}

export function defaultDashboardPreferences() {
  return {
    version: 2,
    order: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
    visible: [...DEFAULT_DASHBOARD_VISIBLE_WIDGETS],
  };
}

export function normalizeDashboardPreferences(value) {
  const fallback = defaultDashboardPreferences();
  const source = value && typeof value === "object" ? value : {};
  const providedOrder = uniqueKnownIds(source.order);
  const order = [...providedOrder, ...DASHBOARD_WIDGET_IDS.filter((id) => !providedOrder.includes(id))];
  const providedVisible = source.visible == null ? fallback.visible : uniqueKnownIds(source.visible);
  return { version: 2, order, visible: providedVisible };
}

export async function loadDashboardPreferences(db, shop) {
  const row = await db.builderShopSetting.findUnique({ where: { shop }, select: { dashboardJson: true } }).catch(() => null);
  if (!row?.dashboardJson) return defaultDashboardPreferences();
  try { return normalizeDashboardPreferences(JSON.parse(row.dashboardJson)); }
  catch { return defaultDashboardPreferences(); }
}

export async function saveDashboardPreferences(db, shop, value) {
  const preferences = normalizeDashboardPreferences(value);
  await db.builderShopSetting.upsert({
    where: { shop },
    create: { shop, dashboardJson: JSON.stringify(preferences) },
    update: { dashboardJson: JSON.stringify(preferences) },
  });
  return preferences;
}
