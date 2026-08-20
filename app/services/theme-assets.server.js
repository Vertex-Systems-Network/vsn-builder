import { createHash } from "node:crypto";
import { buildStyleBundleCss, dedupeGeneratedCss } from "../builder/stylePipeline.js";
import { GLOBAL_DESIGN_DEFAULTS } from "../builder/globalDesign.js";
import { collectCustomJsGroups, validateCustomJs } from "../builder/customCode.js";
import { FALLBACK_GOOGLE_FONTS } from "../data/font-catalog.js";
import { buildGoogleFontHref, collectFontUsages, mergeFontUsage, SYSTEM_FONT_FAMILIES } from "../utils/font-runtime.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { hasAdvancedInteractions, normalizeElementInteractions } from "../builder/interactionSchema.js";
import { normalizeDesignTokenDocument, semanticCssVariables } from "../builder/designTokens2.js";

export const VSN_THEME_MANIFEST_METAFIELD = "asset_manifest";
export const VSN_ASSET_PREFIX = "vsn-tpl-";
const APP_METAFIELD_NAMESPACE = "vsn_page_builder";
const APP_METAFIELD_KEY = "asset_pipeline_ready";
const MAX_FILES_PER_UPSERT = 45; // Shopify supports 50; leave headroom for future metadata files.

function parseJson(value, fallback) {
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

function renderable(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).filter((node) => !["global-styles", "template-settings"].includes(node?.type));
}

function templateSettings(nodes = []) {
  const record = (Array.isArray(nodes) ? nodes : []).find((node) => node?.type === "template-settings");
  return record?.props && typeof record.props === "object" ? record.props : {};
}

function globalStyles(nodes = [], designTokens = {}) {
  const record = (Array.isArray(nodes) ? nodes : []).find((node) => node?.type === "global-styles");
  const own = record?.styles || record?.props || {};
  const globals = { ...GLOBAL_DESIGN_DEFAULTS, ...own };
  const keys = ["primaryColor","secondaryColor","accentColor","textColor","backgroundColor","surfaceColor","mutedSurfaceColor","borderColor","fontFamily","headingFontFamily","buttonBackground","buttonTextColor","buttonRadius","formBackground","formTextColor","formBorderColor","formRadius","radiusSm","radiusMd","radiusLg","shadowSm","shadowMd","shadowLg","containerMaxWidth"];
  for (const key of keys) if (designTokens?.[key] !== undefined && designTokens?.[key] !== null && String(designTokens[key]).trim() !== "") globals[key] = designTokens[key];
  if (designTokens?.containerMd) globals.containerMaxWidth = designTokens.containerMd;
  if (designTokens?.spacingBase) globals.spacingBase = Math.max(1, Number(designTokens.spacingBase) || globals.spacingBase || 4);
  if (designTokens?.headingScale) globals.headingScale = Math.max(1, Math.min(2, Number(designTokens.headingScale) || globals.headingScale || 1.25));
  return globals;
}

function safeComment(value = "") {
  return String(value || "").replace(/[\r\n*\/]+/g, " ").slice(0, 160);
}

function cssQuote(value = "") {
  return JSON.stringify(String(value ?? ""));
}

