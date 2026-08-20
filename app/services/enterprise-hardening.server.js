import db from "../db.server.js";

export const ENTERPRISE_DEFAULTS = Object.freeze({
  safeMode: false,
  assetMode: "used-only",
  criticalCss: true,
  cssDeduplication: true,
  lazyImages: true,
  responsiveImages: true,
  imageFormatDiagnostics: true,
  fontSubset: true,
  fontPreload: "auto",
  backupRetentionDays: 30,
  backupRetentionCount: 20,
  environment: "development",
  promotionTarget: "staging",
  storeFeatureFlags: {},
});

export function parseEnterpriseSettings(value) {
  let parsed = {};
  if (value && typeof value === "object" && !Array.isArray(value)) parsed = value;
  else try { parsed = JSON.parse(String(value || "{}")); } catch {}
  const raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const allowedEnvironment = ["development", "staging", "production"].includes(raw.environment) ? raw.environment : ENTERPRISE_DEFAULTS.environment;
  const allowedTarget = ["development", "staging", "production"].includes(raw.promotionTarget) ? raw.promotionTarget : ENTERPRISE_DEFAULTS.promotionTarget;
  const fontPreload = ["off", "auto", "aggressive"].includes(raw.fontPreload) ? raw.fontPreload : "auto";
  const assetMode = ["used-only", "compatibility"].includes(raw.assetMode) ? raw.assetMode : "used-only";
  return {
    ...ENTERPRISE_DEFAULTS,
    ...raw,
    safeMode: raw.safeMode === true,
    criticalCss: raw.criticalCss !== false,
    cssDeduplication: raw.cssDeduplication !== false,
    lazyImages: raw.lazyImages !== false,
    responsiveImages: raw.responsiveImages !== false,
    imageFormatDiagnostics: raw.imageFormatDiagnostics !== false,
    fontSubset: raw.fontSubset !== false,
    fontPreload,
    assetMode,
    backupRetentionDays: Math.max(1, Math.min(3650, Number(raw.backupRetentionDays || ENTERPRISE_DEFAULTS.backupRetentionDays))),
    backupRetentionCount: Math.max(1, Math.min(500, Number(raw.backupRetentionCount || ENTERPRISE_DEFAULTS.backupRetentionCount))),
    environment: allowedEnvironment,
    promotionTarget: allowedTarget,
    storeFeatureFlags: raw.storeFeatureFlags && typeof raw.storeFeatureFlags === "object" && !Array.isArray(raw.storeFeatureFlags) ? raw.storeFeatureFlags : {},
  };
}

export async function getEnterpriseSettings(shop) {
  const setting = await db.builderShopSetting.findUnique({ where: { shop }, select: { enterpriseJson: true } }).catch(() => null);
  return parseEnterpriseSettings(setting?.enterpriseJson);
}

export async function saveEnterpriseSettings(shop, input = {}) {
  const next = parseEnterpriseSettings(input);
  await db.builderShopSetting.upsert({ where: { shop }, create: { shop, enterpriseJson: JSON.stringify(next) }, update: { enterpriseJson: JSON.stringify(next) } });
  return next;
}

export function sanitizedEnterpriseSettings(settings = {}) {
  const next = parseEnterpriseSettings(settings);
  return { ...next, storeFeatureFlags: { ...next.storeFeatureFlags } };
}
