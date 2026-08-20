import fs from "node:fs";
import assert from "node:assert/strict";
import { buildNodeStyle, styleObjectToCssDeclarations } from "../app/builder/styleEngine.js";
import { buildNodeScopedCss, buildResponsiveTreeCss } from "../app/builder/stylePipeline.js";
import { widgetRegistry } from "../app/builder/widgetRegistry.js";
import { auditWidgetCapabilityCoverage } from "../app/builder/widgetCapabilities.js";
import { auditWidgetStyleProfiles } from "../app/builder/widgetStyleProfiles.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(`${root}/${file}`, "utf8");

// 1) Global style engine: exercise every exposed global style family with non-default values.
const comprehensive = {
  typography: {
    fontFamily: '"Inter", sans-serif', fontSize: "19px", fontWeight: "700", fontStyle: "italic",
    lineHeight: "1.55", letterSpacing: "0.2px", wordSpacing: "1px", textTransform: "uppercase",
    textAlign: "center", color: "#336699", opacity: 0.5,
    textDecorationLine: "underline", textDecorationStyle: "wavy", textDecorationColor: "#aa0033",
    textDecorationThickness: "2px", textUnderlineOffset: "3px", whiteSpace: "pre-wrap",
    wordBreak: "break-word", overflowWrap: "anywhere", hyphens: "auto", textOverflow: "ellipsis",
    textIndent: "12px", lineClamp: 3,
  },
  background: {
    enabled: true, type: "gradient", gradientType: "linear", angle: 120,
    stops: [{ color: "#112233", position: 0, opacity: 1 }, { color: "#ddeeff", position: 100, opacity: 0.6 }],
    size: "contain", position: "20% 30%", repeat: "repeat-x", attachment: "fixed", blendMode: "multiply",
  },
  border: {
    widths: { top: "1px", right: "2px", bottom: "3px", left: "4px" },
    styles: { top: "solid", right: "dashed", bottom: "dotted", left: "double" },
    colors: { top: "#112112", right: "#222222", bottom: "#333333", left: "#444444" },
    radii: { topLeft: "5px", topRight: "6px", bottomRight: "7px", bottomLeft: "8px" },
    outline: { width: "2px", style: "solid", color: "#95bf47", offset: "3px" },
  },
  spacing: {
    marginTop: "1px", marginRight: "2px", marginBottom: "3px", marginLeft: "4px",
    paddingTop: "5px", paddingRight: "6px", paddingBottom: "7px", paddingLeft: "8px",
  },
  size: { width: "91%", height: "210px", minWidth: "11px", minHeight: "12px", maxWidth: "1200px", maxHeight: "900px", boxSizing: "border-box" },
  effects: {
    boxShadow: { enabled: true, x: 1, y: 2, blur: 3, spread: 4, color: "rgba(0,0,0,.2)" },
    textShadow: { enabled: true, x: 2, y: 3, blur: 4, color: "rgba(0,0,0,.3)" },
    textStroke: { enabled: true, width: 1.5, color: "#123123" },
    filters: { blur: 2, brightness: 110, contrast: 90, saturate: 120, hueRotate: 15, grayscale: 10, sepia: 12, invert: 5, opacity: 75, dropShadow: "0 1px 2px rgba(0,0,0,.2)" },
    backdropFilters: { blur: 4, brightness: 105, contrast: 95, saturate: 115, hueRotate: 10, grayscale: 6, sepia: 7 },
    opacity: "35%", mixBlendMode: "multiply", isolation: "isolate",
  },
  layout: {
    position: "absolute", top: "1px", right: "2px", bottom: "3px", left: "4px", zIndex: 7,
    aspectRatio: "16 / 9", objectFit: "cover", objectPosition: "30% 40%", verticalAlign: "middle",
    display: "grid", visibility: "visible", overflow: "auto", overflowX: "hidden", overflowY: "scroll",
    flexGrow: 2, flexShrink: 0, flexBasis: "40%", order: 3, alignSelf: "center", flexDirection: "row-reverse", flexWrap: "wrap",
    justifyContent: "space-between", alignItems: "center", alignContent: "space-around", gap: "9px", rowGap: "10px", columnGap: "11px",
    gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "auto 1fr", gridAutoFlow: "column", gridAutoColumns: "minmax(0,1fr)", gridAutoRows: "auto", justifyItems: "center",
    direction: "rtl", writingMode: "vertical-rl", clipPath: "inset(1px)", contain: "layout", contentVisibility: "auto", containIntrinsicSize: "400px", willChange: "transform, opacity",
    breakBefore: "page", breakAfter: "column", breakInside: "avoid", columnCount: 2, columnWidth: "240px", columnFill: "balance", columnRuleWidth: "1px", columnRuleStyle: "solid", columnRuleColor: "#999999",
  },
  transform: { translateX: "10px", translateY: "11px", translateZ: "12px", perspective: "600px", rotateX: "3deg", rotateY: "4deg", rotateZ: "5deg", skewX: "6deg", skewY: "7deg", scaleX: 1.1, scaleY: 0.9, origin: "25% 75%", perspectiveOrigin: "40% 60%" },
  transition: [
    { property: "transform", duration: "180ms", timingFunction: "ease-in-out", delay: "10ms" },
    { property: "opacity", duration: "90ms", timingFunction: "linear", delay: "0ms" },
  ],
  interaction: { cursor: "pointer", pointerEvents: "auto", userSelect: "none", touchAction: "pan-y", appearance: "none", resize: "both", accentColor: "#95bf47", caretColor: "#112112" },
  scroll: {
    scrollBehavior: "smooth", scrollSnapAlign: "center", scrollSnapType: "x mandatory", scrollSnapStop: "always", scrollbarGutter: "stable both-edges",
    overscrollBehavior: "contain", overscrollBehaviorX: "none", overscrollBehaviorY: "contain",
    scrollMarginTop: "1px", scrollMarginRight: "2px", scrollMarginBottom: "3px", scrollMarginLeft: "4px",
    scrollPaddingTop: "5px", scrollPaddingRight: "6px", scrollPaddingBottom: "7px", scrollPaddingLeft: "8px",
  },
  advanced: { cssVariables: [{ name: "--vsn-fix7-audit", value: "42px" }] },
};

