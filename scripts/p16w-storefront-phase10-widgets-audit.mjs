import assert from "node:assert/strict";
import fs from "node:fs";
import { PHASE10_SERVER_WIDGET_TYPES, renderPhase10Widget } from "../app/storefront/phase10Widgets.js";

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const node = (type, extra = {}) => ({ id: `n-${type}`, type, ...extra });
const calls = [];
const renderChild = (child) => { calls.push(child.id); return `<i data-child="${child.id}"></i>`; };
const render = (type, props = {}, ctx = {}, extra = {}) => renderPhase10Widget(node(type, extra), props, {}, ctx, renderChild);

ok(PHASE10_SERVER_WIDGET_TYPES instanceof Set && PHASE10_SERVER_WIDGET_TYPES.size === 29, "Phase-10 type registry keeps its 29 server-rendered types");
for (const type of PHASE10_SERVER_WIDGET_TYPES) {
  const html = render(type, {}, { product: { title: "P", variants: [] }, collection: { products: [] } }, { children: [] });
  ok(typeof html === "string", `${type} renders a string`);
}

const html = render("html", { code: `<p onclick="x()">Hi</p><script>bad()</script>` });
ok(html.includes("<p>Hi</p>") && !html.includes("<script>") && !/onclick=/i.test(html), "HTML widget sanitizes merchant markup");
const liquid = render("liquid", { code: "<b>{{ x }}</b>" });
ok(liquid.includes("&lt;b&gt;{{ x }}&lt;/b&gt;"), "Liquid widget escapes code as text");
const theme = render("html", { mode: "theme-section", themeSectionId: '"><x>' });
ok(theme.includes('data-vsn-theme-section-id="&quot;&gt;&lt;x&gt;"'), "Theme-section bridge escapes the section id");

ok(render("map", { query: "Lahore" }, {}).includes("vsn-map-unconfigured"), "Map without an API key renders the explicit unconfigured placeholder");
ok(render("map", { query: "Lahore" }, { googleMapsApiKey: "K" }).includes("https://www.google.com/maps/embed/v1/place?key="), "Map with a key uses the keyed Embed endpoint");

calls.length = 0;
const slider = render("slider", {}, {}, { children: [{ id: "s1", type: "text" }, { id: "s2", type: "text" }] });
ok(slider.includes('data-child="s1"') && slider.includes('data-child="s2"'), "Slider renders slides through the injected renderNode");
ok(calls.includes("s1") && calls.includes("s2"), "Slider recursion uses the route-provided renderer");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/phase10Widgets.js", "utf8");
ok(route.includes('from "../storefront/phase10Widgets.js"'), "Builder proxy imports Phase-10 widget boundary");
ok(!route.includes("function renderPhase10Widget(") && !route.includes("const PHASE10_SERVER_WIDGET_TYPES"), "Builder proxy no longer owns Phase-10 widgets");
ok((route.match(/renderPhase10Widget\(node, props, styles, renderContext, renderNode\)/g) || []).length === 2, "Both route call sites inject renderNode");
ok(!/\brenderNode\(/.test(source), "Phase-10 boundary never imports or calls the route renderer directly");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Phase-10 boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6w storefront Phase-10 widgets audit: PASS (${checks}/${checks})`);