function cssVariables(pageId, globals, designTokens = {}) {
  const q = cssQuote(pageId);
  const tokenDoc = normalizeDesignTokenDocument(designTokens);
  const semantic = semanticCssVariables(tokenDoc, "base");
  const base = [
    `--vsn-primary:${globals.primaryColor}`,
    `--vsn-secondary:${globals.secondaryColor}`,
    `--vsn-accent:${globals.accentColor}`,
    `--vsn-text:${globals.textColor}`,
    `--vsn-bg:${globals.backgroundColor}`,
    `--vsn-surface:${globals.surfaceColor}`,
    `--vsn-surface-muted:${globals.mutedSurfaceColor}`,
    `--vsn-border:${globals.borderColor}`,
    `--vsn-button-bg:${globals.buttonBackground}`,
    `--vsn-button-color:${globals.buttonTextColor}`,
    `--vsn-button-radius:${globals.buttonRadius}`,
    `--vsn-form-bg:${globals.formBackground}`,
    `--vsn-form-color:${globals.formTextColor}`,
    `--vsn-form-border:${globals.formBorderColor}`,
    `--vsn-form-radius:${globals.formRadius}`,
    `--vsn-container-max:${designTokens.containerMd || globals.containerMaxWidth}`,
    `--vsn-space-xs:${designTokens.spacingXs || "4px"}`,
    `--vsn-space-sm:${designTokens.spacingSm || "8px"}`,
    `--vsn-space-md:${designTokens.spacingMd || "16px"}`,
    `--vsn-space-lg:${designTokens.spacingLg || "24px"}`,
    `--vsn-space-xl:${designTokens.spacingXl || "40px"}`,
    `--vsn-radius-sm:${designTokens.radiusSm || globals.radiusSm}`,
    `--vsn-radius-md:${designTokens.radiusMd || globals.radiusMd}`,
    `--vsn-radius-lg:${designTokens.radiusLg || globals.radiusLg}`,
    `--vsn-shadow-sm:${designTokens.shadowSm || globals.shadowSm}`,
    `--vsn-shadow-md:${designTokens.shadowMd || globals.shadowMd}`,
    `--vsn-shadow-lg:${designTokens.shadowLg || globals.shadowLg}`,
    `--vsn-space-unit:${Math.max(1, Number(globals.spacingBase || 4))}px`,
    ...Object.entries(semantic).map(([key,value])=>`${key}:${value}`),
  ];
  const root = `[data-vsn-page-id=${q}]`;
  const dark = tokenDoc.modes?.dark || {};
  const darkSemantic = semanticCssVariables(tokenDoc, "dark");
  const darkCore = {
    "--vsn-primary":dark.primaryColor, "--vsn-secondary":dark.secondaryColor, "--vsn-accent":dark.accentColor,
    "--vsn-text":dark.textColor, "--vsn-bg":dark.backgroundColor, "--vsn-surface":dark.surfaceColor, "--vsn-surface-muted":dark.mutedSurfaceColor, "--vsn-border":dark.borderColor,
    "--vsn-button-bg":dark.buttonBackground, "--vsn-button-color":dark.buttonTextColor, "--vsn-form-bg":dark.formBackground, "--vsn-form-color":dark.formTextColor, "--vsn-form-border":dark.formBorderColor,
  };
  const darkEntries = [...Object.entries(darkCore).filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()!==""), ...Object.entries(darkSemantic)];
  const baseRule = `${root}{${base.join(";")};}`;
  if (!darkEntries.length || !Object.keys(dark).length) return baseRule;
  const darkRule = `${root}{${darkEntries.map(([key,value])=>`${key}:${value}`).join(";")};}`;
  return `${baseRule}\n@media (prefers-color-scheme: dark){${darkRule}}`;
}

function templateBaseCss(pageId, globals) {
  const q = cssQuote(pageId);
  const root = `[data-vsn-page-id=${q}]`;
  return [
    `${root}{width:100%;min-height:1px;color:var(--vsn-text,${globals.textColor});background:var(--vsn-bg,${globals.backgroundColor});font-family:${globals.fontFamily};}`,
    `${root},${root} *,${root} *::before,${root} *::after{box-sizing:border-box;}`,
    `${root} h1,${root} h2,${root} h3,${root} h4,${root} h5,${root} h6{font-family:${globals.headingFontFamily};}`,
    `${root} button,${root} .vsn-button{border-radius:var(--vsn-button-radius);}`,
    `${root} input:not([type="checkbox"]):not([type="radio"]),${root} textarea,${root} select{background:var(--vsn-form-bg);color:var(--vsn-form-color);border-color:var(--vsn-form-border);border-radius:var(--vsn-form-radius);}`,
  ].join("\n");
}

