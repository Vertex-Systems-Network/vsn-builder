import { applyLocalizationOverrides, localeDirection, mergeLocalizationOverrides, normalizeLocale, normalizeLocaleCatalog, normalizeMarketCatalog, sanitizeLocalizationOverrides, translationCompletion } from "../builder/localizationEngine.js";
import { runLocalizationHooks } from "./localization-hooks.server.js";

function safeJson(value, fallback) { try { return JSON.parse(String(value ?? "")); } catch { return fallback; } }
function marketKeyOf(value = "*") { const raw = String(value || "*").trim(); return raw || "*"; }

export async function loadShopifyLocalizationCatalog(admin) {
  const output = { locales: [], markets: [], errors: [] };
  try {
    const response = await admin.graphql(`#graphql\nquery VsnShopLocales { shopLocales { locale name primary published } }`);
    const json = await response.json();
    if (json.errors?.length) output.errors.push("Shopify locales require read_locales or read_markets_home scope.");
    else output.locales = normalizeLocaleCatalog(json.data?.shopLocales || []);
  } catch { output.errors.push("Shopify locale catalog could not be loaded."); }
  try {
    const response = await admin.graphql(`#graphql\nquery VsnMarkets { markets(first: 100) { nodes { id name handle status } } }`);
    const json = await response.json();
    if (json.errors?.length) output.errors.push("Shopify Markets require read_markets scope.");
    else output.markets = normalizeMarketCatalog(json.data?.markets?.nodes || []);
  } catch { output.errors.push("Shopify Markets catalog could not be loaded."); }
  const hooked = await runLocalizationHooks("catalog:afterLoad", output);
  return { ...(hooked.payload || output), hookWarnings: hooked.warnings };
}

export async function ensureLocalizationConfig(db, { shop, admin = null } = {}) {
  let existing = await db.builderLocalizationConfig.findUnique({ where: { shop } }).catch(() => null);
  let catalog = { locales: [], markets: [], errors: [] };
  if (admin) catalog = await loadShopifyLocalizationCatalog(admin);
  const existingLocales = normalizeLocaleCatalog(safeJson(existing?.localesJson, []), existing?.baseLocale || "en");
  const mergedLocales = catalog.locales.length ? catalog.locales : existingLocales;
  const baseLocale = normalizeLocale(mergedLocales.find((item) => item.primary)?.locale || existing?.baseLocale || "en") || "en";
  const mergedMarkets = catalog.markets.length ? catalog.markets : normalizeMarketCatalog(safeJson(existing?.marketsJson, []));
  const rtlLocales = mergedLocales.filter((item) => item.direction === "rtl").map((item) => item.locale);
  const data = { baseLocale, localesJson: JSON.stringify(mergedLocales), marketsJson: JSON.stringify(mergedMarkets), rtlLocalesJson: JSON.stringify(rtlLocales), ...(admin && (catalog.locales.length || catalog.markets.length) ? { lastCatalogSyncAt: new Date() } : {}) };
  existing = existing
    ? await db.builderLocalizationConfig.update({ where: { shop }, data })
    : await db.builderLocalizationConfig.create({ data: { shop, ...data } });
  return {
    id: existing.id,
    baseLocale: existing.baseLocale,
    locales: normalizeLocaleCatalog(safeJson(existing.localesJson, []), existing.baseLocale),
    markets: normalizeMarketCatalog(safeJson(existing.marketsJson, [])),
    rtlLocales: safeJson(existing.rtlLocalesJson, []),
    shopifySyncEnabled: Boolean(existing.shopifySyncEnabled),
    lastCatalogSyncAt: existing.lastCatalogSyncAt?.toISOString?.() || null,
    catalogErrors: catalog.errors,
  };
}

