import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const canvasPath = path.join(root, "app/components/editor/Canvas.jsx");
const schemaPath = path.join(root, "app/builder/interactionSchema.js");
const canvas = fs.readFileSync(canvasPath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");

assert.match(schema, /export\s+function\s+isStickyEnabledForDevice\s*\(/, "interactionSchema must export isStickyEnabledForDevice");
assert.match(
  canvas,
  /import\s*\{[^}]*\bisStickyEnabledForDevice\b[^}]*\}\s*from\s*['\"]\.\.\/\.\.\/builder\/interactionSchema\.js['\"]/s,
  "Canvas must import isStickyEnabledForDevice from interactionSchema.js"
);
assert.match(canvas, /\bisStickyEnabledForDevice\s*\(\s*interactions\s*,\s*previewMode\s*\)/, "Canvas sticky runtime must use device-aware helper");
assert.match(schema, /export\s+function\s+calculateBoundedStickyShift\s*\(/, "interactionSchema must export calculateBoundedStickyShift");
assert.match(canvas, /\bcalculateBoundedStickyShift\s*\(/, "Canvas bounded sticky runtime must call calculateBoundedStickyShift");
assert.match(canvas, /prefers-reduced-motion[\s\S]{0,600}updateBoundedSticky\(root\)/, "Reduced-motion mode must not disable Sticky positioning");

const importBlock = canvas.match(/import\s*\{([^}]*)\}\s*from\s*['\"]\.\.\/\.\.\/builder\/interactionSchema\.js['\"]/s)?.[1] || "";
const names = new Set(importBlock.split(',').map(v => v.trim()).filter(Boolean));
for (const required of ["interactionEditorStyle", "normalizeElementInteractions", "isStickyEnabledForDevice", "calculateBoundedStickyShift"]) {
  assert.ok(names.has(required), `Canvas interaction import missing ${required}`);
}

console.log("HOTFIX sticky import audit: PASS");
