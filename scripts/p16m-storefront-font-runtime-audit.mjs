import assert from "node:assert/strict";
import fs from "node:fs";
import { vsnFontRuntime } from "../app/storefront/fontRuntime.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(
  vsnFontRuntime(),
  { css: "", googleUrl: "" },
  "Empty font runtime stays empty",
);

const systemOnly = vsnFontRuntime({
  globals: {
    fontFamily: "Arial, sans-serif",
    headingFontFamily: "Georgia, serif",
  },
});
equal(systemOnly.css, "", "System fonts do not emit custom @font-face CSS");
equal(systemOnly.googleUrl, "", "System fonts do not request Google Fonts");

const inter = vsnFontRuntime({
  globals: {
    fontFamily: "Inter, sans-serif",
    headingFontFamily: "Inter, sans-serif",
  },
});
equal(inter.css, "", "Google font usage without custom variants emits no @font-face CSS");
ok(inter.googleUrl.startsWith("https://fonts.googleapis.com/css2?"), "Google runtime uses HTTPS CSS2 endpoint");
ok(inter.googleUrl.includes("family=Inter:wght@400;500;600;700;800"), "Inter runtime preserves body + heading weight union");
ok(inter.googleUrl.endsWith("&display=swap"), "Google runtime keeps display=swap");

const unknownGoogle = vsnFontRuntime({
  elements: [{
    type: "text",
    props: {
      typography: {
        fontFamily: "Merchant Sans",
        fontWeight: 600,
        fontStyle: "italic",
      },
    },
  }],
});
equal(unknownGoogle.css, "", "Unknown non-system font without custom file emits no local CSS");
ok(
  unknownGoogle.googleUrl.includes("family=Merchant+Sans"),
  "Unknown non-system font keeps legacy Google family fallback",
);

const custom = vsnFontRuntime({
  elements: [{
    type: "text",
    styles: {
      typography: {
        fontFamily: "Brand Font",
        fontWeight: 700,
        fontStyle: "italic",
      },
    },
  }],
  customFonts: [
    {
      id: "font/woff2 id",
      family: "Brand Font",
      weight: 400,
      style: "normal",
      mimeType: "font/woff2",
    },
    {
      id: "font-woff",
      family: "Brand Font",
      weight: 500,
      style: "normal",
      mimeType: "font/woff",
    },
    {
      id: "font-otf",
      family: "Brand Font",
      weight: 600,
      style: "normal",
      mimeType: "font/otf",
    },
    {
      id: "font-ttf",
      family: "Brand Font",
      weight: 700,
      style: "italic",
      mimeType: "font/ttf",
    },
  ],
});
equal(custom.googleUrl, "", "Matching custom font suppresses Google font request");
equal((custom.css.match(/@font-face/g) || []).length, 4, "All matching custom variants emit @font-face rules");
ok(custom.css.includes('font-family:"Brand Font"'), "Custom family remains JSON-quoted");
ok(custom.css.includes("/apps/vsn-builder/font/font%2Fwoff2%20id"), "Custom font ID remains URL-encoded");
ok(custom.css.includes("format('woff2')"), "WOFF2 MIME maps to woff2");
ok(custom.css.includes("format('woff')"), "WOFF MIME maps to woff");
ok(custom.css.includes("format('opentype')"), "OTF MIME maps to opentype");
ok(custom.css.includes("format('truetype')"), "Fallback/TTF MIME maps to truetype");
ok(custom.css.includes("font-style:italic;font-weight:700;font-display:swap"), "Custom style/weight and font-display behavior remain unchanged");

const caseInsensitiveCustom = vsnFontRuntime({
  globals: { fontFamily: "BRAND FONT" },
  customFonts: [{
    id: "font-case",
    family: "Brand Font",
    weight: 400,
    style: "normal",
    mimeType: "application/octet-stream",
  }],
});
equal(caseInsensitiveCustom.googleUrl, "", "Custom family matching remains case-insensitive");
ok(caseInsensitiveCustom.css.includes("format('truetype')"), "Unknown MIME keeps historical truetype fallback");

const customWinsOverCatalog = vsnFontRuntime({
  globals: { fontFamily: "Inter" },
  customFonts: [{
    id: "inter-custom",
    family: "Inter",
    weight: 400,
    style: "normal",
    mimeType: "font/woff2",
  }],
});
equal(customWinsOverCatalog.googleUrl, "", "Custom font continues to override Google catalog font of same family");
ok(customWinsOverCatalog.css.includes("/apps/vsn-builder/font/inter-custom"), "Custom Google-catalog family uses local asset URL");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/fontRuntime.js", "utf8");
const benchmark = fs.readFileSync(".ai/RUNNER_BENCHMARK.md", "utf8");

ok(route.includes('from "../storefront/fontRuntime.js"'), "Builder proxy imports extracted font runtime boundary");
equal((route.match(/vsnFontRuntime\(/g) || []).length, 2, "Fragment and document renderers keep both historical font-runtime calls");
ok(!route.includes("function vsnFontRuntime("), "Builder proxy no longer owns font runtime helper");
for (const marker of [
  'from "../utils/font-runtime.js"',
  'from "../data/font-catalog.js"',
  "collectFontUsages({ elements, globals })",
  "mergeFontUsage(usages, globals.fontFamily",
  "mergeFontUsage(usages, globals.headingFontFamily",
  "String(font.family || \"\").toLowerCase()",
  "JSON.stringify(custom.family)",
  "encodeURIComponent(custom.id)",
  'mime.includes("woff2") ? "woff2"',
  'mime.includes("woff") ? "woff"',
  'mime.includes("otf") || mime.includes("opentype")',
  "!SYSTEM_FONT_FAMILIES.has(key)",
  "buildGoogleFontHref(googleUsages, FALLBACK_GOOGLE_FONTS)",
]) {
  ok(source.includes(marker), `Font runtime boundary marker missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "session.",
  "Response(",
  "renderNode",
  "shopify.server",
  "process.env",
  "document.",
  "window.",
]) {
  ok(!source.includes(forbidden), `Font runtime boundary gained unrelated authority: ${forbidden}`);
}

for (const marker of [
  "Issue: #76",
  "Current runner inventory",
  "Deferred benchmark backlog",
  "Required protected security/quality checks are **not** deferred",
  "Audit post-Playwright dependency state",
  "duplicate push + pull_request runs",
  "Playwright browser cache reuse",
  "dedicated runner-optimization milestone",
]) {
  ok(benchmark.includes(marker), `Runner benchmark plan marker missing: ${marker}`);
}

console.log(`VSN P1.6m storefront font runtime audit: PASS (${checks}/${checks})`);