function fontRuntime({ groups = [], globals = {}, customFonts = [], fontSubset = true, fontPreload = "auto" } = {}) {
  const usages = collectFontUsages({ elements: groups, globals });
  if (globals.fontFamily) mergeFontUsage(usages, globals.fontFamily, { weights: [400,500,600,700], styles: ["normal"] });
  if (globals.headingFontFamily && globals.headingFontFamily !== "inherit") mergeFontUsage(usages, globals.headingFontFamily, { weights: [400,500,600,700,800], styles: ["normal"] });

  const customByFamily = new Map();
  for (const font of customFonts || []) {
    const key = String(font.family || "").toLowerCase();
    if (!customByFamily.has(key)) customByFamily.set(key, []);
    customByFamily.get(key).push(font);
  }

  const css = [];
  const preloads = new Set();
  const googleUsages = new Map();
  for (const [key, usage] of usages) {
    const customVariants = customByFamily.get(key) || [];
    if (customVariants.length) {
      const wantedWeights = new Set([...(usage?.weights || [])].map(Number));
      const wantedStyles = new Set([...(usage?.styles || [])].map((value)=>String(value || "normal").toLowerCase()));
      let selected = fontSubset ? customVariants.filter((custom)=>wantedWeights.has(Number(custom.weight || 400)) && wantedStyles.has(String(custom.style || "normal").toLowerCase())) : [...customVariants];
      if (!selected.length) selected = [customVariants.find((custom)=>Number(custom.weight || 400)===400 && String(custom.style || "normal")==="normal") || customVariants[0]].filter(Boolean);
      for (const custom of selected) {
        const mime = String(custom.mimeType || "");
        const format = mime.includes("woff2") ? "woff2" : mime.includes("woff") ? "woff" : (mime.includes("otf") || mime.includes("opentype")) ? "opentype" : "truetype";
        css.push(`@font-face{font-family:${cssQuote(custom.family)};src:url('/apps/vsn-builder/font/${encodeURIComponent(custom.id)}') format('${format}');font-style:${custom.style || "normal"};font-weight:${custom.weight || 400};font-display:swap;}`);
      }
      if (fontPreload !== "off") {
        const candidates = fontPreload === "aggressive" ? selected.slice(0,6) : selected.filter((custom)=>[400,600,700].includes(Number(custom.weight || 400)) && String(custom.style || "normal")==="normal").slice(0,2);
        for (const custom of candidates.length ? candidates : selected.slice(0,1)) preloads.add(`/apps/vsn-builder/font/${encodeURIComponent(custom.id)}`);
      }
      continue;
    }
    if (!SYSTEM_FONT_FAMILIES.has(key)) googleUsages.set(key, usage);
  }

  return { css: css.join("\n"), googleUrl: buildGoogleFontHref(googleUsages, FALLBACK_GOOGLE_FONTS), preloads: [...preloads] };
}

function slug(value = "template") {
  const output = String(value || "template")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return output || "template";
}

function stableId(value = "") {
  const cleaned = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (cleaned.slice(-10) || createHash("sha1").update(String(value || "template")).digest("hex").slice(0, 10));
}

function digest(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function walk(nodes = [], callback) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    callback(node);
    walk(node.children || [], callback);
  }
}

export function collectRuntimeDependencies(groups = []) {
  const deps = new Set();
  for (const group of Array.isArray(groups) ? groups : []) {
    walk(group, (node) => {
      const type = String(node.type || "");
      if (["slider","carousel","slides","testimonial-carousel"].includes(type)) deps.add("slider");
      if (["image","gallery-grid","product-gallery","product-media","video"].includes(type)) deps.add("media");
      if (["form-builder","newsletter-form"].includes(type)) deps.add("forms");
      if (["navigation-menu","mega-menu","localization"].includes(type)) deps.add("navigation");
      if (["product-grid","product-card","product-recommendations","recently-viewed","upsell-products","collection-filters","collection-sorting","pagination","cart-drawer","cart-trigger","add-to-cart","buy-now","variant-selector","quantity-selector"].includes(type) || type.startsWith("product-")) deps.add("commerce");
      if (["counter","countdown","tabs","accordion","announcement-bar"].includes(type)) deps.add("interactive");
      const interactions = normalizeElementInteractions(node.interactions || node.styles?.advanced?.interactions || {});
      if (interactions.sticky || interactions.parallax || interactions.entrance !== "none" || interactions.hover !== "none" || node.styles?.advanced?.entranceAnimation || node.styles?.advanced?.exitAnimation || node.styles?.advanced?.hoverEffect || node.styles?.advanced?.conditions) deps.add("effects");
      if (hasAdvancedInteractions(interactions)) deps.add("interactions");
    });
  }
  return [...deps].sort();
}

