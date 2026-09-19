export const BRAND_PROFILE_VERSION = 1;

export const EMPTY_BRAND_PROFILE = Object.freeze({
  version: BRAND_PROFILE_VERSION,
  summary: "",
  audience: "",
  toneVoice: "",
  imageryDirection: "",
  merchandisingRules: "",
  ctaRules: "",
  componentGuidance: "",
  doRules: Object.freeze([]),
  dontRules: Object.freeze([]),
});

const MAX_SHORT = 800;
const MAX_LONG = 2400;
const MAX_RULES = 12;
const MAX_RULE = 320;
const UNSAFE_SCHEME = /\b(?:javascript|vbscript)\s*:/gi;
const UNSAFE_DATA_HTML = /\bdata\s*:\s*text\/html/gi;

function plainText(value, max) {
  const raw = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>{}]/g, "")
    .replace(UNSAFE_SCHEME, "")
    .replace(UNSAFE_DATA_HTML, "")
    .replace(/\s+/g, " ")
    .trim();
  return raw.slice(0, max);
}

function ruleList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "").split(/\r?\n|;/g);
  return [...new Set(source.map((item) => plainText(item, MAX_RULE)).filter(Boolean))].slice(0, MAX_RULES);
}

export function normalizeBrandProfile(value = {}) {
  let source = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { source = {}; }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) source = {};
  return Object.freeze({
    version: BRAND_PROFILE_VERSION,
    summary: plainText(source.summary, MAX_SHORT),
    audience: plainText(source.audience, MAX_SHORT),
    toneVoice: plainText(source.toneVoice, MAX_LONG),
    imageryDirection: plainText(source.imageryDirection, MAX_LONG),
    merchandisingRules: plainText(source.merchandisingRules, MAX_LONG),
    ctaRules: plainText(source.ctaRules, MAX_LONG),
    componentGuidance: plainText(source.componentGuidance, MAX_LONG),
    doRules: Object.freeze(ruleList(source.doRules)),
    dontRules: Object.freeze(ruleList(source.dontRules)),
  });
}

export function brandProfileForm(profile = {}) {
  const normalized = normalizeBrandProfile(profile);
  return {
    brandSummary: normalized.summary,
    brandAudience: normalized.audience,
    brandToneVoice: normalized.toneVoice,
    brandImageryDirection: normalized.imageryDirection,
    brandMerchandisingRules: normalized.merchandisingRules,
    brandCtaRules: normalized.ctaRules,
    brandComponentGuidance: normalized.componentGuidance,
    brandDoRules: normalized.doRules.join("\n"),
    brandDontRules: normalized.dontRules.join("\n"),
  };
}

export function brandProfileFromForm(value = {}) {
  return normalizeBrandProfile({
    summary: value.brandSummary,
    audience: value.brandAudience,
    toneVoice: value.brandToneVoice,
    imageryDirection: value.brandImageryDirection,
    merchandisingRules: value.brandMerchandisingRules,
    ctaRules: value.brandCtaRules,
    componentGuidance: value.brandComponentGuidance,
    doRules: value.brandDoRules,
    dontRules: value.brandDontRules,
  });
}

export function brandProfileHasGuidance(profile = {}) {
  const normalized = normalizeBrandProfile(profile);
  return Boolean(
    normalized.summary || normalized.audience || normalized.toneVoice || normalized.imageryDirection ||
    normalized.merchandisingRules || normalized.ctaRules || normalized.componentGuidance ||
    normalized.doRules.length || normalized.dontRules.length
  );
}
