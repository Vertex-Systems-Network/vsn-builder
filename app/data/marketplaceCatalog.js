const INDUSTRIES = [
  { key: "fashion", label: "Fashion", image: "/vsn-stock/fashion.svg", accent: "#111111" },
  { key: "beauty", label: "Beauty", image: "/vsn-stock/skincare.svg", accent: "#805ad5" },
  { key: "electronics", label: "Electronics", image: "/vsn-stock/watch.svg", accent: "#2563eb" },
  { key: "food", label: "Food", image: "/vsn-stock/seasonal.svg", accent: "#b45309" },
  { key: "saas", label: "SaaS", image: "/vsn-stock/office.svg", accent: "#0f766e" },
  { key: "luxury", label: "Luxury", image: "/vsn-stock/interior.svg", accent: "#6b4f2a" },
  { key: "real-estate", label: "Real Estate", image: "/vsn-stock/interior.svg", accent: "#0f4c5c" },
  { key: "single-product", label: "Single Product", image: "/vsn-stock/watch.svg", accent: "#7c2d12" },
  { key: "b2b", label: "B2B", image: "/vsn-stock/office.svg", accent: "#334155" },
  { key: "landing-cro", label: "Landing / CRO", image: "/vsn-stock/sale.svg", accent: "#9f1239" },
];

const PAGE_PATTERNS = [
  ["editorial", "Editorial Story", "editorial"],
  ["minimal", "Minimal Commerce", "centered"],
  ["bold", "Bold Launch", "split"],
  ["conversion", "Conversion First", "product-first"],
  ["story", "Brand Story", "editorial"],
  ["premium", "Premium Showcase", "split"],
  ["modern", "Modern Storefront", "grid"],
  ["soft", "Soft Collection", "centered"],
  ["dark", "Dark Campaign", "split"],
  ["catalogue", "Catalogue", "grid"],
  ["launch", "Product Launch", "product-first"],
  ["seasonal", "Seasonal Campaign", "centered"],
];

const SECTION_PATTERNS = [
  ["hero-split", "Hero · Split", "split"], ["hero-centered", "Hero · Centered", "centered"],
  ["hero-product", "Hero · Product", "product-first"], ["announcement", "Announcement", "centered"],
  ["features-3", "Features · 3 Column", "grid"], ["features-4", "Features · 4 Column", "grid"],
  ["benefits", "Benefits", "grid"], ["proof", "Social Proof", "centered"],
  ["testimonial", "Testimonial", "editorial"], ["testimonial-grid", "Testimonials · Grid", "grid"],
  ["stats", "Stats", "grid"], ["logos", "Logo Cloud", "grid"],
  ["cta", "CTA", "centered"], ["cta-split", "CTA · Split", "split"],
  ["newsletter", "Newsletter", "centered"], ["faq", "FAQ Intro", "editorial"],
  ["collection-intro", "Collection Intro", "split"], ["product-grid", "Product Grid Intro", "product-first"],
  ["category-grid", "Category Grid Intro", "grid"], ["comparison", "Comparison Intro", "grid"],
  ["story", "Story", "editorial"], ["timeline", "Timeline Intro", "editorial"],
  ["media-split", "Media Split", "split"], ["gallery", "Gallery Intro", "grid"],
  ["video", "Video Intro", "centered"], ["press", "Press Highlights", "grid"],
  ["trust", "Trust Bar", "grid"], ["shipping", "Shipping & Returns", "grid"],
  ["contact", "Contact CTA", "split"], ["lead-form", "Lead Form Intro", "split"],
  ["offer", "Offer Banner", "centered"], ["urgency", "Urgency CTA", "product-first"],
];

const PALETTES = {
  editorial: ["#111111", "#ffffff", "#eee9df"], minimal: ["#202223", "#ffffff", "#f6f6f7"],
  bold: ["#111827", "#f8fafc", "#f59e0b"], conversion: ["#0f172a", "#ffffff", "#16a34a"],
  story: ["#3f3f46", "#fafaf9", "#a16207"], premium: ["#171717", "#fafafa", "#a78bfa"],
  modern: ["#0f172a", "#ffffff", "#06b6d4"], soft: ["#52525b", "#fff7ed", "#fda4af"],
  dark: ["#f8fafc", "#111827", "#22c55e"], catalogue: ["#18181b", "#ffffff", "#71717a"],
  launch: ["#0c0a09", "#fff7ed", "#ea580c"], seasonal: ["#3f6212", "#f7fee7", "#84cc16"],
};