export function serializePageTranslation(row) {
  if (!row) return null;
  return {
    id: row.id,
    pageId: row.pageId,
    locale: row.locale,
    marketKey: row.marketKey,
    overrides: sanitizeLocalizationOverrides(safeJson(row.overridesJson, {})),
    seo: safeJson(row.seoJson, {}),
    status: row.status,
    sourceVersion: Number(row.sourceVersion || 1),
    nativeSyncedAt: row.nativeSyncedAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

export async function loadPageLocalization(db, { shop, page, admin = null } = {}) {
  const config = await ensureLocalizationConfig(db, { shop, admin });
  const translations = await db.builderPageTranslation.findMany({ where: { shop, pageId: page.id }, orderBy: [{ locale: "asc" }, { marketKey: "asc" }] }).catch(() => []);
  const rows = translations.map(serializePageTranslation).map((row) => ({ ...row, outdated: Number(row.sourceVersion || 0) < Number(page.version || 1) }));
  return { enabled: true, config, translations: rows, pageVersion: Number(page.version || 1) };
}

export async function savePageTranslation(db, { shop, page, locale, marketKey = "*", overrides = {}, seo = {}, status = "draft" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  if (!normalizedLocale && String(locale) !== "*") throw new Error("Locale is required.");
  const safeMarket = marketKeyOf(marketKey);
  const beforeHook = await runLocalizationHooks("translation:beforeSave", { shop, page, locale: normalizedLocale || "*", marketKey: safeMarket, overrides, seo, status });
  const hookPayload = beforeHook.payload || {};
  const safeOverrides = sanitizeLocalizationOverrides(hookPayload.overrides ?? overrides);
  const safeSeoInput = hookPayload.seo ?? seo;
  const safeSeo = {
    seoTitle: String(safeSeoInput?.seoTitle || "").slice(0, 255),
    seoDescription: String(safeSeoInput?.seoDescription || "").slice(0, 1000),
    ogTitle: String(safeSeoInput?.ogTitle || "").slice(0, 255),
    ogDescription: String(safeSeoInput?.ogDescription || "").slice(0, 1000),
    ogImage: String(safeSeoInput?.ogImage || "").slice(0, 4000),
    shopifyTitle: String(safeSeoInput?.shopifyTitle || "").slice(0, 255),
  };
  const safeStatus = ["draft", "translated", "reviewed"].includes(hookPayload.status) ? hookPayload.status : (["draft", "translated", "reviewed"].includes(status) ? status : "draft");
  const row = await db.builderPageTranslation.upsert({
    where: { shop_pageId_locale_marketKey: { shop, pageId: page.id, locale: normalizedLocale || "*", marketKey: safeMarket } },
    update: { overridesJson: JSON.stringify(safeOverrides), seoJson: JSON.stringify(safeSeo), status: safeStatus, sourceVersion: Number(page.version || 1), nativeSyncedAt: null },
    create: { shop, pageId: page.id, locale: normalizedLocale || "*", marketKey: safeMarket, overridesJson: JSON.stringify(safeOverrides), seoJson: JSON.stringify(safeSeo), status: safeStatus, sourceVersion: Number(page.version || 1) },
  });
  const serialized = serializePageTranslation(row);
  const afterHook = await runLocalizationHooks("translation:afterSave", { shop, page, translation: serialized, warnings: beforeHook.warnings });
  return { ...serialized, hookWarnings: [...beforeHook.warnings, ...(afterHook.warnings || [])] };
}

export async function resolveLocalizedPage(db, { shop, page, elements, locale = "", marketKey = "*" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const safeMarket = marketKeyOf(marketKey);
  if (!normalizedLocale && safeMarket === "*") return { elements, seo: {}, locale: "", marketKey: safeMarket, direction: "ltr", records: [] };
  const clauses = [];
  if (normalizedLocale) clauses.push({ locale: normalizedLocale, marketKey: "*" });
  if (safeMarket !== "*") clauses.push({ locale: "*", marketKey: safeMarket });
  if (normalizedLocale && safeMarket !== "*") clauses.push({ locale: normalizedLocale, marketKey: safeMarket });
  if (!clauses.length) return { elements, seo: {}, locale: normalizedLocale, marketKey: safeMarket, direction: localeDirection(normalizedLocale), records: [] };
  const records = await db.builderPageTranslation.findMany({ where: { shop, pageId: page.id, OR: clauses } }).catch(() => []);
  const keyed = new Map(records.map((row) => [`${row.locale}|${row.marketKey}`, row]));
  const ordered = [normalizedLocale ? keyed.get(`${normalizedLocale}|*`) : null, safeMarket !== "*" ? keyed.get(`*|${safeMarket}`) : null, normalizedLocale && safeMarket !== "*" ? keyed.get(`${normalizedLocale}|${safeMarket}`) : null].filter(Boolean);
  const merged = mergeLocalizationOverrides(...ordered.map((row) => safeJson(row.overridesJson, {})));
  const seo = Object.assign({}, ...ordered.map((row) => safeJson(row.seoJson, {})));
  return { elements: applyLocalizationOverrides(elements, merged), seo, overrides: merged, locale: normalizedLocale, marketKey: safeMarket, direction: localeDirection(normalizedLocale), records: ordered.map(serializePageTranslation) };
}

export async function listLocalizationDashboard(db, { shop } = {}) {
  const [configRow, pages, translations] = await Promise.all([
    db.builderLocalizationConfig.findUnique({ where: { shop } }).catch(() => null),
    db.builderPage.findMany({ where: { shop, deletedAt: null }, select: { id: true, title: true, template: true, status: true, version: true, contentJson: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 300 }),
    db.builderPageTranslation.findMany({ where: { shop }, orderBy: { updatedAt: "desc" }, take: 3000 }).catch(() => []),
  ]);
  const config = configRow ? {
    baseLocale: configRow.baseLocale,
    locales: normalizeLocaleCatalog(safeJson(configRow.localesJson, []), configRow.baseLocale),
    markets: normalizeMarketCatalog(safeJson(configRow.marketsJson, [])),
    shopifySyncEnabled: Boolean(configRow.shopifySyncEnabled),
  } : { baseLocale: "en", locales: normalizeLocaleCatalog([], "en"), markets: [], shopifySyncEnabled: false };
  const byPage = new Map();
  for (const row of translations) {
    if (!byPage.has(row.pageId)) byPage.set(row.pageId, []);
    byPage.get(row.pageId).push(row);
  }
  const pageRows = pages.map((page) => {
    const rows = byPage.get(page.id) || [];
    const localeRows = rows.filter((row) => row.locale !== "*");
    const expectedLocales = config.locales.filter((item) => !item.primary).length;
    const translatedLocales = new Set(localeRows.filter((row) => row.marketKey === "*" && row.status !== "draft").map((row) => row.locale)).size;
    const outdated = rows.filter((row) => Number(row.sourceVersion || 0) < Number(page.version || 1)).length;
    return { id: page.id, title: page.title, template: page.template, status: page.status, version: page.version, translatedLocales, expectedLocales, missingLocales: Math.max(0, expectedLocales - translatedLocales), outdated, updatedAt: page.updatedAt.toISOString() };
  });
  return {
    config,
    pages: pageRows,
    totals: {
      pages: pageRows.length,
      translations: translations.length,
      missing: pageRows.reduce((sum, page) => sum + page.missingLocales, 0),
      outdated: pageRows.reduce((sum, page) => sum + page.outdated, 0),
    },
  };
}

export async function syncShopifyPageTranslation({ admin, db, shop, page, translation, market = null } = {}) {
  const beforeHook = await runLocalizationHooks("nativeSync:before", { shop, page, translation, market });
  const nativePayload = beforeHook.payload || {};
  page = nativePayload.page || page;
  translation = nativePayload.translation || translation;
  market = nativePayload.market ?? market;
  if (!page?.shopifyPageId) throw new Error("Publish this Shopify page once before syncing native translations.");
  const locale = normalizeLocale(translation?.locale);
  if (!locale || locale === "*") throw new Error("A specific locale is required for Shopify translation sync.");
  const resourceId = String(page.shopifyPageId).startsWith("gid://") ? String(page.shopifyPageId) : `gid://shopify/Page/${page.shopifyPageId}`;
  const resourceResponse = await admin.graphql(`#graphql\nquery VsnTranslatablePage($id: ID!) { translatableResource(resourceId: $id) { resourceId translatableContent { key value digest locale } } }`, { variables: { id: resourceId } });
  const resourceJson = await resourceResponse.json();
  if (resourceJson.errors?.length) throw new Error(resourceJson.errors[0]?.message || "Shopify translatable content could not be loaded. Check read_translations scope.");
  const content = resourceJson.data?.translatableResource?.translatableContent || [];
  const seo = translation?.seo || {};
  const wanted = { title: seo.shopifyTitle || seo.seoTitle || "", meta_title: seo.seoTitle || "", meta_description: seo.seoDescription || "" };
  const inputs = content.flatMap((item) => {
    const value = String(wanted[item.key] || "").trim();
    if (!value || !item.digest) return [];
    return [{ locale, key: item.key, value, translatableContentDigest: item.digest, ...(market?.id ? { marketId: market.id } : {}) }];
  });
  if (!inputs.length) throw new Error("No compatible Shopify Page title/meta fields were available to sync.");
  const mutation = await admin.graphql(`#graphql\nmutation VsnRegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) { translationsRegister(resourceId: $resourceId, translations: $translations) { translations { key value locale } userErrors { field message } } }`, { variables: { resourceId, translations: inputs } });
  const json = await mutation.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || "Shopify translation sync failed.");
  const userErrors = json.data?.translationsRegister?.userErrors || [];
  if (userErrors.length) throw new Error(userErrors.map((item) => item.message).join("; "));
  await db.builderPageTranslation.updateMany({ where: { id: translation.id, shop }, data: { nativeSyncedAt: new Date() } });
  const result = { synced: json.data?.translationsRegister?.translations || [], resourceId, hookWarnings: beforeHook.warnings };
  const afterHook = await runLocalizationHooks("nativeSync:after", { shop, page, translation, market, result });
  return { ...result, hookWarnings: [...beforeHook.warnings, ...(afterHook.warnings || [])] };
}

export function translationStatsForPage(elements, translation) {
  return translationCompletion(elements, translation?.overrides || {});
}
