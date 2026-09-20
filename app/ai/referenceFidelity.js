export const REFERENCE_ANALYSIS_VERSION = 1;
export const REFERENCE_MAX_SECTIONS = 12;
export const REFERENCE_MAX_COLORS = 8;
export const REFERENCE_MAX_TYPOGRAPHY = 6;
export const REFERENCE_MAX_ASSETS = 16;
export const REFERENCE_MAX_HINTS = 12;

const SECTION_ROLES = new Set(["hero","navigation","content","features","products","social-proof","cta","footer","other"]);
const SECTION_LAYOUTS = new Set(["stack","split","grid","carousel","overlay","full-bleed","other"]);
const ALIGNMENTS = new Set(["start","center","end","stretch","mixed"]);
const EMPHASIS = new Set(["primary","secondary","supporting"]);
const ASSET_KINDS = new Set(["image","video","icon","logo","illustration","other"]);
const TYPE_ROLES = new Set(["heading","body","accent","ui"]);

export const REFERENCE_ANALYSIS_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["sourceType","summary","sections","tokens","assets","responsiveHints","fidelityPriorities","transformationNotes"],
  properties: {
    sourceType: { type: "string", enum: ["screenshot","url","figma"] },
    summary: { type: "string" },
    sections: {
      type: "array",
      maxItems: REFERENCE_MAX_SECTIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key","role","label","order","layout","columns","alignment","emphasis","contentHint"],
        properties: {
          key: { type: "string" },
          role: { type: "string", enum: [...SECTION_ROLES] },
          label: { type: "string" },
          order: { type: "number" },
          layout: { type: "string", enum: [...SECTION_LAYOUTS] },
          columns: { type: "number" },
          alignment: { type: "string", enum: [...ALIGNMENTS] },
          emphasis: { type: "string", enum: [...EMPHASIS] },
          contentHint: { type: "string" },
        },
      },
    },
    tokens: {
      type: "object",
      additionalProperties: false,
      required: ["colors","typography","spacing","radii"],
      properties: {
        colors: { type: "array", maxItems: REFERENCE_MAX_COLORS, items: { type: "string" } },
        typography: {
          type: "array",
          maxItems: REFERENCE_MAX_TYPOGRAPHY,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role","scale","weight"],
            properties: {
              role: { type: "string", enum: [...TYPE_ROLES] },
              scale: { type: "number" },
              weight: { type: "number" },
            },
          },
        },
        spacing: { type: "array", maxItems: 8, items: { type: "number" } },
        radii: { type: "array", maxItems: 6, items: { type: "number" } },
      },
    },
    assets: {
      type: "array",
      maxItems: REFERENCE_MAX_ASSETS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind","role","positionHint","required"],
        properties: {
          kind: { type: "string", enum: [...ASSET_KINDS] },
          role: { type: "string" },
          positionHint: { type: "string" },
          required: { type: "boolean" },
        },
      },
    },
    responsiveHints: { type: "array", maxItems: REFERENCE_MAX_HINTS, items: { type: "string" } },
    fidelityPriorities: { type: "array", maxItems: REFERENCE_MAX_HINTS, items: { type: "string" } },
    transformationNotes: { type: "array", maxItems: 8, items: { type: "string" } },
  },
});

