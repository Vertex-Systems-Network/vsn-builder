import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildGoogleFontHref,
  collectFontUsages,
  mergeFontUsage,
  primaryFontFamily,
  SYSTEM_FONT_FAMILIES,
} from "../app/utils/font-runtime.js";
import { FALLBACK_GOOGLE_FONTS, SYSTEM_FONTS } from "../app/data/font-catalog.js";

assert.equal(primaryFontFamily("'Poppins', sans-serif"), "Poppins");
assert.equal(SYSTEM_FONT_FAMILIES.has("inter"), false, "Inter must be loaded, not treated as an installed system font");
assert.equal(SYSTEM_FONTS.some((font) => font.family === "Inter"), false, "Inter must not be exposed under System Fonts");
assert.equal(FALLBACK_GOOGLE_FONTS.some((font) => font.family === "Inter"), true, "Inter must be available in Google Fonts fallback catalog");

const usages = collectFontUsages({
  node: { styles: { typography: { fontFamily: "'Inter', sans-serif", fontWeight: "700", fontStyle: "italic" } } },
  other: { styles: { typography: { fontFamily: "'Poppins', sans-serif", fontWeight: "600" } } },
});
assert.deepEqual([...usages.get("inter").weights], [700]);
assert.deepEqual([...usages.get("inter").styles], ["italic"]);
assert.deepEqual([...usages.get("poppins").weights], [600]);

const interHref = buildGoogleFontHref(new Map([["inter", usages.get("inter")]]), FALLBACK_GOOGLE_FONTS);
assert.match(interHref, /family=Inter:ital,wght@1,700/);
assert.match(interHref, /display=swap/);

const merged = new Map();
mergeFontUsage(merged, "Inter, system-ui, sans-serif", { weights: [400, 700], styles: ["normal", "italic"] });
const mergedHref = buildGoogleFontHref(merged, FALLBACK_GOOGLE_FONTS);
assert.match(mergedHref, /0,400/);
assert.match(mergedHref, /0,700/);
assert.match(mergedHref, /1,400/);
assert.match(mergedHref, /1,700/);

const registry = fs.readFileSync("app/components/editor/fonts/FontRegistryContext.jsx", "utf8");
assert.match(registry, /googleUsageRef/);
assert.match(registry, /buildGoogleFontHref/);
assert.match(registry, /mergeFontUsage/);
assert.match(registry, /data\.vsnRuntimeFont|dataset\.vsnRuntimeFont/);
assert.match(registry, /font-weight:\$\{custom\.weight \|\| 400\}/);
assert.match(registry, /font-style:\$\{custom\.style \|\| "normal"\}/);

const pageEditor = fs.readFileSync("app/components/editor/PageEditor.jsx", "utf8");
assert.match(pageEditor, /collectFontUsages\(\{ elements, globalStyles \}\)/);
assert.match(pageEditor, /weights: \[\.\.\.usage\.weights\]/);
assert.match(pageEditor, /styles: \[\.\.\.usage\.styles\]/);

const fontControl = fs.readFileSync("app/components/editor/fonts/FontFamilyControl.jsx", "utf8");
assert.match(fontControl, /fontWeight = 400/);
assert.match(fontControl, /fontStyle = "normal"/);
assert.match(fontControl, /ensureFontLoaded\(value, \{ weight: fontWeight, style: fontStyle \}\)/);

const preview = fs.readFileSync("app/components/editor/PreviewRenderer.jsx", "utf8");
assert.match(preview, /fontFamily:\s*\n\s*style\.fontFamily/);
assert.match(preview, /--vsn-preview-heading-font/);
assert.match(preview, /vsn-preview-root h1/);

const canvas = fs.readFileSync("app/components/editor/Canvas.jsx", "utf8");
assert.match(canvas, /--vsn-canvas-heading-font/);
assert.match(canvas, /vsn-canvas-page h1/);

const proxy = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
assert.match(proxy, /collectFontUsages\(\{ elements, globals \}\)/);
assert.match(proxy, /buildGoogleFontHref\(googleUsages, FALLBACK_GOOGLE_FONTS\)/);
assert.match(proxy, /\/apps\/vsn-builder\/font\/\$\{encodeURIComponent\(custom\.id\)\}/);
assert.doesNotMatch(proxy, /const system = new Set\(\["arial"[^\n]+"inter"/);

const serverRegistry = fs.readFileSync("app/services/font-registry.server.js", "utf8");
assert.match(serverRegistry, /googleVariantMetadata/);
assert.match(serverRegistry, /weights/);
assert.match(serverRegistry, /styles/);

console.log("FIX-5 font loading and typography parity audit PASS");