const style = buildNodeStyle(comprehensive);
const expected = {
  fontFamily: '"Inter", sans-serif', fontSize: "19px", fontWeight: "700", fontStyle: "italic", lineHeight: "1.55",
  letterSpacing: "0.2px", wordSpacing: "1px", textTransform: "uppercase", textAlign: "center", color: "rgba(51,102,153,0.5)",
  textDecorationLine: "underline", textDecorationStyle: "wavy", textDecorationColor: "#aa0033", textDecorationThickness: "2px", textUnderlineOffset: "3px",
  whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", hyphens: "auto", textOverflow: "ellipsis", textIndent: "12px",
  WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
  backgroundSize: "contain", backgroundPosition: "20% 30%", backgroundRepeat: "repeat-x", backgroundAttachment: "fixed", backgroundBlendMode: "multiply",
  borderTopWidth: "1px", borderRightWidth: "2px", borderBottomWidth: "3px", borderLeftWidth: "4px",
  borderTopStyle: "solid", borderRightStyle: "dashed", borderBottomStyle: "dotted", borderLeftStyle: "double",
  borderTopColor: "#112112", borderRightColor: "#222222", borderBottomColor: "#333333", borderLeftColor: "#444444",
  borderTopLeftRadius: "5px", borderTopRightRadius: "6px", borderBottomRightRadius: "7px", borderBottomLeftRadius: "8px", outline: "2px solid #95bf47", outlineOffset: "3px",
  marginTop: "1px", marginRight: "2px", marginBottom: "3px", marginLeft: "4px", paddingTop: "5px", paddingRight: "6px", paddingBottom: "7px", paddingLeft: "8px",
  width: "91%", height: "210px", minWidth: "11px", minHeight: "12px", maxWidth: "1200px", maxHeight: "900px", boxSizing: "border-box",
  opacity: 0.35, mixBlendMode: "multiply", isolation: "isolate",
  position: "absolute", top: "1px", right: "2px", bottom: "3px", left: "4px", zIndex: 7, aspectRatio: "16 / 9", objectFit: "cover", objectPosition: "30% 40%", verticalAlign: "middle",
  display: "grid", visibility: "visible", overflow: "auto", overflowX: "hidden", overflowY: "scroll", flexGrow: 2, flexShrink: 0, flexBasis: "40%", order: 3,
  alignSelf: "center", flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", alignContent: "space-around", gap: "9px", rowGap: "10px", columnGap: "11px",
  gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "auto 1fr", gridAutoFlow: "column", gridAutoColumns: "minmax(0,1fr)", gridAutoRows: "auto", justifyItems: "center",
  direction: "rtl", writingMode: "vertical-rl", clipPath: "inset(1px)", contain: "layout", contentVisibility: "auto", containIntrinsicSize: "400px", willChange: "transform, opacity",
  breakBefore: "page", breakAfter: "column", breakInside: "avoid", columnCount: 2, columnWidth: "240px", columnFill: "balance", columnRuleWidth: "1px", columnRuleStyle: "solid", columnRuleColor: "#999999",
  transformOrigin: "25% 75%", perspectiveOrigin: "40% 60%",
  cursor: "pointer", pointerEvents: "auto", userSelect: "none", touchAction: "pan-y", appearance: "none", resize: "both", accentColor: "#95bf47", caretColor: "#112112",
  scrollBehavior: "smooth", scrollSnapAlign: "center", scrollSnapType: "x mandatory", scrollSnapStop: "always", scrollbarGutter: "stable both-edges", overscrollBehavior: "contain", overscrollBehaviorX: "none", overscrollBehaviorY: "contain",
  scrollMarginTop: "1px", scrollMarginRight: "2px", scrollMarginBottom: "3px", scrollMarginLeft: "4px", scrollPaddingTop: "5px", scrollPaddingRight: "6px", scrollPaddingBottom: "7px", scrollPaddingLeft: "8px",
  "--vsn-fix7-audit": "42px",
};
for (const [key, value] of Object.entries(expected)) assert.equal(style[key], value, `Global CSS control failed: ${key}`);
assert.match(style.backgroundImage || "", /linear-gradient\(120deg/);
assert.match(style.boxShadow || "", /1px 2px 3px 4px/);
assert.match(style.textShadow || "", /2px 3px 4px/);
assert.equal(style.WebkitTextStroke, "1.5px #123123");
for (const part of ["blur(2px)", "brightness(110%)", "contrast(90%)", "saturate(120%)", "hue-rotate(15deg)", "grayscale(10%)", "sepia(12%)", "invert(5%)", "opacity(75%)", "drop-shadow("]) assert.ok(style.filter.includes(part), `Filter output missing ${part}`);
for (const part of ["blur(4px)", "brightness(105%)", "contrast(95%)", "saturate(115%)", "hue-rotate(10deg)", "grayscale(6%)", "sepia(7%)"]) assert.ok(style.backdropFilter.includes(part), `Backdrop output missing ${part}`);
assert.equal(style.backdropFilter, style.WebkitBackdropFilter);
for (const part of ["perspective(600px)", "translate3d(10px, 11px, 12px)", "rotateX(3deg)", "rotateY(4deg)", "rotateZ(5deg)", "skewX(6deg)", "skewY(7deg)", "scale(1.1, 0.9)"]) assert.ok(style.transform.includes(part), `Transform output missing ${part}`);
assert.ok(style.transition.includes("transform 180ms ease-in-out 10ms"));
assert.ok(style.transition.includes("opacity 90ms linear 0ms"));

// Explicit OFF must win over old/legacy shadow/background values.
const disabled = buildNodeStyle({
  backgroundColor: "#ff0000", backgroundImage: "url(old.png)", boxShadow: "0 0 1px red", textShadow: "0 0 1px red",
  background: { enabled: false, type: "color", color: "#00ff00" },
  effects: { boxShadow: { enabled: false }, textShadow: { enabled: false } },
});
assert.equal(disabled.backgroundColor, undefined, "Disabled background leaked legacy background color");
assert.equal(disabled.backgroundImage, undefined, "Disabled background leaked legacy background image");
assert.equal(disabled.boxShadow, "none", "Disabled box shadow did not override legacy shadow");
assert.equal(disabled.textShadow, "none", "Disabled text shadow did not override legacy shadow");

// Opacity compatibility: old numeric percentages, CSS percentages and alpha values must converge.
assert.equal(buildNodeStyle({ effects: { opacity: 50 } }).opacity, 0.5);
assert.equal(buildNodeStyle({ effects: { opacity: "50%" } }).opacity, 0.5);
assert.equal(buildNodeStyle({ effects: { opacity: 0.5 } }).opacity, 0.5);
assert.equal(buildNodeStyle({ effects: { opacity: "0%" } }).opacity, 0);

const declarations = styleObjectToCssDeclarations(style);
assert.ok(declarations.includes("font-family:"));
assert.ok(declarations.includes("--vsn-fix7-audit:42px"));
assert.ok(!declarations.includes("[object Object]"));
assert.ok(!declarations.includes("undefined"));

const node = { id: "fix7-node", type: "text", props: {}, styles: comprehensive, responsive: { tablet: { styles: { effects: { opacity: "40%" } } }, mobile: { styles: { typography: { color: "#ff0000", opacity: 0.25 } } } }, children: [] };
const scoped = buildNodeScopedCss(node, { includeBase: true });
assert.ok(scoped.includes('[data-vsn-id="fix7-node"]'));
assert.ok(scoped.includes("opacity:0.35"));
const responsive = buildResponsiveTreeCss([node], { mobileBreakpoint: 749, tabletBreakpoint: 989 });
assert.ok(responsive.includes("@media"));
assert.ok(responsive.includes("opacity:0.4"), "Responsive opacity did not serialize through shared engine");
assert.ok(responsive.includes("rgba(255,0,0,0.25)"), "Responsive typography alpha did not serialize through shared engine");

// 2) All widget-specific style controls must have a serializer target.
const widgetControlSource = read("app/components/editor/WidgetSpecificStyleControls.jsx");
const widgetEngineSource = read("app/builder/widgetSpecificStyleEngine.js");
const pairMap = new Map();
const patchPattern = /patch\("([A-Za-z0-9_]+)"\s*,\s*\{([^{}]*)\}\)/g;
for (const match of widgetControlSource.matchAll(patchPattern)) {
  const group = match[1];
  const body = match[2];
  const keys = [...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g)].map((item) => item[1]);
  if (!keys.length) {
    const shorthand = body.trim().match(/^([A-Za-z_$][\w$]*)$/);
    if (shorthand) keys.push(shorthand[1]);
  }
  for (const key of keys) pairMap.set(`${group}.${key}`, { group, key });
}
const widgetPairs = [...pairMap.values()];
assert.ok(widgetPairs.length >= 490, `Expected at least 490 widget-specific style control bindings, found ${widgetPairs.length}`);
for (const { group, key } of widgetPairs) {
  assert.ok(widgetEngineSource.includes(`widgetStyles.${group}`), `Widget style group has no serializer target: ${group}`);
  assert.ok(new RegExp(`\\b${key.replace(/[$]/g, "\\$")}\\b`).test(widgetEngineSource), `Widget style option has no serializer property: ${group}.${key}`);
}

