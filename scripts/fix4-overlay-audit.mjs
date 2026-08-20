import fs from "node:fs";
import path from "node:path";
import { calculateAnchoredOverlayPosition, calculatePointOverlayPosition } from "../app/builder/overlayPositioning.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => { console.error(`FIX-4 FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`FIX-4 PASS: ${message}`);
const expect = (condition, message) => condition ? pass(message) : fail(message);

const viewport = { width: 800, height: 600 };
const bottomEdge = calculateAnchoredOverlayPosition({
  anchor: { left: 100, right: 220, top: 540, bottom: 570, width: 120, height: 30 },
  overlay: { width: 280, height: 180 },
  placement: "bottom-start",
  viewport,
});
expect(bottomEdge.placement.startsWith("top"), "bottom collision flips overlay above its anchor");
expect(bottomEdge.top >= 10, "flipped overlay stays inside top viewport padding");

const rightEdge = calculateAnchoredOverlayPosition({
  anchor: { left: 730, right: 780, top: 120, bottom: 150, width: 50, height: 30 },
  overlay: { width: 280, height: 180 },
  placement: "bottom-start",
  viewport,
});
expect(rightEdge.left + 280 <= 790, "right collision shifts/flips overlay inside viewport");

const leftTopPoint = calculatePointOverlayPosition({ point: { x: -80, y: -30 }, overlay: { width: 220, height: 300 }, viewport });
expect(leftTopPoint.left === 10 && leftTopPoint.top === 10, "point overlays clamp negative left/top coordinates");
const rightBottomPoint = calculatePointOverlayPosition({ point: { x: 795, y: 595 }, overlay: { width: 220, height: 300 }, viewport });
expect(rightBottomPoint.left + 220 <= 790 && rightBottomPoint.top + 300 <= 590, "point overlays clamp right/bottom collisions");

const manager = read("app/components/editor/OverlayManager.jsx");
expect(manager.includes('ROOT_ID = "vsn-editor-overlay-root"'), "central body-level overlay root exists");
expect(manager.includes('window.addEventListener("scroll", onViewportChange, true)'), "anchored overlays reposition on nested scroll containers");
expect(manager.includes("ResizeObserver"), "overlay placement reacts to anchor/content size changes");
expect(manager.includes('document.addEventListener("pointerdown", onPointerDown, true)'), "central outside-click handling supports portal content");

expect(manager.includes("useState(() => canUseDom() ? ensureOverlayRoot() : null)"), "overlay portal can mount synchronously in the browser instead of waiting a passive effect");
expect((manager.match(/ref=\{setOverlayNode\}/g) || []).length >= 2, "anchored and point overlays recalculate after the portaled DOM node mounts");

const overlayCss = read("app/styles/builder.css");
expect(!/vsn-font-popover\{[^}]*left:auto!important/i.test(overlayCss), "font popover CSS does not overwrite calculated left coordinate");
expect(!/vsn-font-popover\{[^}]*top:auto!important/i.test(overlayCss), "font popover CSS does not overwrite calculated top coordinate");
expect(!/vsn-color-popover\{[^}]*left:auto!important/i.test(overlayCss), "color popover CSS does not overwrite calculated left coordinate");
expect(!/vsn-color-popover\{[^}]*top:auto!important/i.test(overlayCss), "color popover CSS does not overwrite calculated top coordinate");
expect(!/vsn-editor-action-menu\{[^}]*top:auto!important/i.test(overlayCss), "action menu CSS does not overwrite calculated top coordinate");

const controls = read("app/components/editor/EditorControls.jsx");
expect(controls.includes('className="vsn-color-popover"'), "color/gradient picker uses centralized anchored overlay");
expect(controls.includes('className="vsn-control-popover"'), "generic property popovers use centralized anchored overlay");
expect(controls.includes("<ModalPortal>"), "editor icon/SVG dialogs use body portal");

const fonts = read("app/components/editor/fonts/FontFamilyControl.jsx");
expect(fonts.includes("<AnchoredOverlay") && fonts.includes('className="vsn-font-popover"'), "font dropdown uses collision-aware anchored overlay");
expect(fonts.includes("<ModalPortal>"), "font upload dialog uses body portal");

const toolbar = read("app/components/editor/EditorToolbar.jsx");
expect(toolbar.includes('<AnchoredOverlay open={menuOpen}'), "publish action dropdown uses collision-aware overlay");

const productivity = read("app/components/editor/EditorProductivityLayer.jsx");
expect(productivity.includes("<PointOverlay") && productivity.includes("<ModalPortal>"), "context menu and command palette use central overlay system");

const sectionInserter = read("app/components/editor/SectionInserter.jsx");
expect(sectionInserter.includes("<ModalPortal>") && sectionInserter.includes("vsn-library-modal"), "section library dialog uses the central portal overlay system");

const pageEditor = read("app/components/editor/PageEditor.jsx");
expect((pageEditor.match(/<ModalPortal>/g) || []).length >= 2, "editor shortcuts and save-template dialogs are portaled");

const css = read("app/styles/builder.css");
expect(css.includes("#vsn-editor-overlay-root{position:fixed;inset:0;z-index:2147482000;pointer-events:none"), "overlay root has isolated top-level stacking context");
expect(css.includes(".vsn-editor-modal-backdrop{position:fixed;inset:0;overflow:auto"), "dialogs remain usable on small/short viewports");
expect(css.includes("#vsn-editor-overlay-root .vsn-color-popover{position:fixed!important"), "legacy color picker positioning cannot override portal placement");

if (process.exitCode) process.exit(process.exitCode);
console.log("FIX-4 overlay collision audit complete: PASS");
