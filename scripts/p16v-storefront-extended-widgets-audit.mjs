import assert from "node:assert/strict";
import fs from "node:fs";
import { parseRows, renderExtendedWidget } from "../app/storefront/extendedWidgets.js";

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const node = (type) => ({ id: `n-${type}`, type });
const render = (type, props = {}, ctx = {}) => renderExtendedWidget(node(type), props, {}, ctx);

equal(parseRows("a | b | c\n\n x|y", 2), [["a", "b"], ["x", "y"]], "parseRows trims, caps columns and drops empty lines");
equal(parseRows(null), [], "parseRows tolerates nullish input");
equal(render("not-a-widget"), "", "Unknown types render nothing");

const types = ["account-link", "announcement-bar", "cart-icon", "customer-name", "faq", "gallery-grid", "header-search", "localization-switcher", "logo-cloud", "marquee", "mega-menu", "product-tabs", "recently-viewed", "related-collections", "shipping-info", "size-guide", "stats", "sticky-add-to-cart", "stock-progress", "tabs", "team-grid", "testimonials", "trust-badges", "upsell-products", "customer-login"];
for (const type of types) {
  const html = render(type, {}, { product: { title: "P", variants: [] } });
  ok(typeof html === "string" && html.includes(`data-vsn-id="n-${type}"`), `${type} renders with its node id`);
}

const tabs = render("tabs", { items: [{ label: "<b>One</b>", content: "<script>x</script>" }] });
ok(tabs.includes("&lt;b&gt;One&lt;/b&gt;") && !tabs.includes("<script>"), "Tabs escape labels and bodies");
const productTabs = render("product-tabs", { tabsText: "Details|ignored" }, { product: { descriptionHtml: "<p>Rich</p><script>bad()</script><img src=x onerror=y>" } });
ok(productTabs.includes("<p>Rich</p>") && !productTabs.includes("<script>") && !/onerror=/i.test(productTabs), "Product tabs sanitize Shopify descriptionHtml");

const sticky = render("sticky-add-to-cart", {}, { product: { title: "Tee", price: { amount: "9", currencyCode: "USD" }, variants: [{ variantId: "v1" }] } });
ok(sticky.includes("$9.00") && sticky.includes('data-vsn-default-variant-id="v1"'), "Sticky add-to-cart formats price and default variant");
ok(!render("sticky-add-to-cart", { showPrice: false }, { product: { price: { amount: "9", currencyCode: "USD" } } }).includes("$9.00"), "Sticky add-to-cart can hide price");

const localization = render("localization-switcher", { countriesText: "US|United States", languagesText: "en|English" });
ok(localization.includes('action="/localization"') && localization.includes("United States"), "Localization switcher posts to Shopify /localization");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/extendedWidgets.js", "utf8");
ok(route.includes('from "../storefront/extendedWidgets.js"'), "Builder proxy imports extended-widget boundary");
for (const name of ["parseRows", "renderExtendedWidget"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
ok(route.includes("function renderPhase10Widget("), "Phase-10 widgets (which recurse through renderNode) stay in the route");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Extended-widget boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6v storefront extended widgets audit: PASS (${checks}/${checks})`);