function pageNodes(page) {
  return migrateBuilderContent(parseJson(page?.publishedJson, []));
}

function resolveGlobal(pages, kind, requestedId = "") {
  const candidates = pages.filter((page) => page?.status === "published" && page?.publishedJson && page?.template === kind);
  if (requestedId) {
    const direct = candidates.find((page) => page.id === requestedId);
    if (direct) return direct;
  }
  return candidates
    .filter((page) => page.isDefault)
    .sort((a, b) => new Date(b.publishedAt || b.updatedAt || 0).getTime() - new Date(a.publishedAt || a.updatedAt || 0).getTime())[0] || null;
}

function compositionForPage(page, pages) {
  const ownNodes = pageNodes(page);
  const settings = templateSettings(ownNodes);
  const groups = [renderable(ownNodes)];
  const related = [];
  if (!["header", "footer"].includes(page.template)) {
    if (settings.headerEnabled !== false) {
      const header = resolveGlobal(pages, "header", String(settings.headerId || ""));
      if (header) { groups.push(renderable(pageNodes(header))); related.push({ kind: "header", id: header.id }); }
    }
    if (settings.footerEnabled !== false) {
      const footer = resolveGlobal(pages, "footer", String(settings.footerId || ""));
      if (footer) { groups.push(renderable(pageNodes(footer))); related.push({ kind: "footer", id: footer.id }); }
    }
  }
  return { ownNodes, groups, related };
}

function templateJavascript(pageId, entries) {
  const valid = (entries || []).filter((entry) => validateCustomJs(entry.code).valid);
  if (!valid.length) return "";
  const payload = valid.map((entry) => ({ id: entry.id, code: entry.code }));
  return [
    "/* VSN template custom JavaScript registry. Generated; do not edit. */",
    "(()=>{\"use strict\";",
    "window.__VSN_TEMPLATE_CUSTOM_JS__=window.__VSN_TEMPLATE_CUSTOM_JS__||{};",
    `window.__VSN_TEMPLATE_CUSTOM_JS__[${JSON.stringify(String(pageId))}]=${JSON.stringify(payload)};`,
    "})();",
  ].join("\n");
}


function dedupeCssLines(value = "") { return dedupeGeneratedCss(value); }

function criticalStyleCss(groups = [], globals = {}) {
  const own = Array.isArray(groups?.[0]) ? groups[0].slice(0, 2) : [];
  const header = Array.isArray(groups?.[1]) ? groups[1].slice(0, 1) : [];
  const criticalGroups = [own, header].filter((group) => group.length);
  if (!criticalGroups.length) return "";
  return buildStyleBundleCss(criticalGroups, globals, { includeBase: true, importantBase: true, includeHidden: false, includeResponsive: true, importantResponsive: true });
}

