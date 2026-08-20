import assert from "node:assert/strict";
import fs from "node:fs";
import {
  humanizeControlValue,
  normalizeColorCapabilities,
  normalizeControlOptions,
  resolveColorMode,
  FIELD_TYPE_CAPABILITIES,
} from "../app/builder/controlSchema.js";
import { buildNodeStyle } from "../app/builder/styleEngine.js";
import { buildWidgetSpecificCss } from "../app/builder/widgetSpecificStyleEngine.js";

assert.equal(humanizeControlValue("flex-start"), "Start");
assert.equal(humanizeControlValue("space-between"), "Space Between");
assert.equal(humanizeControlValue("row-reverse"), "Row Reverse");
assert.equal(humanizeControlValue("no-repeat"), "No Repeat");
assert.equal(humanizeControlValue("optimizeLegibility"), "Optimize Legibility");
assert.deepEqual(normalizeControlOptions(["flex-start", { value: "flex-end", label: "Finish" }]), [
  { value: "flex-start", label: "Start" },
  { value: "flex-end", label: "Finish" },
]);

assert.deepEqual(normalizeColorCapabilities(undefined, { solidOnly: true }), { solid: true, gradient: false });
assert.deepEqual(normalizeColorCapabilities(undefined, { gradientOnly: true }), { solid: false, gradient: true });
assert.equal(resolveColorMode({ type: "gradient" }, { solid: true, gradient: false }), "color");
assert.equal(resolveColorMode({ type: "color" }, { solid: false, gradient: true }), "gradient");
assert.equal(FIELD_TYPE_CAPABILITIES.color.toggleable, true);
assert.deepEqual(FIELD_TYPE_CAPABILITIES.color.color, { solid: true, gradient: true });

const disabledBackground = buildNodeStyle({
  backgroundColor: "#ff0000",
  backgroundImage: "url(legacy.png)",
  background: { enabled: false, type: "color", color: "#00ff00" },
});
assert.equal(disabledBackground.backgroundColor, undefined);
assert.equal(disabledBackground.backgroundImage, undefined);

const enabledGradient = buildNodeStyle({
  background: { enabled: true, type: "gradient", from: "#ffffff", to: "#000000", angle: 90 },
});
assert.match(enabledGradient.backgroundImage || "", /linear-gradient\(90deg/);

const disabledWidgetBackgroundCss = buildWidgetSpecificCss("button", "fix1-button", {
  button: { background: { enabled: false, type: "color", color: "#ff0000" } },
});
assert.ok(!disabledWidgetBackgroundCss.includes("#ff0000"));

const editorControls = fs.readFileSync("app/components/editor/EditorControls.jsx", "utf8");
const properties = fs.readFileSync("app/components/editor/PropertiesPanel.jsx", "utf8");
const widgetControls = fs.readFileSync("app/components/editor/WidgetSpecificStyleControls.jsx", "utf8");
const colorStudio = fs.readFileSync("app/components/editor/color/ColorStudio.jsx", "utf8");
assert.ok(editorControls.includes("normalizeControlOptions(options)"), "Central human-readable option normalizer missing");
assert.ok(editorControls.includes('solidOnly label="Text color"'), "Text color must be solid-only");
assert.ok(editorControls.includes('gradientOnly label="Gradient"'), "Gradient-only background control missing");
assert.ok(editorControls.includes('label="Enable background"'), "Background ON/OFF control missing");
assert.ok(properties.includes("ColorGradientControl solidOnly"), "Legacy property colors must be solid-only");
assert.ok(widgetControls.includes("ColorGradientControl toggleable"), "Widget color/background ON/OFF controls missing");
assert.ok(colorStudio.includes("showModeTabs"), "ColorStudio mode capability gating missing");

console.log("FIX-1 control schema, color modes, toggles and human-readable labels: PASS");
