const SYSTEM_TYPES = new Set(["global-styles", "template-settings"]);
const GLOBAL_TYPES = new Set(["header", "footer", "section"]);
const CAMPAIGN_TYPES = new Set(["popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element"]);
const IMAGE_TYPES = new Set(["image", "image-box", "gallery-grid", "product-image", "product-media", "product-gallery", "collection-image", "article-featured-image", "team-grid", "logo-cloud"]);
const INTERACTIVE_TYPES = new Set(["button", "icon-box", "navigation-menu", "mega-menu", "tabs", "accordion", "toggle", "form-builder", "newsletter-form", "product-add-to-cart", "buy-now", "cart-trigger"]);
const THIRD_PARTY_TYPES = new Set(["html", "custom-html", "iframe", "embed", "video", "app-block", "third-party-block"]);

function str(value) { return String(value ?? "").trim(); }
function num(value, fallback = 0) { const next = Number.parseFloat(String(value ?? "")); return Number.isFinite(next) ? next : fallback; }
function parsePx(value) { const raw = str(value); if (!raw) return null; const match = raw.match(/^(-?\d+(?:\.\d+)?)px$/i); return match ? Number(match[1]) : null; }
function settingsNode(elements = []) { return (Array.isArray(elements) ? elements : []).find((node) => node?.type === "template-settings") || null; }
function globalNode(elements = []) { return (Array.isArray(elements) ? elements : []).find((node) => node?.type === "global-styles") || null; }
function pushIssue(list, issue) { list.push({ level: "warning", category: "general", ...issue }); }

export function flattenBuilderNodes(nodes = [], result = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;
    if (!SYSTEM_TYPES.has(node.type)) result.push(node);
    flattenBuilderNodes(node.children || [], result);
  }
  return result;
}

function headingLevel(node) {
  if (!node) return null;
  if (node.type === "collection-title" || node.type === "product-title" || node.type === "article-title" || node.type === "blog-title") return Number(String(node.props?.tag || "h1").replace(/\D/g, "")) || 1;
  if (node.type !== "heading") return null;
  const level = Number(String(node.props?.tag || node.props?.headingTag || "h2").replace(/\D/g, ""));
  return level >= 1 && level <= 6 ? level : 2;
}