export function compileThemeAssets(pages = [], { designTokens = {}, customFonts = [], enterprise = {} } = {}) {
  const published = (Array.isArray(pages) ? pages : []).filter((page) => page?.status === "published" && page?.publishedJson);
  const templateFiles = [];
  const templates = {};

  for (const page of published) {
    const { ownNodes, groups, related } = compositionForPage(page, published);
    const globals = globalStyles(ownNodes, designTokens);
    const font = fontRuntime({ groups, globals, customFonts, fontSubset: enterprise.fontSubset !== false, fontPreload: enterprise.fontPreload || "auto" });
    const label = `${safeComment(page.title)} | ${safeComment(page.handle)} | ${page.id}`;
    const cssParts = [
      `/* VSN TEMPLATE: ${label} */`,
      `/* Published version: ${Number(page.publishedVersion || page.version || 0)} */`,
      font.googleUrl ? `@import url(${cssQuote(font.googleUrl)});` : "",
      font.css,
      cssVariables(page.id, globals, designTokens),
      templateBaseCss(page.id, globals),
      buildStyleBundleCss(groups, globals, { includeBase: true, importantBase: true, includeHidden: true, includeResponsive: true, importantResponsive: true }),
    ].filter(Boolean);
    const rawCss = cssParts.join("\n");
    const css = enterprise.cssDeduplication === false ? rawCss : dedupeCssLines(rawCss);
    const criticalRaw = enterprise.criticalCss === false ? "" : [font.css, cssVariables(page.id, globals, designTokens), templateBaseCss(page.id, globals), criticalStyleCss(groups, globals)].filter(Boolean).join("\n");
    const criticalCss = (enterprise.cssDeduplication === false ? criticalRaw : dedupeCssLines(criticalRaw)).slice(0, 12000);
    const baseName = `${VSN_ASSET_PREFIX}${slug(page.title || page.handle || page.template)}-${stableId(page.id)}`;
    const cssHash = digest(css);
    const cssName = `${baseName}.${cssHash}.css`;
    templateFiles.push({ filename: `assets/${cssName}`, body: { type: "TEXT", value: css } });

    const entries = collectCustomJsGroups(groups);
    const javascript = enterprise.safeMode === true ? "" : templateJavascript(page.id, entries);
    const jsHash = javascript ? digest(javascript) : "";
    const jsName = javascript ? `${baseName}.${jsHash}.js` : null;
    if (javascript) templateFiles.push({ filename: `assets/${jsName}`, body: { type: "TEXT", value: javascript } });

    templates[String(page.id)] = {
      id: String(page.id),
      title: String(page.title || ""),
      handle: String(page.handle || ""),
      template: String(page.template || ""),
      publishedVersion: Number(page.publishedVersion || page.version || 0),
      css: cssName,
      js: jsName,
      cssHash,
      jsHash: jsHash || null,
      dependencies: enterprise.assetMode === "compatibility" ? ["slider","media","forms","navigation","commerce","interactive","effects","interactions"] : collectRuntimeDependencies(groups),
      composition: related,
      cssBytes: Buffer.byteLength(css, "utf8"),
      criticalCss,
      criticalCssBytes: Buffer.byteLength(criticalCss, "utf8"),
      fontPreloads: font.preloads || [],
      jsBytes: javascript ? Buffer.byteLength(javascript, "utf8") : 0,
    };
  }

  const manifest = {
    architecture: "option-7-shared-core-template-delta",
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    templateCount: Object.keys(templates).length,
    entries: Object.values(templates),
  };

  return {
    architecture: manifest.architecture,
    manifest,
    templateFiles,
    files: [...templateFiles],
    pageCount: published.length,
    fileCount: templateFiles.length,
    cssFileCount: Object.values(templates).filter((entry) => entry.css).length,
    jsFileCount: Object.values(templates).filter((entry) => entry.js).length,
  };
}

function scopes(session) {
  return new Set(String(session?.scope || "").split(",").map((item) => item.trim()).filter(Boolean));
}

async function mainTheme(admin) {
  const response = await admin.graphql(`#graphql
    query VsnMainTheme { themes(first: 25) { nodes { id name role } } }
  `);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((item) => item.message).filter(Boolean).join(" ") || "Could not read Shopify themes.");
  return (result.data?.themes?.nodes || []).find((theme) => String(theme.role || "").toUpperCase() === "MAIN") || null;
}

async function setAssetState(admin, { ready, manifest = null } = {}) {
  const installResponse = await admin.graphql(`#graphql\nquery VsnAssetAppInstallation { currentAppInstallation { id } }`);
  const installResult = await installResponse.json();
  const ownerId = installResult.data?.currentAppInstallation?.id;
  if (!ownerId) return;
  const metafields = [{ ownerId, namespace: APP_METAFIELD_NAMESPACE, key: APP_METAFIELD_KEY, type: "boolean", value: ready ? "true" : "false" }];
  if (manifest) metafields.push({ ownerId, namespace: APP_METAFIELD_NAMESPACE, key: VSN_THEME_MANIFEST_METAFIELD, type: "json", value: JSON.stringify(manifest) });
  const response = await admin.graphql(`#graphql
    mutation VsnAssetPipelineState($metafields:[MetafieldsSetInput!]!){
      metafieldsSet(metafields:$metafields){ userErrors{field message} }
    }
  `, { variables: { metafields } });
  const result = await response.json();
  const errors = result.data?.metafieldsSet?.userErrors || [];
  if (errors.length) throw new Error(errors.map((item) => item.message).filter(Boolean).join(" ") || "Could not store the VSN asset manifest.");
}

