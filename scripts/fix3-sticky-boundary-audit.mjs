import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_ELEMENT_INTERACTIONS, normalizeElementInteractions, mergeElementInteractions, isStickyEnabledForDevice, interactionEditorStyle, calculateBoundedStickyShift } from "../app/builder/interactionSchema.js";

assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyBoundary, "parent");
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyOffset, 12);
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyEndOffset, 0);
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyZIndex, 20);
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyDesktop, true);
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyTablet, true);
assert.equal(DEFAULT_ELEMENT_INTERACTIONS.stickyMobile, true);
assert.equal(normalizeElementInteractions({ sticky: true, stickyBoundary: "bad" }).stickyBoundary, "parent");
assert.equal(normalizeElementInteractions({ sticky: true, stickyOffset: -99 }).stickyOffset, 0);
assert.equal(normalizeElementInteractions({ sticky: true, stickyEndOffset: 2001 }).stickyEndOffset, 1000);
assert.equal(normalizeElementInteractions({ sticky: true, stickyZIndex: "45" }).stickyZIndex, 45);
assert.equal(mergeElementInteractions({ sticky: true, stickyBoundary: "section" }, { stickyOffset: 32 }).stickyBoundary, "section");
assert.equal(isStickyEnabledForDevice({ sticky: true, stickyMobile: false }, "mobile"), false);
assert.equal(isStickyEnabledForDevice({ sticky: true, stickyMobile: false }, "desktop"), true);
assert.match(interactionEditorStyle({ sticky: true }).translate, /vsn-editor-sticky-y/);
assert.equal(calculateBoundedStickyShift({ viewportTop: 0, naturalTop: 100, naturalBottom: 150, boundaryBottom: 500, topOffset: 12 }), 0);
assert.equal(calculateBoundedStickyShift({ viewportTop: 0, naturalTop: -50, naturalBottom: 0, boundaryBottom: 300, topOffset: 12 }), 62);
assert.equal(calculateBoundedStickyShift({ viewportTop: 0, naturalTop: -500, naturalBottom: -450, boundaryBottom: -400, topOffset: 12 }), 50);

const properties = fs.readFileSync("app/components/editor/PropertiesPanel.jsx", "utf8");
assert.match(properties, /Keep sticky within/);
assert.match(properties, /Parent Container/);
assert.match(properties, /Custom Ancestor/);
assert.match(properties, /stickyEndOffset/);
assert.match(properties, /stickyDesktop/);
assert.match(properties, /stickyDiagnostic/);

const canvas = fs.readFileSync("app/components/editor/Canvas.jsx", "utf8");
assert.match(canvas, /function updateBoundedSticky/);
assert.match(canvas, /data-vsn-sticky-boundary/);
assert.match(canvas, /data-vsn-column-cell/);
assert.match(canvas, /data-vsn-page-boundary/);
assert.match(canvas, /stickyDiagnosticMessage/);

const proxy = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
assert.match(proxy, /data-vsn-sticky-boundary/);
assert.match(proxy, /data-vsn-sticky-end-offset/);
assert.match(proxy, /vsn-column-cell/);
assert.match(proxy, /data-vsn-node-type/);
assert.match(proxy, /class="vsn-page" data-vsn-page-boundary="1"/);

const renderer = fs.readFileSync("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js", "utf8");
assert.match(renderer, /function stickyBoundary\(el\)/);
assert.match(renderer, /function updateStickyPositions\(\)/);
assert.match(renderer, /scheduleStickyUpdate/);
assert.match(renderer, /data-vsn-column-cell/);
assert.match(renderer, /--vsn-sticky-y/);
assert.match(renderer, /stickyDeviceEnabled/);

console.log("FIX-3 sticky boundary audit PASS");
