import fs from "node:fs";
import assert from "node:assert/strict";
import { normalizeElementInteractions, mergeElementInteractions, interactionEditorStyle } from "../app/builder/interactionSchema.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const defaults = normalizeElementInteractions();
assert.equal(defaults.entrance, "none");
assert.equal(defaults.hover, "none");
assert.equal(defaults.sticky, false);
assert.equal(defaults.parallax, false);
assert.equal(normalizeElementInteractions(true).sticky, false);
assert.equal(normalizeElementInteractions("bad").parallax, false);
assert.equal(normalizeElementInteractions({ sticky: 1 }).sticky, false);
assert.equal(normalizeElementInteractions({ sticky: true }).sticky, true);
const merged = mergeElementInteractions({ entrance: "fade-up", sticky: true }, { parallax: true });
assert.equal(merged.entrance, "fade-up");
assert.equal(merged.hover, "none");
assert.equal(merged.sticky, true);
assert.equal(merged.parallax, true);
assert.equal(interactionEditorStyle({ sticky: true }).position, "relative");
assert.match(interactionEditorStyle({ sticky: true }).translate, /vsn-editor-sticky-y/);
assert.match(interactionEditorStyle({ parallax: true }).translate, /vsn-editor-parallax-y/);

const registry = read("app/builder/widgetRegistry.js");
assert.match(registry, /interactions:\s*structuredClone\(DEFAULT_ELEMENT_INTERACTIONS\)/);

const properties = read("app/components/editor/PropertiesPanel.jsx");
assert.match(properties, /normalizeElementInteractions\(selectedElement\?\.interactions\)/);
assert.match(properties, /mergeElementInteractions\(selectedElement\.interactions, patch\)/);
assert.match(properties, /checked=\{interactions\.sticky\}/);
assert.match(properties, /checked=\{interactions\.parallax\}/);

const pageEditor = read("app/components/editor/PageEditor.jsx");
assert.match(pageEditor, /mergeElementInteractions\(node\.interactions, patch\.interactions\)/);

const canvas = read("app/components/editor/Canvas.jsx");
assert.match(canvas, /data-vsn-sticky-element=\{interactions\.sticky/);
assert.match(canvas, /data-vsn-parallax=\{interactions\.parallax/);
assert.match(canvas, /canvasInteractionResetKey/);
assert.match(canvas, /--vsn-editor-parallax-(?:source|y)/);
assert.match(canvas, /prefers-reduced-motion/);

const sidebar = read("app/components/editor/ElementsSidebar.jsx");
assert.match(sidebar, /EditorRecoveryBoundary/);
assert.match(sidebar, /selectedElement\?\.interactions/);

const proxy = read("app/routes/builder-proxy.$.jsx");
assert.match(proxy, /normalizeElementInteractions\(node\?\.interactions \|\| \{\}\)/);
assert.match(proxy, /data-vsn-sticky-element="1"/);
assert.match(proxy, /data-vsn-parallax="1"/);

const renderer = read("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js");
assert.match(renderer, /\.vsn-sticky-element\{position:relative/);
assert.match(renderer, /querySelectorAll\("\[data-vsn-parallax='1'\]"\)/);
assert.match(renderer, /prefers-reduced-motion/);

console.log("FIX-2 interactions audit PASS");