function id(...parts) { return parts.join("-").replace(/[^a-z0-9-]/g, ""); }
function nodeId(prefix, index) { return `${prefix}-${index}`; }
function copyFor(industryLabel, patternLabel) {
  return {
    eyebrow: industryLabel,
    title: `${patternLabel} for ${industryLabel}`,
    body: `A conversion-aware ${industryLabel.toLowerCase()} layout built from editable VSN widgets.`,
    cta: industryLabel === "B2B" ? "Book a consultation" : "Shop the collection",
  };
}

function makeSection({ prefix, industry, pattern, palette, compact = false }) {
  const copy = copyFor(industry.label, pattern[1]);
  const bg = pattern[0].includes("dark") ? "#111827" : palette[1];
  const text = pattern[0].includes("dark") ? "#f8fafc" : palette[0];
  const children = [
    { id: nodeId(prefix, 1), type: "text", label: "Eyebrow", props: { text: copy.eyebrow.toUpperCase() }, styles: { typography: { fontSize: "12px", fontWeight: "700", color: palette[2], letterSpacing: "1.4px" }, spacing: { marginBottom: "10px" } }, children: [] },
    { id: nodeId(prefix, 2), type: "heading", label: "Headline", props: { text: copy.title, tag: compact ? "h3" : "h2" }, styles: { typography: { fontSize: compact ? "30px" : "48px", fontWeight: "700", color: text, lineHeight: "1.08" }, spacing: { marginBottom: "14px" } }, children: [] },
    { id: nodeId(prefix, 3), type: "text", label: "Description", props: { text: copy.body }, styles: { typography: { fontSize: "16px", color: text, lineHeight: "1.6" }, spacing: { marginBottom: "20px" } }, children: [] },
    { id: nodeId(prefix, 4), type: "button", label: "CTA", props: { text: copy.cta, url: "/collections/all", variant: "primary" }, styles: { background: { color: palette[2] }, typography: { color: "#ffffff", fontWeight: "700" }, border: { radius: "10px" }, spacing: { paddingTop: "12px", paddingRight: "20px", paddingBottom: "12px", paddingLeft: "20px" } }, children: [] },
  ];
  if (["grid", "product-first"].includes(pattern[2])) {
    children.push({ id: nodeId(prefix, 5), type: "product-grid", label: "Product Grid", props: { title: "", limit: compact ? 4 : 8, columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, gap: 18, showImage: true, showTitle: true, showPrice: true }, styles: { spacing: { marginTop: "28px" } }, children: [] });
  }
  return { id: prefix, type: "section", label: `${industry.label} ${pattern[1]}`, props: {}, styles: { background: { type: "color", color: bg }, spacing: { paddingTop: compact ? "44px" : "72px", paddingRight: "48px", paddingBottom: compact ? "44px" : "72px", paddingLeft: "48px" }, border: { radius: "0px" } }, children };
}

function makePageContent(industry, pattern, index) {
  const palette = PALETTES[pattern[0]] || PALETTES.minimal;
  const root = id("market", industry.key, pattern[0], index);
  const sections = [
    makeSection({ prefix: `${root}-hero`, industry, pattern, palette }),
    makeSection({ prefix: `${root}-proof`, industry, pattern: ["proof", "Why customers choose us", "grid"], palette, compact: true }),
    makeSection({ prefix: `${root}-story`, industry, pattern: ["story", "Designed around the customer journey", "editorial"], palette, compact: true }),
    makeSection({ prefix: `${root}-cta`, industry, pattern: ["cta", "Ready to convert more visitors?", "centered"], palette, compact: true }),
  ];
  return [
    { id: `${root}-globals`, type: "global-styles", label: "Global Styles", props: { primaryColor: palette[2], textColor: palette[0], backgroundColor: palette[1], surfaceColor: palette[1], mutedSurfaceColor: palette[1], borderColor: "#e5e7eb", buttonBackground: palette[2], buttonTextColor: "#ffffff", radiusMd: "12px", radiusLg: "20px", spacingBase: 4 }, styles: {}, children: [] },
    ...sections,
  ];
}

function makeSectionContent(industry, pattern, index) {
  const palette = PALETTES[PAGE_PATTERNS[index % PAGE_PATTERNS.length][0]] || PALETTES.minimal;
  return makeSection({ prefix: id("market-section", industry.key, pattern[0], index), industry, pattern, palette, compact: false });
}


