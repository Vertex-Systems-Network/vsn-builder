import db from "../db.server.js";

export const APP_SETTINGS_DEFAULTS = Object.freeze({
  visitorAnalytics: true,
});

export function normalizeAppSettings(value = {}) {
  let source = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { source = {}; }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) source = {};
  return {
    visitorAnalytics: source.visitorAnalytics !== false,
  };
}

export async function loadAppSettings(shop) {
  const row = await db.builderShopSetting.findUnique({ where: { shop }, select: { appSettingsJson: true } }).catch(() => null);
  return normalizeAppSettings(row?.appSettingsJson || {});
}

export async function saveAppSettings(shop, value = {}) {
  const next = normalizeAppSettings(value);
  await db.builderShopSetting.upsert({
    where: { shop },
    create: { shop, appSettingsJson: JSON.stringify(next) },
    update: { appSettingsJson: JSON.stringify(next) },
  });
  return next;
}