// 3) Collection Product Grid's legacy style controls must have Canvas/Preview/storefront parity.
const propertiesSource = read("app/components/editor/PropertiesPanel.jsx");
const canvasSource = read("app/components/editor/Canvas.jsx");
const previewSource = read("app/components/editor/PreviewRenderer.jsx");
const storefrontSource = read("app/routes/builder-proxy.$.jsx");
for (const section of ["grid", "card", "image", "titleTypography", "priceTypography", "comparePriceTypography", "loadMoreButton"]) {
  assert.ok(propertiesSource.includes(`styles.${section}`) || propertiesSource.includes(`styles?.${section}`), `Collection control section missing in Properties: ${section}`);
  assert.ok(canvasSource.includes(`node.styles?.${section}`) || canvasSource.includes(`node.styles\n`), `Collection style section missing in Canvas: ${section}`);
  assert.ok(previewSource.includes(`rawStyles?.${section}`), `Collection style section missing in Preview: ${section}`);
  assert.ok(storefrontSource.includes(`styles?.${section}`), `Collection style section missing in storefront: ${section}`);
}
assert.ok(previewSource.includes("vsn-load-more-button"), "Load More control has no Preview visual target");
assert.ok(storefrontSource.includes("titleTypographyCss"), "Product title typography still hardcoded in storefront");
assert.ok(storefrontSource.includes("priceTypographyCss"), "Product price typography still hardcoded in storefront");
assert.ok(storefrontSource.includes("comparePriceTypographyCss"), "Compare price typography still hardcoded in storefront");