async function getAssetManifest(admin) {
  const response = await admin.graphql(`#graphql
    query VsnAssetManifest {
      currentAppInstallation {
        metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "${VSN_THEME_MANIFEST_METAFIELD}") { value }
      }
    }
  `);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((item) => item.message).filter(Boolean).join(" ") || "Could not read the VSN asset manifest.");
  return parseJson(result.data?.currentAppInstallation?.metafield?.value, {
    architecture: "option-7-shared-core-template-delta",
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    templateCount: 0,
    entries: [],
  });
}

function normalizeAssetFilenames(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean).map((value) => value.startsWith("assets/") ? value : `assets/${value}`))];
}

async function deleteThemeFiles(admin, themeId, files) {
  const filenames = normalizeAssetFilenames(files);
  if (!filenames.length) return { files: [] };
  const response = await admin.graphql(`#graphql
    mutation VsnDeleteThemeAssets($themeId:ID!,$files:[String!]!){
      themeFilesDelete(themeId:$themeId,files:$files){
        deletedThemeFiles{ filename }
        userErrors{ field message filename }
      }
    }
  `, { variables: { themeId, files: filenames } });
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((item) => item.message).filter(Boolean).join(" ") || "Shopify rejected the theme asset deletion.");
  const payload = result.data?.themeFilesDelete || {};
  const userErrors = payload.userErrors || [];
  if (userErrors.length) {
    const error = new Error(userErrors.map((item) => item.message).filter(Boolean).join(" ") || "Theme asset deletion failed.");
    error.exemptionRequired = userErrors.some((item) => /exempt|protected|permission|access/i.test(item.message || ""));
    throw error;
  }
  return { files: (payload.deletedThemeFiles || []).map((item) => item.filename) };
}

function manifestWithoutPage(manifest, pageId) {
  const entries = (Array.isArray(manifest?.entries) ? manifest.entries : []).filter((entry) => String(entry?.id || "") !== String(pageId));
  return {
    ...(manifest && typeof manifest === "object" ? manifest : {}),
    architecture: manifest?.architecture || "option-7-shared-core-template-delta",
    schemaVersion: Number(manifest?.schemaVersion || 2),
    generatedAt: new Date().toISOString(),
    templateCount: entries.length,
    entries,
  };
}

function manifestWithEntry(manifest, entry) {
  const entries = (Array.isArray(manifest?.entries) ? manifest.entries : []).filter((item) => String(item?.id || "") !== String(entry?.id || ""));
  entries.push(entry);
  return {
    ...(manifest && typeof manifest === "object" ? manifest : {}),
    architecture: manifest?.architecture || "option-7-shared-core-template-delta",
    schemaVersion: Number(manifest?.schemaVersion || 2),
    generatedAt: new Date().toISOString(),
    templateCount: entries.length,
    entries,
  };
}

async function upsertThemeFiles(admin, themeId, files) {
  const response = await admin.graphql(`#graphql
    mutation VsnThemeAssets($themeId:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){
      themeFilesUpsert(themeId:$themeId,files:$files){
        upsertedThemeFiles{ filename }
        userErrors{ field message }
        job{ id }
      }
    }
  `, { variables: { themeId, files } });
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((item) => item.message).filter(Boolean).join(" ") || "Shopify rejected the generated theme assets.");
  const payload = result.data?.themeFilesUpsert || {};
  const userErrors = payload.userErrors || [];
  if (userErrors.length) {
    const error = new Error(userErrors.map((item) => item.message).filter(Boolean).join(" ") || "Theme asset update failed.");
    error.exemptionRequired = userErrors.some((item) => /exempt|protected|permission|access/i.test(item.message || ""));
    throw error;
  }
  return { files: (payload.upsertedThemeFiles || []).map((item) => item.filename), jobId: payload.job?.id || null };
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

