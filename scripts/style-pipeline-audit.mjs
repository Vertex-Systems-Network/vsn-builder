import fs from "node:fs";
import assert from "node:assert/strict";
import {
  applyResponsiveNode,
  buildResponsiveTreeCss,
  buildStyleBundleCss,
  buildTreeScopedCss,
  sanitizeCustomCss,
} from "../app/builder/stylePipeline.js";

const sample = {
  id: "phase-e-sample",
  type: "button",
  styles: {
    typography: { color: "#111111" },
    size: { width: "80%" },
    effects: { hoverAnimation: "lift" },
    states: { hover: { typography: { color: "#222222" }, transition: { property: "color", duration: "180ms" } } },
    widget: { button: { borderRadius: "12px", paddingX: "20px", paddingY: "10px" } },
    advanced: { customCss: "selector {\n  --merchant-token: 1;\n}\nselector .child {\n  color: red;\n}" },
  },
  responsive: {
    desktop: { styles: { size: { maxWidth: "1200px" } }, props: { visible: true } },
    tablet: { styles: { spacing: { paddingLeft: "24px" } } },
    mobile: { styles: { size: { width: "100%" } }, props: { visible: false } },
  },
  children: [],
};

const scoped = buildTreeScopedCss([sample], { includeBase: true, includeHidden: true });
assert.match(scoped, /data-vsn-id="phase-e-sample"/);
assert.match(scoped, /color:#111111 !important/);
assert.match(scoped, /--merchant-token: 1/);
assert.match(scoped, /\.child/);
assert.match(scoped, /border-radius:12px !important/);

const mobile = applyResponsiveNode(sample, "mobile");
assert.equal(mobile.styles.size.maxWidth, "1200px", "mobile must inherit desktop responsive values");
assert.equal(mobile.styles.spacing.paddingLeft, "24px", "mobile must inherit tablet responsive values");
assert.equal(mobile.styles.size.width, "100%", "mobile override must win");
assert.equal(mobile.props.visible, false);

const responsive = buildResponsiveTreeCss([sample], { mobileBreakpoint: 749, tabletBreakpoint: 989 }, { important: true });
assert.match(responsive, /@media \(max-width: 749px\)/);
assert.match(responsive, /max-width:1200px !important/);
assert.match(responsive, /padding-left:24px !important/);
assert.match(responsive, /display:none !important/);

const bundle = buildStyleBundleCss([[sample]], { mobileBreakpoint: 749, tabletBreakpoint: 989 }, { includeBase: true, includeResponsive: true });
assert.match(bundle, /@media/);
assert.ok(!/\bselector\b/i.test(bundle), "custom selector token should be resolved");
assert.ok(bundle.includes('[data-vsn-id="phase-e-sample"] .child'));

const sanitized = sanitizeCustomCss('@import url("bad.css");<style>selector{color:red}</style>');
assert.ok(!sanitized.includes("@import"));
assert.ok(!sanitized.includes("<style"));

for (const file of [
  "app/components/editor/Canvas.jsx",
  "app/components/editor/PreviewRenderer.jsx",
  "app/routes/builder-proxy.$.jsx",
]) {
  const text = fs.readFileSync(file, "utf8");
  assert.ok(text.includes("stylePipeline"), `${file} must use shared stylePipeline`);
  assert.ok(!text.includes("function collectAdvancedCss"), `${file} contains legacy collectAdvancedCss`);
  assert.ok(!text.includes("function buildAdvancedCss"), `${file} contains legacy buildAdvancedCss`);
  assert.ok(!text.includes("function buildResponsiveCss"), `${file} contains legacy buildResponsiveCss`);
}

console.log("Phase E style pipeline audit PASS");