function normalizeHex(value) {
  const raw = str(value).toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(raw)) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((x) => Math.max(0, Math.min(255, Number(x))).toString(16).padStart(2, "0")).join("")}`;
  return null;
}
function luminance(value) {
  const hex = normalizeHex(value); if (!hex) return null;
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
export function contrastRatio(foreground, background) {
  const fg = luminance(foreground); const bg = luminance(background); if (fg == null || bg == null) return null;
  const high = Math.max(fg, bg); const low = Math.min(fg, bg); return (high + 0.05) / (low + 0.05);
}

function nodeColor(node, globals) {
  return node?.styles?.typography?.color || node?.styles?.color || node?.props?.color || globals?.textColor || "";
}
function nodeBackground(node, globals) {
  return node?.styles?.background?.color || node?.styles?.backgroundColor || node?.props?.backgroundColor || globals?.backgroundColor || "";
}
function fontThreshold(node) {
  const size = parsePx(node?.styles?.typography?.fontSize) || 16;
  const weight = num(node?.styles?.typography?.fontWeight, 400);
  return size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
}

function imageRecords(node) {
  const records = [];
  const props = node?.props || {};
  if (["image", "collection-image", "product-image", "article-featured-image", "image-box"].includes(node.type)) {
    records.push({ src: props.src || props.url || props.fallbackSrc || props.imageUrl || "", alt: props.alt || props.altText || props.fallbackText || "", loading: props.loading, srcset: props.srcset || props.srcSet, width: props.width, height: props.height, bytes: props.bytes || props.fileSize || props.sizeBytes });
  }
  const collections = [props.images, props.items, props.gallery, props.logos, props.members];
  for (const list of collections) if (Array.isArray(list)) for (const item of list) records.push({ src: item?.src || item?.url || item?.imageUrl || "", alt: item?.alt || item?.altText || item?.label || item?.name || "", loading: item?.loading, srcset: item?.srcset || item?.srcSet, width: item?.width, height: item?.height, bytes: item?.bytes || item?.fileSize || item?.sizeBytes });
  if (node.type === "gallery-grid" && str(props.imagesText)) for (const src of str(props.imagesText).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) records.push({ src, alt: "", loading: props.loading, srcset: props.srcset, width: null, height: null, bytes: null });
  return records;
}

function fieldRecords(node) {
  if (!["form-builder", "newsletter-form"].includes(node?.type)) return [];
  const props = node.props || {};
  if (Array.isArray(props.fields)) return props.fields;
  if (!str(props.fieldsText)) return [];
  return str(props.fieldsText).split(/\r?\n/).filter(Boolean).map((line) => {
    const [type = "text", name = "", label = "", placeholder = "", required = ""] = line.split("|").map((x) => str(x));
    return { type, name, label, placeholder, required: ["1", "true", "yes", "required"].includes(required.toLowerCase()) };
  });
}

function customCode(node) {
  const blocks = [];
  for (const value of [node?.props?.customJs, node?.props?.javascript, node?.props?.js, node?.customJs, node?.styles?.advanced?.customJs]) if (str(value)) blocks.push(str(value));
  return blocks;
}

function isExternal(src) { return /^https?:\/\//i.test(str(src)); }
function isShopifyCdn(src) { return /(^|\.)cdn\.shopify\.com|shopifycdn\.net/i.test(str(src)); }
function imageExtension(src) { try { return new URL(src, "https://example.invalid").pathname.split(".").pop()?.toLowerCase() || ""; } catch { return ""; } }

export function scanBuilderPage({ page = {}, elements = [], componentDefinitions = [] } = {}) {
  const nodes = flattenBuilderNodes(elements);
  const settings = settingsNode(elements)?.props || {};
  const globals = globalNode(elements)?.props || {};
  const issues = [];
  const headings = nodes.map((node) => ({ node, level: headingLevel(node) })).filter((entry) => entry.level);
  const h1s = headings.filter((entry) => entry.level === 1);

  if (h1s.length > 1) pushIssue(issues, { level: "error", category: "seo", code: "SEO_DUPLICATE_H1", nodeId: h1s[1]?.node?.id, message: `${h1s.length} H1 headings are present. Keep one primary H1 per page.` });
  let previousLevel = null;
  for (const entry of headings) {
    if (previousLevel && entry.level > previousLevel + 1) pushIssue(issues, { category: "accessibility", code: "A11Y_HEADING_ORDER", nodeId: entry.node.id, message: `${entry.node.label || "Heading"} jumps from H${previousLevel} to H${entry.level}. Use sequential heading levels.` });
    previousLevel = entry.level;
  }

  const nonSeoTemplate = GLOBAL_TYPES.has(page?.template) || CAMPAIGN_TYPES.has(page?.template);
  if (!nonSeoTemplate) {
    if (!str(settings.seoTitle)) pushIssue(issues, { level: "info", category: "seo", code: "SEO_META_TITLE_MISSING", message: "SEO title is empty. Shopify/dynamic title can be used, but a deliberate title is recommended for landing pages." });
    if (!str(settings.seoDescription)) pushIssue(issues, { level: "info", category: "seo", code: "SEO_META_DESCRIPTION_MISSING", message: "Meta description is empty." });
    if (str(settings.seoTitle).length > 70) pushIssue(issues, { category: "seo", code: "SEO_TITLE_LONG", message: `SEO title is ${str(settings.seoTitle).length} characters; consider keeping it near 50–60 characters.` });
    if (str(settings.seoDescription).length > 170) pushIssue(issues, { category: "seo", code: "SEO_DESCRIPTION_LONG", message: `Meta description is ${str(settings.seoDescription).length} characters; search engines may truncate it.` });
    if (str(settings.canonical) && !/^(https?:\/\/|\/)/i.test(str(settings.canonical))) pushIssue(issues, { level: "error", category: "seo", code: "SEO_CANONICAL_INVALID", message: "Canonical URL is not a valid absolute URL or site-relative path." });
    if (settings.schemaEnabled === false) pushIssue(issues, { category: "seo", code: "SEO_SCHEMA_DISABLED", message: "Structured data/schema is disabled for this page." });
    const robots = str(settings.robots || settings.metaRobots).toLowerCase();
    const noIndex = settings.noIndex === true || settings.indexable === false || /(^|[,\s])noindex([,\s]|$)/.test(robots);
    if (noIndex) pushIssue(issues, { level: page?.status === "published" ? "warning" : "info", category: "seo", code: "SEO_NOINDEX", message: page?.status === "published" ? "This published page is configured as noindex. Confirm it should be excluded from search engines." : "This draft is configured as noindex." });
  }

  const componentIds = new Set((componentDefinitions || []).filter((item) => item?.kind === "component").map((item) => String(item.id)));
  const images = [];
  let knownImageBytes = 0;
  let thirdPartyBlocks = 0;
  let customJsCount = 0;
  let estimatedFocusable = 0;
  let smallTargets = 0;
  let missingLabels = 0;
  let contrastFailures = 0;
  let lazyMissing = 0;
  let responsiveMissing = 0;
  let legacyImageFormats = 0;

  for (const node of nodes) {
    const props = node.props || {};
    const color = nodeColor(node, globals); const background = nodeBackground(node, globals); const ratio = contrastRatio(color, background);
    if (ratio != null && ratio < fontThreshold(node)) { contrastFailures += 1; pushIssue(issues, { category: "accessibility", code: "A11Y_CONTRAST", nodeId: node.id, message: `${node.label || node.type} has approximately ${ratio.toFixed(2)}:1 text contrast. Increase contrast for WCAG readability.` }); }

    const nodeImages = imageRecords(node); images.push(...nodeImages);
    for (const image of nodeImages) {
      if (Number.isFinite(Number(image.bytes))) knownImageBytes += Math.max(0, Number(image.bytes));
      if (!str(image.alt) && !["product-image", "collection-image", "article-featured-image", "product-media", "product-gallery"].includes(node.type)) pushIssue(issues, { category: "accessibility", code: "A11Y_IMAGE_ALT", nodeId: node.id, message: `${node.label || node.type} has an image without descriptive alt text.` });
      if (str(image.loading).toLowerCase() !== "lazy") lazyMissing += 1;
      if (!str(image.srcset) && str(image.src)) responsiveMissing += 1;
      if (["jpg", "jpeg", "png"].includes(imageExtension(image.src)) && !isShopifyCdn(image.src)) legacyImageFormats += 1;
    }

    const fields = fieldRecords(node);
    if (fields.length && props.showLabels === false) pushIssue(issues, { category: "accessibility", code: "A11Y_FORM_LABELS_HIDDEN", nodeId: node.id, message: `${node.label || "Form"} hides visible field labels. Ensure every field has an accessible name.` });
    for (const field of fields) if (!str(field.label) && !str(field.placeholder)) { missingLabels += 1; pushIssue(issues, { level: "error", category: "accessibility", code: "A11Y_FORM_LABEL_MISSING", nodeId: node.id, message: `${node.label || "Form"} contains a ${field.type || "field"} without a label or accessible fallback.` }); }

    if (INTERACTIVE_TYPES.has(node.type)) {
      estimatedFocusable += 1;
      const width = parsePx(node.styles?.size?.width || props.width); const height = parsePx(node.styles?.size?.height || props.height);
      const py = Math.max(parsePx(node.styles?.spacing?.paddingTop) || 0, parsePx(node.styles?.spacing?.paddingBottom) || 0);
      if ((width != null && width > 0 && width < 44) || (height != null && height > 0 && height < 44) || ((width == null && height == null) && node.type === "button" && py > 0 && py < 10)) { smallTargets += 1; pushIssue(issues, { category: "accessibility", code: "A11Y_TAP_TARGET", nodeId: node.id, message: `${node.label || node.type} may be smaller than the recommended 44×44px touch target.` }); }
      if (node.type === "button" && !str(props.text || props.label || props.ariaLabel)) pushIssue(issues, { level: "error", category: "accessibility", code: "A11Y_BUTTON_NAME", nodeId: node.id, message: "A button has no readable label/accessibility name." });
      const tabIndex = props.tabIndex ?? node.settings?.tabIndex;
      if (tabIndex != null && Number(tabIndex) < 0 && ["button", "navigation-menu", "tabs", "accordion", "toggle", "form-builder", "product-add-to-cart", "buy-now"].includes(node.type)) pushIssue(issues, { category: "accessibility", code: "A11Y_FOCUSABILITY", nodeId: node.id, message: `${node.label || node.type} is removed from the keyboard tab order. Confirm keyboard users can still reach the control.` });
    }

    const url = str(props.url || props.link || node.settings?.url);
    if (/^(javascript:|data:text\/html)/i.test(url)) pushIssue(issues, { level: "error", category: "security", code: "SECURITY_UNSAFE_LINK", nodeId: node.id, message: `${node.label || node.type} uses an unsafe executable URL.` });
    if (url === "#") pushIssue(issues, { level: "info", category: "seo", code: "SEO_PLACEHOLDER_LINK", nodeId: node.id, message: `${node.label || node.type} still uses a placeholder # link.` });

    if (THIRD_PARTY_TYPES.has(node.type) || isExternal(props.embedUrl || props.src || "")) thirdPartyBlocks += 1;
    if (["html", "custom-html"].includes(node.type)) {
      const html = str(props.html || props.content || props.code);
      const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const match of matches) {
        try { JSON.parse(match[1]); } catch { pushIssue(issues, { level: "error", category: "seo", code: "SEO_SCHEMA_INVALID_JSON", nodeId: node.id, message: `${node.label || "Custom HTML"} contains invalid JSON-LD structured data.` }); }
      }
    }
    if (node.type === "component-instance" && props.componentId && !componentIds.has(String(props.componentId))) pushIssue(issues, { level: "error", category: "security", code: "COMPONENT_REFERENCE_MISSING", nodeId: node.id, message: `${node.label || "Component"} references a missing component master.` });

    for (const code of customCode(node)) {
      customJsCount += 1;
      if (/document\.write\s*\(|eval\s*\(|new\s+Function\s*\(|innerHTML\s*=|localStorage\s*\.|document\.cookie|window\.location\s*=|fetch\s*\(\s*["']http:/i.test(code)) pushIssue(issues, { level: "error", category: "security", code: "SECURITY_CUSTOM_JS_RISK", nodeId: node.id, message: `${node.label || node.type} contains custom JavaScript that uses a high-risk browser API. Review it before publishing.` });
      else pushIssue(issues, { level: "info", category: "performance", code: "PERF_CUSTOM_JS", nodeId: node.id, message: `${node.label || node.type} adds custom JavaScript to the storefront runtime.` });
      if (/keydown|keyup|keypress/i.test(code) && /preventDefault\s*\(/i.test(code)) pushIssue(issues, { category: "accessibility", code: "A11Y_KEYBOARD_TRAP_RISK", nodeId: node.id, message: `${node.label || node.type} intercepts keyboard events. Confirm Tab/Escape navigation is not trapped.` });
    }
  }

  if (nodes.length > 1500) pushIssue(issues, { level: "error", category: "performance", code: "PERF_DOM_CRITICAL", message: `This template contains ${nodes.length} builder nodes. Reduce DOM depth/count for storefront performance.` });
  else if (nodes.length > 800) pushIssue(issues, { category: "performance", code: "PERF_DOM_HIGH", message: `This template contains ${nodes.length} builder nodes. Consider simplifying deeply nested sections.` });
  if (thirdPartyBlocks > 6) pushIssue(issues, { category: "performance", code: "PERF_THIRD_PARTY_HIGH", message: `${thirdPartyBlocks} third-party/embed blocks may increase JS/network cost.` });
  if (customJsCount > 4) pushIssue(issues, { category: "performance", code: "PERF_CUSTOM_JS_HIGH", message: `${customJsCount} custom-JS blocks are attached to this template.` });
  if (knownImageBytes > 5_000_000) pushIssue(issues, { category: "performance", code: "PERF_IMAGE_WEIGHT_HIGH", message: `Known image assets total about ${(knownImageBytes / 1048576).toFixed(1)} MB. Compress or replace oversized images.` });
  if (legacyImageFormats > 0) pushIssue(issues, { level: "info", category: "performance", code: "PERF_IMAGE_FORMAT", message: `${legacyImageFormats} external image(s) use JPG/PNG. Prefer AVIF/WebP where the source supports it.` });
  if (lazyMissing > 0) pushIssue(issues, { level: "info", category: "performance", code: "PERF_LAZY_LOADING", message: `${lazyMissing} image reference(s) do not explicitly request lazy loading. The storefront optimizer will apply lazy loading where safe.` });
  if (responsiveMissing > 0) pushIssue(issues, { level: "info", category: "performance", code: "PERF_RESPONSIVE_IMAGE", message: `${responsiveMissing} image reference(s) do not define srcset. Shopify-hosted Image widgets receive runtime responsive srcset automatically.` });

  const categoryCounts = issues.reduce((out, issue) => { out[issue.category] = (out[issue.category] || 0) + 1; return out; }, {});
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  const infos = issues.filter((issue) => issue.level === "info").length;
  let score = 100 - errors * 12 - warnings * 5 - infos * 1; score = Math.max(0, Math.min(100, score));
  return {
    pageId: page?.id || null,
    title: page?.title || "Untitled",
    template: page?.template || "page",
    status: page?.status || "draft",
    score,
    issues,
    summary: { errors, warnings, infos, categoryCounts },
    accessibility: { contrastFailures, headingCount: headings.length, h1Count: h1s.length, imageCount: images.length, missingAlt: issues.filter((x) => x.code === "A11Y_IMAGE_ALT").length, missingFormLabels: missingLabels, estimatedFocusable, smallTapTargets: smallTargets, keyboardTrapRisks: issues.filter((x) => x.code === "A11Y_KEYBOARD_TRAP_RISK").length },
    seo: { h1Count: h1s.length, metaTitle: str(settings.seoTitle), metaDescription: str(settings.seoDescription), canonical: str(settings.canonical), schemaEnabled: settings.schemaEnabled !== false, indexable: !(settings.noIndex === true || settings.indexable === false || /(^|[,\s])noindex([,\s]|$)/.test(str(settings.robots || settings.metaRobots).toLowerCase())), placeholderLinks: issues.filter((x) => x.code === "SEO_PLACEHOLDER_LINK").length },
    performance: { nodeCount: nodes.length, imageCount: images.length, knownImageBytes, lazyLoadingMissing: lazyMissing, responsiveSrcsetMissing: responsiveMissing, legacyImageFormats, thirdPartyBlocks, customJsBlocks: customJsCount },
    security: { highRiskCustomJs: issues.filter((x) => x.code === "SECURITY_CUSTOM_JS_RISK").length, unsafeLinks: issues.filter((x) => x.code === "SECURITY_UNSAFE_LINK").length },
  };
}

export function scanBuilderPages(pages = [], { componentDefinitions = [] } = {}) {
  const reports = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    let elements = [];
    try { const parsed = JSON.parse(String(page?.contentJson || page?.publishedJson || "[]")); elements = Array.isArray(parsed) ? parsed : []; } catch {}
    reports.push(scanBuilderPage({ page, elements, componentDefinitions }));
  }
  const canonicalOwners = new Map();
  for (const report of reports) {
    const canonical = str(report.seo?.canonical); if (!canonical) continue;
    const owners = canonicalOwners.get(canonical) || []; owners.push(report); canonicalOwners.set(canonical, owners);
  }
  for (const [canonical, owners] of canonicalOwners) if (owners.length > 1) for (const report of owners) {
    const issue = { level: "warning", category: "seo", code: "SEO_CANONICAL_CONFLICT", pageId: report.pageId, message: `${owners.length} Builder pages use the same custom canonical URL (${canonical}). Confirm this is intentional.` };
    report.issues.push(issue); report.summary.warnings += 1; report.summary.categoryCounts.seo = (report.summary.categoryCounts.seo || 0) + 1; report.score = Math.max(0, report.score - 5);
  }
  const issues = reports.flatMap((report) => report.issues.map((issue) => ({ ...issue, pageId: issue.pageId || report.pageId, pageTitle: report.title })));
  const totalNodes = reports.reduce((sum, report) => sum + report.performance.nodeCount, 0);
  const totalImages = reports.reduce((sum, report) => sum + report.performance.imageCount, 0);
  const knownImageBytes = reports.reduce((sum, report) => sum + report.performance.knownImageBytes, 0);
  const score = reports.length ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / reports.length) : 100;
  return {
    generatedAt: new Date().toISOString(), score, pageCount: reports.length, reports, issues,
    totals: {
      errors: issues.filter((x) => x.level === "error").length,
      warnings: issues.filter((x) => x.level === "warning").length,
      infos: issues.filter((x) => x.level === "info").length,
      accessibility: issues.filter((x) => x.category === "accessibility").length,
      seo: issues.filter((x) => x.category === "seo").length,
      performance: issues.filter((x) => x.category === "performance").length,
      security: issues.filter((x) => x.category === "security").length,
      nodeCount: totalNodes, imageCount: totalImages, knownImageBytes,
    },
  };
}