export async function trashTemplateThemeAssets({ admin, session, pageId, fallbackFiles = [] } = {}) {
  const currentScopes = scopes(session);
  const safeFallbackFiles = Array.isArray(fallbackFiles) ? fallbackFiles : [];
  let manifest;
  try { manifest = await getAssetManifest(admin); } catch (error) {
    return { success: false, manifestUpdated: false, files: normalizeAssetFilenames(safeFallbackFiles), error: error instanceof Error ? error.message : "Could not read the template asset manifest." };
  }
  const entry = (Array.isArray(manifest.entries) ? manifest.entries : []).find((item) => String(item?.id || "") === String(pageId));
  const files = normalizeAssetFilenames([entry?.css, entry?.js, ...safeFallbackFiles]);
  const nextManifest = manifestWithoutPage(manifest, pageId);

  // First disconnect the template from storefront loading. Physical file cleanup follows.
  try { await setAssetState(admin, { ready: nextManifest.entries.length > 0, manifest: nextManifest }); } catch (error) {
    return { success: false, manifestUpdated: false, files, error: error instanceof Error ? error.message : "Could not update the template asset manifest." };
  }

  if (!files.length) return { success: true, manifestUpdated: true, deletedFiles: [], files: [] };
  const missingScopes = ["read_themes", "write_themes"].filter((scope) => !currentScopes.has(scope));
  if (missingScopes.length) return { success: false, manifestUpdated: true, files, missingScopes, requiresReauthorization: true, error: `Theme asset deletion requires ${missingScopes.join(", ")}.` };

  try {
    const theme = await mainTheme(admin);
    if (!theme?.id) return { success: false, manifestUpdated: true, files, error: "The active Shopify theme could not be found." };
    const deleted = await deleteThemeFiles(admin, theme.id, files);
    return { success: true, manifestUpdated: true, deletedFiles: deleted.files, files, themeId: theme.id };
  } catch (error) {
    return { success: false, manifestUpdated: true, files, exemptionRequired: Boolean(error?.exemptionRequired), error: error instanceof Error ? error.message : "Template asset deletion failed." };
  }
}

export async function restoreTemplateThemeAssets({ admin, session, db, pageId, staleFiles = [] } = {}) {
  staleFiles = Array.isArray(staleFiles) ? staleFiles : [];
  const page = await db.builderPage.findFirst({ where: { id: String(pageId), shop: session.shop, deletedAt: null } });
  if (!page) return { success: false, error: "Restored template was not found." };
  if (page.status !== "published" || !page.publishedJson) return { success: true, skipped: true, reason: "draft-template" };

  const currentScopes = scopes(session);
  const missingScopes = ["read_themes", "write_themes"].filter((scope) => !currentScopes.has(scope));
  if (missingScopes.length) return { success: false, missingScopes, requiresReauthorization: true, error: `Theme asset publishing requires ${missingScopes.join(", ")}.` };

  const [pages, setting, customFonts, manifest] = await Promise.all([
    db.builderPage.findMany({ where: { shop: session.shop, status: "published", deletedAt: null }, orderBy: { updatedAt: "asc" }, select: { id: true, title: true, handle: true, template: true, isDefault: true, status: true, publishedJson: true, publishedAt: true, updatedAt: true, version: true, publishedVersion: true } }),
    db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { designTokensJson: true, enterpriseJson: true } }).catch(() => null),
    db.builderCustomFont.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id: true, family: true, weight: true, style: true, mimeType: true } }).catch(() => []),
    getAssetManifest(admin),
  ]);
  const compiled = compileThemeAssets(pages, { designTokens: parseJson(setting?.designTokensJson, {}), customFonts, enterprise: parseJson(setting?.enterpriseJson, {}) });
  const entry = (compiled.manifest.entries || []).find((item) => String(item?.id || "") === String(pageId));
  if (!entry) return { success: false, error: "The restored published template could not be compiled." };
  const requiredNames = new Set([entry.css, entry.js].filter(Boolean).map((name) => `assets/${name}`));
  const files = compiled.templateFiles.filter((file) => requiredNames.has(file.filename));
  const theme = await mainTheme(admin);
  if (!theme?.id) return { success: false, error: "The active Shopify theme could not be found." };

  try {
    const written = files.length ? await upsertThemeFiles(admin, theme.id, files) : { files: [], jobId: null };
    const nextManifest = manifestWithEntry(manifest, entry);
    await setAssetState(admin, { ready: true, manifest: nextManifest });
    const stale = normalizeAssetFilenames(staleFiles).filter((name) => !requiredNames.has(name));
    let staleCleanup = [];
    if (stale.length) {
      try { staleCleanup = (await deleteThemeFiles(admin, theme.id, stale)).files; } catch {}
    }
    return { success: true, files: written.files, jobId: written.jobId, staleDeletedFiles: staleCleanup, entry, themeId: theme.id };
  } catch (error) {
    return { success: false, exemptionRequired: Boolean(error?.exemptionRequired), error: error instanceof Error ? error.message : "Restored template asset generation failed." };
  }
}