// Product-only legacy CSS sections must not appear for unrelated widgets.
const productTitleSection = propertiesSource.indexOf('<SectionHeader title="Product Title">');
const productGuard = propertiesSource.lastIndexOf('selectedElement.type === "collection-product-grid"', productTitleSection);
assert.ok(productGuard >= 0 && productTitleSection - productGuard < 250, "Product Title CSS controls are not guarded by collection-product-grid type");

// 4) Regression guards for the concrete silent failures fixed in FIX-7.
const editorControlsSource = read("app/components/editor/EditorControls.jsx");
const advancedSource = read("app/components/editor/AdvancedBuilderControls.jsx");
assert.ok(editorControlsSource.includes("color: next.color, opacity: next.opacity"), "Typography color/opacity atomic update guard missing");
assert.ok(!advancedSource.includes('patch("effects",{opacity:Number(opacity)})'), "State opacity still stores invalid 0-100 numeric CSS opacity");
assert.ok(advancedSource.includes('opacity:`${opacity}%`'), "State opacity percent serialization missing");
assert.ok(!advancedSource.includes('parseFloat(String(effects.opacity ?? "100").replace("%","")) || 100'), "Opacity zero regression still present in Advanced controls");
assert.ok(!propertiesSource.includes('parseFloat(String(styles.effects?.opacity ?? "100").replace("%", "")) || 100'), "Opacity zero regression still present in Properties controls");

// 5) Existing complete registry/profile contracts remain intact.
const types = Object.keys(widgetRegistry);
assert.equal(types.length, 117, `Expected 117 widgets, found ${types.length}`);
const capabilityAudit = auditWidgetCapabilityCoverage(types);
const profileAudit = auditWidgetStyleProfiles(types);
assert.equal(capabilityAudit.covered, 117, "Widget capability coverage regressed");
assert.equal(profileAudit.profiled, 117, "Widget style profile coverage regressed");

console.log(`FIX-7 global CSS properties asserted: ${Object.keys(expected).length}`);
console.log(`FIX-7 widget-specific control bindings linked: ${widgetPairs.length}`);
console.log(`FIX-7 widgets/profile coverage: ${types.length}/${types.length}`);
console.log("FIX-7 collection Canvas/Preview/storefront legacy CSS parity: PASS");
console.log("FIX-7 CSS application audit: PASS");
