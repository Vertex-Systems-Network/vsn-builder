import fs from "node:fs";
import assert from "node:assert/strict";
import { widgetRegistry } from "../app/builder/widgetRegistry.js";
import { auditWidgetCapabilityCoverage, getWidgetCapabilities } from "../app/builder/widgetCapabilities.js";
import { auditWidgetStyleProfiles, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";
import { normalizeStyleShape, auditStyleShape } from "../app/builder/styleSchema.js";
import {
  applyResponsiveNode,
  buildNodeScopedCss,
  buildResponsiveTreeCss,
  buildStyleBundleCss,
  sanitizeCustomCss,
} from "../app/builder/stylePipeline.js";
import {
  collectCustomJsEntries,
  collectCustomJsGroups,
  customJsSignature,
  validateCustomJs,
} from "../app/builder/customCode.js";

const types = Object.keys(widgetRegistry);
assert.equal(types.length, 117, `Expected 117 registered widgets, found ${types.length}`);

const capabilityAudit = auditWidgetCapabilityCoverage(types);
assert.equal(capabilityAudit.covered, types.length, `Capability coverage ${capabilityAudit.covered}/${types.length}`);
assert.deepEqual(capabilityAudit.missing, []);
const profileAudit = auditWidgetStyleProfiles(types);
assert.equal(profileAudit.profiled, types.length, `Style profile coverage ${profileAudit.profiled}/${types.length}`);

const commonStyles = {
  typography: { color: "#123456", fontSize: "1.125rem", lineHeight: "1.5" },
  background: { type: "color", color: "#ffffff" },
  border: { width: "1px", style: "solid", color: "#d1d5db", radius: "10px" },
  spacing: { marginTop: "1rem", marginRight: "2vw", marginBottom: "1rem", marginLeft: "2vw", paddingTop: "12px", paddingRight: "14px", paddingBottom: "12px", paddingLeft: "14px", gap: "1rem" },
  size: { width: "min(100%, 72rem)", minWidth: "0px", maxWidth: "1200px", minHeight: "1px" },
  layout: { position: "relative", zIndex: "2", overflowX: "visible", overflowY: "visible" },
  effects: { opacity: "0.98" },
  transform: { translateX: "0px", translateY: "0px", scaleX: "1", scaleY: "1" },
  transition: [{ property: "all", duration: "180ms", timing: "ease", delay: "0ms" }],
  interaction: { cursor: "default", userSelect: "auto" },
  scroll: { behavior: "smooth" },
  advanced: {
    customCss: "selector .css6-child { color: rgb(1, 2, 3); }\n@import url('https://bad.invalid/a.css');",
    customJs: "element.dataset.css6 = 'ready';",
  },
  states: { hover: { typography: { color: "#654321" }, transition: { property: "color", duration: "120ms", timing: "ease" } } },
};

const stressNodes = [];
for (const type of types) {
  const registration = widgetRegistry[type] || {};
  const node = {
    id: `css6-${type}`,
    type,
    props: structuredClone(registration.props || {}),
    styles: { ...structuredClone(registration.styles || {}), ...structuredClone(commonStyles) },
    responsive: {
      desktop: { styles: { size: { maxWidth: "1100px" } }, props: { visible: true } },
      tablet: { styles: { spacing: { paddingLeft: "20px" } } },
      mobile: { styles: { size: { width: "100%" } }, props: { visible: true } },
    },
    children: [],
  };

  const serialized = JSON.stringify(node);
  const reloaded = JSON.parse(serialized);
  assert.equal(reloaded.type, type, `${type}: save/reload changed type`);
  assert.equal(reloaded.styles.advanced.customJs, commonStyles.advanced.customJs, `${type}: save/reload lost Custom JS`);
  assert.equal(reloaded.styles.advanced.customCss, commonStyles.advanced.customCss, `${type}: save/reload lost Custom CSS`);

  const normalized = normalizeStyleShape(reloaded.styles);
  const shape = auditStyleShape(normalized);
  assert.ok(shape.valid, `${type}: invalid normalized style shape: ${shape.errors.join(", ")}`);
  assert.ok(getWidgetCapabilities(type)?.family, `${type}: missing capability family`);
  assert.ok(getWidgetStyleProfile(type)?.family, `${type}: missing style profile family`);

  const css = buildNodeScopedCss(reloaded, { includeBase: true, includeHidden: true });
  assert.ok(css.includes(`[data-vsn-id="css6-${type}"]`), `${type}: scoped CSS missing root selector`);
  assert.ok(css.includes(".css6-child"), `${type}: Custom CSS selector token not scoped`);
  assert.ok(!css.includes("@import"), `${type}: Custom CSS sanitizer allowed @import`);
  assert.ok(!css.includes("[object Object]"), `${type}: object leaked into CSS`);
  assert.ok(!/\bundefined\b/.test(css), `${type}: undefined leaked into CSS`);

  const mobile = applyResponsiveNode(reloaded, "mobile");
  assert.equal(mobile.styles.size.maxWidth, "1100px", `${type}: mobile failed desktop inheritance`);
  assert.equal(mobile.styles.spacing.paddingLeft, "20px", `${type}: mobile failed tablet inheritance`);
  assert.equal(mobile.styles.size.width, "100%", `${type}: mobile override failed`);

  const responsiveCss = buildResponsiveTreeCss([reloaded], { mobileBreakpoint: 749, tabletBreakpoint: 989 }, { important: true });
  assert.ok(responsiveCss.includes("@media"), `${type}: responsive CSS missing media rules`);
  assert.ok(responsiveCss.includes(`[data-vsn-id="css6-${type}"]`), `${type}: responsive CSS missing widget selector`);
  stressNodes.push(reloaded);
}

const bundle = buildStyleBundleCss([stressNodes], { mobileBreakpoint: 749, tabletBreakpoint: 989 }, { includeBase: true, includeResponsive: true, includeHidden: true });
assert.ok(bundle.length > 1000, "115-widget style bundle unexpectedly empty");
assert.ok(!bundle.includes("@import"), "Combined style bundle contains disallowed @import");
assert.ok(!bundle.includes("[object Object]"), "Combined style bundle contains object coercion");

const sanitized = sanitizeCustomCss('<style>selector{color:red}</style>@charset "utf-8";@import url(x);');
assert.ok(!sanitized.includes("<style"));
assert.ok(!sanitized.includes("@charset"));
assert.ok(!sanitized.includes("@import"));

const nested = [{ id: "js-a", type: "button", styles: { advanced: { customJs: "element.dataset.a='1';" } }, children: [
  { id: "js-b", type: "text", styles: { advanced: { customJs: "element.dataset.b='1';" } }, children: [] },
] }];
const jsEntries = collectCustomJsEntries(nested);
assert.equal(jsEntries.length, 2, "Custom JS tree collection failed");
assert.ok(customJsSignature(jsEntries).includes("js-a:"), "Custom JS signature missing entry");
assert.ok(validateCustomJs("element.classList.add('ready')").valid, "Valid Custom JS rejected");
assert.equal(validateCustomJs("if (").valid, false, "Invalid Custom JS accepted");
const groupEntries = collectCustomJsGroups([nested, nested]);
assert.equal(groupEntries.length, 2, "Custom JS group dedupe failed");

const previewSource = fs.readFileSync("app/components/editor/PreviewRenderer.jsx", "utf8");
const storefrontSource = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const nativeTypes = types.filter((type) => !widgetRegistry[type]?.sdk);
const sdkTypes = types.filter((type) => widgetRegistry[type]?.sdk);
for (const type of nativeTypes) {
  const literalDouble = `"${type}"`;
  const literalSingle = `'${type}'`;
  assert.ok(previewSource.includes(literalDouble) || previewSource.includes(literalSingle), `${type}: missing dedicated Preview renderer contract`);
  assert.ok(storefrontSource.includes(literalDouble) || storefrontSource.includes(literalSingle), `${type}: missing storefront renderer contract`);
}
if (sdkTypes.length) {
  const sdkRegistrySource = fs.readFileSync("app/sdk/registry.js", "utf8");
  assert.ok(sdkRegistrySource.includes("renderers"), "SDK widgets require shared dynamic renderer registration");
}
assert.ok(previewSource.includes('case "collection-product-grid"'), "Collection Product Grid dedicated Preview renderer missing");
assert.ok(previewSource.includes("vsn-product-card-title"), "Collection Product Grid Preview semantic card hooks missing");
assert.ok(storefrontSource.includes('case "icon"'), "Icon storefront renderer missing");
assert.ok(storefrontSource.includes("renderContentIconSvg"), "Icon storefront SVG renderer missing");
assert.ok(previewSource.includes("CustomJsRuntime"), "Preview Custom JS runtime missing");
assert.ok(storefrontSource.includes("collectCustomJsGroups"), "Storefront Custom JS shared collection missing");

for (const file of [
  "app/components/editor/Canvas.jsx",
  "app/components/editor/PreviewRenderer.jsx",
  "app/routes/builder-proxy.$.jsx",
]) {
  const text = fs.readFileSync(file, "utf8");
  assert.ok(text.includes("stylePipeline"), `${file}: shared style pipeline missing`);
}

console.log(`Batch CSS-6 exhaustive widget audit: ${types.length}/${types.length}`);
console.log("Save/reload, responsive inheritance, states, Custom CSS, Custom JS, Preview and storefront contracts: PASS");
console.log("Batch CSS-6 audit: PASS");