export async function rebuildThemeAssets({ admin, session, db }) {
  const currentScopes = scopes(session);
  const missingScopes = ["read_themes", "write_themes"].filter((scope) => !currentScopes.has(scope));
  const [pages, setting, customFonts] = await Promise.all([
    db.builderPage.findMany({ where: { shop: session.shop, status: "published", deletedAt: null }, orderBy: { updatedAt: "asc" }, select: { id: true, title: true, handle: true, template: true, isDefault: true, status: true, publishedJson: true, publishedAt: true, updatedAt: true, version: true, publishedVersion: true } }),
    db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { designTokensJson: true, enterpriseJson: true } }).catch(() => null),
    db.builderCustomFont.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id: true, family: true, weight: true, style: true, mimeType: true } }).catch(() => []),
  ]);
  const designTokens = parseJson(setting?.designTokensJson, {});
  const compiled = compileThemeAssets(pages, { designTokens, customFonts, enterprise: parseJson(setting?.enterpriseJson, {}) });

  if (missingScopes.length) {
    await setAssetState(admin, { ready: false }).catch(()=>{});
    return { success: false, compiled: true, architecture: compiled.architecture, pageCount: compiled.pageCount, fileCount: compiled.fileCount, missingScopes, requiresReauthorization: true, error: `Theme asset publishing requires ${missingScopes.join(", ")}. Reconnect the app after updating scopes.` };
  }

  const theme = await mainTheme(admin);
  if (!theme?.id) return { success: false, compiled: true, architecture: compiled.architecture, pageCount: compiled.pageCount, error: "The active Shopify theme could not be found." };

  const writtenFiles = [];
  const jobIds = [];
  try {
    // Write immutable hashed template files first. The app-owned manifest switches only after every referenced file was accepted.
    for (const batch of chunks(compiled.templateFiles, MAX_FILES_PER_UPSERT)) {
      if (!batch.length) continue;
      const result = await upsertThemeFiles(admin, theme.id, batch);
      writtenFiles.push(...result.files);
      if (result.jobId) jobIds.push(result.jobId);
    }
    await setAssetState(admin, { ready: true, manifest: compiled.manifest });
  } catch (error) {
    await setAssetState(admin, { ready: false }).catch(()=>{});
    return { success: false, compiled: true, architecture: compiled.architecture, pageCount: compiled.pageCount, fileCount: compiled.fileCount, themeId: theme.id, exemptionRequired: Boolean(error?.exemptionRequired), error: error instanceof Error ? error.message : "Theme asset update failed." };
  }

  return {
    success: true,
    compiled: true,
    architecture: compiled.architecture,
    pageCount: compiled.pageCount,
    fileCount: compiled.fileCount,
    cssFileCount: compiled.cssFileCount,
    jsFileCount: compiled.jsFileCount,
    themeId: theme.id,
    themeName: theme.name,
    manifest: `${APP_METAFIELD_NAMESPACE}.${VSN_THEME_MANIFEST_METAFIELD}`,
    files: writtenFiles,
    jobIds,
  };
}