function cleanText(value, max = 600) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/{{[\s\S]*?}}/g, " ")
    .replace(/{%[\s\S]*?%}/g, " ")
    .replace(/javascript\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function enumValue(value, allowed, fallback) {
  const normalized = cleanText(value, 80).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function number(value, min, max, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function color(value) {
  const raw = cleanText(value, 20).toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(raw)) return `#${raw.slice(1).split("").map((char)=>char+char).join("")}`;
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : "";
}

function dedupeText(values, maxItems, maxChars = 400) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = cleanText(value, maxChars);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sectionKey(value, index, used) {
  let key = cleanText(value, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `section-${index+1}`;
  const base = key;
  let suffix = 2;
  while (used.has(key)) key = `${base}-${suffix++}`;
  used.add(key);
  return key;
}

export function normalizeReferenceAnalysis(input = {}) {
  const used = new Set();
  const sections = (Array.isArray(input?.sections) ? input.sections : []).slice(0, REFERENCE_MAX_SECTIONS).map((row, index) => ({
    key: sectionKey(row?.key, index, used),
    role: enumValue(row?.role, SECTION_ROLES, "other"),
    label: cleanText(row?.label, 160),
    order: number(row?.order, 1, REFERENCE_MAX_SECTIONS, index + 1),
    layout: enumValue(row?.layout, SECTION_LAYOUTS, "other"),
    columns: Math.round(number(row?.columns, 1, 6, 1)),
    alignment: enumValue(row?.alignment, ALIGNMENTS, "mixed"),
    emphasis: enumValue(row?.emphasis, EMPHASIS, "supporting"),
    contentHint: cleanText(row?.contentHint, 500),
  })).sort((a,b)=>a.order-b.order || a.key.localeCompare(b.key));

  const colors = [];
  const colorSeen = new Set();
  for (const value of Array.isArray(input?.tokens?.colors) ? input.tokens.colors : []) {
    const normalized = color(value);
    if (!normalized || colorSeen.has(normalized)) continue;
    colorSeen.add(normalized);
    colors.push(normalized);
    if (colors.length >= REFERENCE_MAX_COLORS) break;
  }

  const typography = (Array.isArray(input?.tokens?.typography) ? input.tokens.typography : []).slice(0, REFERENCE_MAX_TYPOGRAPHY).map((row) => ({
    role: enumValue(row?.role, TYPE_ROLES, "body"),
    scale: Math.round(number(row?.scale, 8, 180, 16)),
    weight: Math.round(number(row?.weight, 100, 900, 400) / 100) * 100,
  }));

  const spacing = [...new Set((Array.isArray(input?.tokens?.spacing) ? input.tokens.spacing : []).slice(0, 8).map((value)=>Math.round(number(value,0,400,0))))];
  const radii = [...new Set((Array.isArray(input?.tokens?.radii) ? input.tokens.radii : []).slice(0, 6).map((value)=>Math.round(number(value,0,200,0))))];

  const assets = (Array.isArray(input?.assets) ? input.assets : []).slice(0, REFERENCE_MAX_ASSETS).map((row) => ({
    kind: enumValue(row?.kind, ASSET_KINDS, "other"),
    role: cleanText(row?.role, 160),
    positionHint: cleanText(row?.positionHint, 220),
    required: row?.required === true,
  })).filter((row)=>row.role || row.kind !== "other");

  return Object.freeze({
    version: REFERENCE_ANALYSIS_VERSION,
    sourceType: ["screenshot","url","figma"].includes(String(input?.sourceType || "")) ? String(input.sourceType) : "screenshot",
    summary: cleanText(input?.summary, 1200),
    sections: Object.freeze(sections.map(Object.freeze)),
    tokens: Object.freeze({
      colors: Object.freeze(colors),
      typography: Object.freeze(typography.map(Object.freeze)),
      spacing: Object.freeze(spacing),
      radii: Object.freeze(radii),
    }),
    assets: Object.freeze(assets.map(Object.freeze)),
    responsiveHints: Object.freeze(dedupeText(input?.responsiveHints, REFERENCE_MAX_HINTS, 500)),
    fidelityPriorities: Object.freeze(dedupeText(input?.fidelityPriorities, REFERENCE_MAX_HINTS, 500)),
    transformationNotes: Object.freeze(dedupeText(input?.transformationNotes, 8, 500)),
  });
}

function ratioScore(value, max) {
  return Math.max(0, Math.min(max, Math.round(value * max)));
}

function planElements(plan = {}) {
  return Array.isArray(plan?.elements) ? plan.elements : [];
}

function rootSections(plan = {}) {
  return planElements(plan).filter((row) => {
    const parent = String(row?.parentRef || "root");
    return parent === "root" && ["section","container","columns","banner"].includes(String(row?.type || ""));
  });
}

function textTokens(value) {
  const stop = new Set(["the","and","for","with","from","this","that","section","content","layout","area"]);
  return new Set(cleanText(value, 1000).toLowerCase().split(/[^a-z0-9]+/).filter((word)=>word.length>2&&!stop.has(word)));
}

function keywordCoverage(reference, plan) {
  const targets = reference.sections.map((row)=>new Set([...textTokens(row.role),...textTokens(row.label)])).filter((set)=>set.size);
  if (!targets.length) return 1;
  const candidateText = planElements(plan).map((row)=>`${row?.label||""} ${row?.text||""} ${row?.type||""}`).join(" ");
  const candidate = textTokens(candidateText);
  let matched = 0;
  for (const target of targets) {
    if ([...target].some((token)=>candidate.has(token))) matched += 1;
  }
  return matched / targets.length;
}

function structureCoverage(reference, plan) {
  const expected = reference.sections.length;
  const actual = rootSections(plan).length;
  if (!expected && !actual) return 1;
  if (!expected || !actual) return 0;
  return Math.max(0, 1 - Math.abs(expected - actual) / Math.max(expected, actual));
}

function colorCoverage(reference, plan) {
  const expected = new Set(reference.tokens.colors);
  if (!expected.size) return 1;
  const actual = new Set();
  for (const row of planElements(plan)) {
    for (const value of [row?.backgroundColor,row?.textColor]) {
      const normalized = color(value);
      if (normalized) actual.add(normalized);
    }
  }
  let matched = 0;
  for (const value of expected) if (actual.has(value)) matched += 1;
  return matched / expected.size;
}

function assetCoverage(reference, plan) {
  const required = reference.assets.filter((asset)=>asset.required);
  const expected = required.length ? required : reference.assets;
  if (!expected.length) return 1;
  const counts = new Map();
  for (const row of planElements(plan)) {
    const type = String(row?.type || "");
    const kind = type === "image" ? "image" : type === "video" ? "video" : /icon/.test(type) ? "icon" : "";
    if (kind) counts.set(kind,(counts.get(kind)||0)+1);
  }
  const remaining = new Map(counts);
  let matched = 0;
  for (const asset of expected) {
    const kind = ["logo","illustration"].includes(asset.kind) ? "image" : asset.kind;
    const count = remaining.get(kind) || 0;
    if (count > 0) {
      matched += 1;
      remaining.set(kind,count-1);
    }
  }
  return matched / expected.length;
}

function responsiveCoverage(plan) {
  const elements = planElements(plan);
  if (!elements.length) return 1;
  let risky = 0;
  for (const row of elements) {
    for (const value of [row?.width,row?.maxWidth,row?.height]) {
      const raw = String(value || "").trim();
      if (/^\d+(?:\.\d+)?px$/.test(raw) && Number.parseFloat(raw) > 480) risky += 1;
    }
  }
  return Math.max(0,1-(risky/Math.max(elements.length,1)));
}

export function scoreReferencePlanFidelity(referenceInput = {}, plan = {}) {
  const reference = normalizeReferenceAnalysis(referenceInput);
  const components = Object.freeze({
    structure: Object.freeze({ score: ratioScore(structureCoverage(reference,plan),30), max: 30 }),
    hierarchy: Object.freeze({ score: ratioScore(keywordCoverage(reference,plan),20), max: 20 }),
    tokens: Object.freeze({ score: ratioScore(colorCoverage(reference,plan),20), max: 20 }),
    assets: Object.freeze({ score: ratioScore(assetCoverage(reference,plan),15), max: 15 }),
    responsive: Object.freeze({ score: ratioScore(responsiveCoverage(plan),15), max: 15 }),
  });
  const score = Object.values(components).reduce((sum,row)=>sum+row.score,0);
  return Object.freeze({
    version: 1,
    kind: "semantic-structural-v1",
    score,
    maxScore: 100,
    notPixelScore: true,
    components,
  });
}
