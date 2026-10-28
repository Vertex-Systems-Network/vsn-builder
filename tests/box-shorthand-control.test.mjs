import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pure helpers are mirrored here from the source to stay import-free (JSX module).
const source = readFileSync("app/components/editor/BoxShorthandControl.jsx", "utf8");
test("box shorthand control exists and is used for widget box values", () => {
  assert.match(source, /export function BoxShorthandControl/);
  assert.match(source, /export function parseBoxShorthand/);
  const widget = readFileSync("app/components/editor/WidgetSpecificStyleControls.jsx", "utf8");
  assert.ok((widget.match(/<BoxShorthandControl label="(Padding|Border width|Radius)/g) || []).length >= 10);
  assert.doesNotMatch(widget, /<CssLengthControl label="(Padding|Margin|Border width|Radius)"/);
});
