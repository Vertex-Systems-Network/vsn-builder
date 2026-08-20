import assert from "node:assert/strict";
import fs from "node:fs";
import { buildNodeStyle, styleObjectToCssDeclarations } from "../app/builder/styleEngine.js";
import { auditStyleShape, normalizeStyleShape, STYLE_SCHEMA_VERSION } from "../app/builder/styleSchema.js";

assert.equal(STYLE_SCHEMA_VERSION, 1);
const legacy = normalizeStyleShape({ customCss: "selector{color:red}", overflowHidden: true, layout: null });
assert.equal(legacy.advanced.customCss, "selector{color:red}");
assert.equal(legacy.advanced.overflowHidden, true);
assert.deepEqual(legacy.layout, {});
assert.equal(auditStyleShape({ layout: "broken" }).valid, false);

const style = buildNodeStyle({
  layout: {
    direction: "rtl",
    writingMode: "vertical-rl",
    clipPath: "circle(50%)",
    contain: "layout",
    contentVisibility: "auto",
    containIntrinsicSize: "480px",
    willChange: "transform, opacity",
    breakBefore: "column",
    breakInside: "avoid",
    breakAfter: "page",
    columnCount: 3,
    columnWidth: "18rem",
    columnFill: "balance",
    columnRuleWidth: "1px",
    columnRuleStyle: "solid",
    columnRuleColor: "#d1d5db",
  },
  interaction: {
    appearance: "none",
    resize: "both",
    accentColor: "#95BF47",
    caretColor: "#111111",
  },
  scroll: {
    scrollSnapType: "x mandatory",
    scrollSnapStop: "always",
    scrollbarGutter: "stable both-edges",
    overscrollBehaviorX: "contain",
    overscrollBehaviorY: "none",
  },
});

const css = styleObjectToCssDeclarations(style);
for (const token of [
  "direction:rtl",
  "writing-mode:vertical-rl",
  "clip-path:circle(50%)",
  "contain:layout",
  "content-visibility:auto",
  "contain-intrinsic-size:480px",
  "will-change:transform, opacity",
  "break-before:column",
  "break-inside:avoid",
  "break-after:page",
  "column-count:3",
  "column-width:18rem",
  "column-rule-color:#d1d5db",
  "appearance:none",
  "resize:both",
  "accent-color:#95BF47",
  "caret-color:#111111",
  "scroll-snap-type:x mandatory",
  "scroll-snap-stop:always",
  "scrollbar-gutter:stable both-edges",
  "overscroll-behavior-x:contain",
  "overscroll-behavior-y:none",
]) assert.ok(css.includes(token), `missing ${token}`);

const advanced = fs.readFileSync("app/components/editor/AdvancedBuilderControls.jsx", "utf8");
for (const label of ["Flow & Performance", "Content visibility", "Clip path", "Column count", "Accent color", "Snap type", "Scrollbar gutter"]) {
  assert.ok(advanced.includes(label), `Advanced control missing: ${label}`);
}
const editorControls = fs.readFileSync("app/components/editor/EditorControls.jsx", "utf8");
for (const property of ["content-visibility", "contain-intrinsic-size", "clip-path", "scrollbar-gutter", "writing-mode"]) {
  assert.ok(editorControls.includes(property), `CSS autocomplete missing: ${property}`);
}

console.log("Batch CSS-1 global engine audit PASS");
