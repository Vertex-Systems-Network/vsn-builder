import test from "node:test";
import assert from "node:assert/strict";
import { listGlobalColors, normalizeStyleKit, styleKitCss, styleKitVariables } from "../app/builder/styleKit.js";
import { safeColor } from "../app/storefront/safeCss.js";
import { globalCssVariables } from "../app/builder/globalDesign.js";

test("custom colours get safe ids and cannot shadow system colours", () => {
  const kit = normalizeStyleKit({ customColors: [{ label: "Brand Gold", value: "#c9a227" }, { label: "primary", value: "#000" }, { label: "Bad", value: "red;}body{" }] });
  assert.deepEqual(kit.customColors.map((row) => row.id), ["brand-gold", "bad"]);
  assert.equal(kit.customColors[1].value, "#000000");
});

test("typography presets become CSS variables and zero-specificity rules", () => {
  const vars = styleKitVariables({ typographyPresets: { h2: { fontSize: "52px" } }, primaryColor: "#111111" });
  assert.equal(vars["--vsn-h2-size"], "52px");
  assert.equal(vars["--vsn-h1-size"], "48px");
  assert.equal(vars["--vsn-color-primary"], "#111111");
  assert.equal(globalCssVariables({ typographyPresets: { h3: { fontSize: "30px" } } })["--vsn-h3-size"], "30px");
  const css = styleKitCss("[data-root]");
  assert.match(css, /:where\(\[data-root\]\) :where\(h2\)\{font-size:var\(--vsn-h2-size\)/);
});

test("global colour tokens pass the storefront colour sanitizer, arbitrary var() does not", () => {
  assert.equal(safeColor("var(--vsn-color-brand-gold, #c9a227)", "#000"), "var(--vsn-color-brand-gold, #c9a227)");
  assert.equal(safeColor("var(--other)", "#000"), "#000");
  assert.equal(safeColor("var(--vsn-color-x, red;})", "#000"), "#000");
  assert.ok(listGlobalColors({ primaryColor: "#111" }).some((row) => row.id === "primary"));
});
