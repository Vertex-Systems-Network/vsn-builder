import assert from "node:assert/strict";
import fs from "node:fs";
import { injectNodeBehavior } from "../app/storefront/nodeBehavior.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(injectNodeBehavior("", { type: "text" }), "", "Empty HTML is returned unchanged");
equal(injectNodeBehavior(null, { type: "text" }), null, "Non-string HTML is returned unchanged");
equal(injectNodeBehavior("<div>x</div>", { type: "text" }), '<div data-vsn-node-type="text">x</div>', "Node type is injected into the first tag");
equal(injectNodeBehavior("  <section class=a>", {}), '  <section data-vsn-node-type="unknown" class=a>', "Missing type falls back to unknown");
equal(injectNodeBehavior("plain text", { type: "x" }), "plain text", "HTML without a leading tag is unchanged");

const escaped = injectNodeBehavior("<div>", { type: '"><script>' });
ok(escaped.includes('data-vsn-node-type="&quot;&gt;&lt;script&gt;"'), "Attribute values are escaped");

const meta = injectNodeBehavior("<div>", { type: "t", meta: { componentId: "c1", __vsnComponentSlotName: "slot" } });
ok(meta.includes('data-vsn-component-id="c1"') && meta.includes('data-vsn-component-slot="slot"'), "Component id and slot are emitted");

const cond = injectNodeBehavior("<div>", { type: "t", conditions: { enabled: true, rule: "device", value: "mobile", groups: [{ rules: [{ rule: "device" }] }] } });
ok(cond.includes('data-vsn-condition-rule="device"') && cond.includes('data-vsn-condition-value="mobile"'), "Enabled conditions are emitted for the theme runtime");
ok(cond.includes("data-vsn-conditions=") && cond.includes("&quot;operator&quot;:&quot;AND&quot;"), "Condition groups are serialized with default AND operator");
ok(!injectNodeBehavior("<div>", { type: "t", conditions: { enabled: false, rule: "device" } }).includes("data-vsn-condition-rule"), "Disabled conditions are not emitted");

const exit = injectNodeBehavior("<div>", { type: "t", styles: { effects: { exitAnimation: "fade-out" } } });
ok(exit.includes('data-vsn-exit="fade-out"'), "Exit animation is emitted");
ok(!injectNodeBehavior("<div>", { type: "t", styles: { effects: { exitAnimation: "none" } } }).includes("data-vsn-exit"), "none exit animation is skipped");

const sticky = injectNodeBehavior("<div>", { type: "t", interactions: { sticky: true, stickyBoundary: "bogus", stickyOffset: 5000, stickyZIndex: -50, stickyMobile: false } });
ok(sticky.includes('data-vsn-sticky-boundary="parent"'), "Unknown sticky boundary falls back to parent");
ok(sticky.includes('data-vsn-sticky-offset="1000"'), "Sticky offset is clamped to 1000");
ok(sticky.includes('data-vsn-sticky-z-index="-1"'), "Sticky z-index is clamped to -1");
ok(sticky.includes('data-vsn-sticky-mobile="0"') && sticky.includes('data-vsn-sticky-desktop="1"'), "Sticky device toggles are emitted");

const custom = injectNodeBehavior("<div>", { type: "t", interactions: { sticky: true, stickyBoundary: "custom", stickyCustomTarget: `  #${"a".repeat(400)}  ` } });
const target = custom.match(/data-vsn-sticky-target="([^"]*)"/)?.[1] || "";
equal(target.length, 256, "Custom sticky target is trimmed and capped at 256 chars");

const query = injectNodeBehavior("<div>", { type: "t", dynamicSource: { enabled: true, source: "query.search", key: "q", fallback: "All" } });
ok(query.includes('data-vsn-dynamic-query="q"') && query.includes('data-vsn-dynamic-target="text"') && query.includes('data-vsn-dynamic-fallback="All"'), "query.search dynamic source is deferred to the browser");
ok(!injectNodeBehavior("<div>", { type: "t", dynamicSource: { enabled: true, source: "shop.name" } }).includes("data-vsn-dynamic-query"), "Server-resolved dynamic sources are not deferred");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/nodeBehavior.js", "utf8");
ok(route.includes('from "../storefront/nodeBehavior.js"'), "Builder proxy imports node-behavior boundary");
ok(!route.includes("function injectNodeBehavior("), "Builder proxy no longer owns injectNodeBehavior");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Node-behavior boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6r storefront node behavior audit: PASS (${checks}/${checks})`);
