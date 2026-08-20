import { FALLBACK_GOOGLE_FONTS, SYSTEM_FONTS } from "../data/font-catalog.js";

let googleCache = { at: 0, fonts: FALLBACK_GOOGLE_FONTS };
const GOOGLE_CACHE_TTL = 6 * 60 * 60 * 1000;

function googleVariantMetadata(item = {}) {
  const keys = Object.keys(item?.fonts || {});
  const weights = [...new Set(keys
    .map((key) => Number.parseInt(String(key).replace(/(?:i|italic)$/i, ""), 10))
    .filter((weight) => Number.isFinite(weight) && weight >= 100 && weight <= 900))]
    .sort((a, b) => a - b);
  const styles = [];
  if (keys.some((key) => !/(?:i|italic)$/i.test(String(key)))) styles.push("normal");
  if (keys.some((key) => /(?:i|italic)$/i.test(String(key)))) styles.push("italic");
  return {
    ...(weights.length ? { weights } : {}),
    ...(styles.length ? { styles } : {}),
  };
}

export async function getGoogleFontCatalog() {
  if (googleCache.fonts?.length && Date.now() - googleCache.at < GOOGLE_CACHE_TTL) return googleCache.fonts;
  try {
    const response = await fetch("https://fonts.google.com/metadata/fonts", {
      headers: { Accept: "application/json", "User-Agent": "VSN-Page-Builder/2.5" },
      signal: AbortSignal.timeout?.(6000),
    });
    if (!response.ok) throw new Error(`Google Fonts metadata returned ${response.status}`);
    let text = await response.text();
    text = text.replace(/^\)\]\}'\s*/, "");
    const payload = JSON.parse(text);
    const list = Array.isArray(payload?.familyMetadataList) ? payload.familyMetadataList : [];
    const liveByFamily = new Map();
    list.forEach((item) => {
      const family = String(item?.family || "").trim();
      if (!family) return;
      liveByFamily.set(family, {
        family,
        value: `'${family}', sans-serif`,
        provider: "Google",
        ...googleVariantMetadata(item),
      });
    });
    const popular = FALLBACK_GOOGLE_FONTS.map((item) => item.family);
    const ordered = [
      ...popular,
      ...[...liveByFamily.keys()].filter((family) => !popular.includes(family)).sort((a, b) => a.localeCompare(b)),
    ];
    const fonts = ordered.map((family) => liveByFamily.get(family)
      || FALLBACK_GOOGLE_FONTS.find((item) => item.family === family)
      || { family, value: `'${family}', sans-serif`, provider: "Google" });
    googleCache = { at: Date.now(), fonts: fonts.length ? fonts : FALLBACK_GOOGLE_FONTS };
    return googleCache.fonts;
  } catch (error) {
    console.warn("VSN Google Fonts catalog fallback:", error instanceof Error ? error.message : error);
    googleCache = { at: Date.now(), fonts: FALLBACK_GOOGLE_FONTS };
    return FALLBACK_GOOGLE_FONTS;
  }
}

export async function getCustomFontCatalog(database, shop) {
  if (!database?.builderCustomFont || !shop) return [];
  const fonts = await database.builderCustomFont.findMany({
    where: { shop, deletedAt: null },
    orderBy: [{ family: "asc" }, { weight: "asc" }, { style: "asc" }],
    select: { id: true, family: true, weight: true, style: true, mimeType: true, fileName: true, createdAt: true },
  });
  return fonts.map((font) => ({
    ...font,
    provider: "Custom",
    value: `'${font.family}', sans-serif`,
    editorUrl: `/app/fonts/${font.id}`,
    storefrontUrl: `/apps/vsn-builder/font/${font.id}`,
  }));
}

export async function getFontCatalog(database, shop) {
  const [custom, google] = await Promise.all([
    getCustomFontCatalog(database, shop),
    getGoogleFontCatalog(),
  ]);
  return { custom, google, system: SYSTEM_FONTS };
}