function pageCategory(patternKey) {
  if (["bold", "launch", "seasonal"].includes(patternKey)) return "Campaign Pages";
  if (patternKey === "conversion") return "Landing / CRO Pages";
  if (["editorial", "story", "premium"].includes(patternKey)) return "Brand & Editorial Pages";
  return "Storefront Pages";
}

function sectionCategory(patternKey) {
  if (patternKey.startsWith("hero")) return "Hero";
  if (["announcement", "offer", "urgency"].includes(patternKey)) return "Promotional";
  if (["features-3", "features-4", "benefits", "stats", "logos", "trust", "shipping"].includes(patternKey)) return "Features & Trust";
  if (["proof", "testimonial", "testimonial-grid"].includes(patternKey)) return "Social Proof";
  if (["cta", "cta-split"].includes(patternKey)) return "CTA";
  if (["newsletter", "lead-form", "contact"].includes(patternKey)) return "Lead Capture";
  if (["collection-intro", "product-grid", "category-grid", "comparison"].includes(patternKey)) return "Commerce";
  if (["media-split", "gallery", "video"].includes(patternKey)) return "Media";
  return "Content";
}

function qualityScore(kind, index) {
  const base = kind === "page" ? 88 : 84;
  return Math.min(99, base + (index % 11));
}

function metadata({ kind, industry, style, layout, index, title, content, category }) {
  const palette = PALETTES[style] || PALETTES.minimal;
  return {
    id: id("vsn", kind, industry.key, style || layout, index),
    catalogId: id("vsn", kind, industry.key, style || layout, index),
    version: 1,
    title,
    kind,
    category: category || (kind === "page" ? "Page Templates" : "Sections"),
    industry: industry.key,
    industryLabel: industry.label,
    style,
    layout,
    planTier: index % 4 === 0 ? "pro" : "free",
    colorTags: palette,
    previewImage: industry.image,
    description: `${industry.label} ${kind === "page" ? "page template" : "section"} with editable VSN structure and responsive styling.`,
    qualityScore: qualityScore(kind, index),
    compatibility: { minBuilderVersion: "2.5.48", schemaVersion: 1, widgets: "core", shopifyOnlineStore2: true },
    screenshot: { image: industry.image, viewport: { width: 1440, height: 1000 }, generated: true },
    source: "builtin",
    content,
  };
}

export const BUILTIN_MARKETPLACE_PAGES = INDUSTRIES.flatMap((industry, industryIndex) => PAGE_PATTERNS.map((pattern, patternIndex) => {
  const index = industryIndex * PAGE_PATTERNS.length + patternIndex;
  return metadata({ kind: "page", industry, style: pattern[0], layout: pattern[2], category: pageCategory(pattern[0]), index, title: `${industry.label} · ${pattern[1]}`, content: makePageContent(industry, pattern, index) });
}));

export const BUILTIN_MARKETPLACE_SECTIONS = INDUSTRIES.flatMap((industry, industryIndex) => SECTION_PATTERNS.map((pattern, patternIndex) => {
  const index = industryIndex * SECTION_PATTERNS.length + patternIndex;
  const style = PAGE_PATTERNS[(industryIndex + patternIndex) % PAGE_PATTERNS.length][0];
  return metadata({ kind: "section", industry, style, layout: pattern[2], category: sectionCategory(pattern[0]), index, title: `${industry.label} · ${pattern[1]}`, content: makeSectionContent(industry, pattern, index) });
}));

export const BUILTIN_MARKETPLACE_CATALOG = [...BUILTIN_MARKETPLACE_PAGES, ...BUILTIN_MARKETPLACE_SECTIONS];
export const MARKETPLACE_INDUSTRIES = INDUSTRIES.map(({ key, label }) => ({ key, label }));
export const MARKETPLACE_STYLES = [...new Set(PAGE_PATTERNS.map(([key]) => key))];
export const MARKETPLACE_LAYOUTS = [...new Set([...PAGE_PATTERNS.map(([, , layout]) => layout), ...SECTION_PATTERNS.map(([, , layout]) => layout)])];
export const MARKETPLACE_COUNTS = { pages: BUILTIN_MARKETPLACE_PAGES.length, sections: BUILTIN_MARKETPLACE_SECTIONS.length, total: BUILTIN_MARKETPLACE_CATALOG.length };
