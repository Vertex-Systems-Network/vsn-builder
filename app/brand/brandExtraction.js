export const BRAND_EXTRACTION_SCHEMA_VERSION = 1;
export const BRAND_SOURCE_MAX_BYTES = 256 * 1024;
export const BRAND_SOURCE_MAX_REDIRECTS = 3;
export const BRAND_SOURCE_MAX_TEXT = 18000;

export const BRAND_EXTRACTION_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "audience",
    "toneVoice",
    "imageryDirection",
    "merchandisingRules",
    "ctaRules",
    "componentGuidance",
    "doRules",
    "dontRules",
  ],
  properties: {
    summary: { type: "string" },
    audience: { type: "string" },
    toneVoice: { type: "string" },
    imageryDirection: { type: "string" },
    merchandisingRules: { type: "string" },
    ctaRules: { type: "string" },
    componentGuidance: { type: "string" },
    doRules: { type: "array", maxItems: 12, items: { type: "string" } },
    dontRules: { type: "array", maxItems: 12, items: { type: "string" } },
  },
});

export function publicBrandSourceText(value) {
  return String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, " ")
    .replace(/[<>{}]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BRAND_SOURCE_MAX_TEXT);
}
