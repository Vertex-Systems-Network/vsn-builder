import test from "node:test";
import assert from "node:assert/strict";
import { createWidget, widgetRegistry } from "../app/builder/widgetRegistry.js";
import { renderVsnStorefrontWidget } from "../app/sdk/runtime.js";
import { serializeVsnDescriptor, vsnElement } from "../app/sdk/renderDescriptor.js";
import { buildNodeStyle } from "../app/builder/styleEngine.js";
import { buildStyleBundleCss } from "../app/builder/stylePipeline.js";
import { backgroundVideoUrl } from "../app/builder/sectionDecorations.js";
import { injectNodeBehavior } from "../app/storefront/nodeBehavior.js";
import { ELEMENTS } from "../app/data/elements.js";

const NEW = ["before-after", "image-hotspots", "animated-headline", "star-rating", "flip-box", "table-of-contents", "alert"];
const html = (node) => { const out = renderVsnStorefrontWidget(node, { helpers: {} }); assert.equal(out.handled, true, node.type); return typeof out.value === "string" ? out.value : serializeVsnDescriptor(out.value); };

test("new widgets are registered, listed in the sidebar and render on the storefront", () => {
  const sidebar = new Set(ELEMENTS.map((item) => item.type));
  for (const type of [...NEW, "wishlist-button", "wishlist-count", "wishlist-grid", "wishlist-empty-state"]) {
    assert.ok(widgetRegistry[type], `${type} registered`);
    assert.ok(sidebar.has(type), `${type} in sidebar`);
  }
  for (const type of NEW) assert.ok(html({ ...createWidget(type), id: "w1" }).length > 40, type);
});

test("widget options reach the storefront markup", () => {
  assert.match(html({ ...createWidget("before-after"), id: "a", props: { ...createWidget("before-after").props, startPosition: 30 } }), /inset\(0 0 0 30%\)/);
  assert.match(html({ ...createWidget("star-rating"), id: "b", props: { rating: 3, max: 5 } }), /width:60%/);
  assert.match(html({ ...createWidget("animated-headline"), id: "c", props: { words: "one, two", mode: "fade" } }), /data-vsn-rotate-mode="fade"/);
  assert.match(html({ ...createWidget("image-hotspots"), id: "d", props: { pointsText: "10|20|Pin|Body|/x" } }), /left:10%;top:20%/);
  assert.match(html({ ...createWidget("alert"), id: "e", props: { tone: "error", text: "x" } }), /role="alert"/);
});

test("numeric descriptor styles serialize with px, unitless ones without", () => {
  assert.equal(serializeVsnDescriptor(vsnElement("div", { style: { borderRadius: 8, opacity: 0.5, zIndex: 2, margin: 0 } }, "x")), '<div style="border-radius:8px;opacity:0.5;z-index:2;margin:0">x</div>');
});

test("background overlay, shape dividers and background video", () => {
  assert.equal(buildNodeStyle({ background: { type: "media", media: { url: "/a.jpg" }, overlay: { enabled: true, color: "#000000", opacity: 50 } } }).backgroundImage, "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(/a.jpg)");
  const css = buildStyleBundleCss([[{ id: "s1", type: "section", styles: { shapeDivider: { top: { shape: "wave", color: "#ff0000", height: 60 }, bottom: { shape: "nope" } } }, children: [] }]], {}, {});
  assert.match(css, /\[data-vsn-id="s1"\]::before\{content:"";position:absolute;[^}]*top:-1px;height:60px;background:#ff0000/);
  assert.doesNotMatch(css, /::after/);
  assert.equal(backgroundVideoUrl({ background: { video: { url: "https://cdn.shopify.com/v.mp4" } } }), "https://cdn.shopify.com/v.mp4");
  assert.equal(backgroundVideoUrl({ background: { video: { url: "javascript:alert(1)//.mp4" } } }), "");
  assert.match(injectNodeBehavior("<section>x</section>", { type: "section", styles: { background: { video: { url: "https://cdn.shopify.com/v.webm" } } } }), /data-vsn-bg-video="https:\/\/cdn.shopify.com\/v.webm"/);
});
