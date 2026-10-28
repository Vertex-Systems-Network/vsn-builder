import assert from "node:assert/strict";
import fs from "node:fs";
import { applyDynamicSource, formatMoney, readPath } from "../app/storefront/dynamicSource.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(formatMoney("12.5", "USD"), "$12.50", "formatMoney formats currency");
equal(formatMoney(null), "$0.00", "formatMoney defaults missing amount and currency");
equal(formatMoney(3, "NOT_A_CODE"), "3.00 NOT_A_CODE", "formatMoney falls back on invalid currency");
equal(readPath({ a: { b: { c: 7 } } }, "a.b.c"), 7, "readPath walks dotted paths");
equal(readPath({ a: null }, "a.b"), undefined, "readPath stops at nullish values");
equal(readPath(null, "a"), undefined, "readPath tolerates missing source");

const ctx = {
  shop: { name: "Acme" },
  product: {
    price: { amount: "20", currencyCode: "USD" },
    metafields: { nodes: [{ namespace: "custom", key: "badge", value: "New" }] },
  },
  dynamicMetaobjects: { "hero||title": "Hero title" },
};
const text = { id: "t", type: "heading", props: { text: "Old" } };
const same = { id: "x", type: "heading", props: { text: "Keep" } };

equal(applyDynamicSource(same, ctx), same, "Nodes without dynamic source are returned unchanged");
equal(applyDynamicSource({ ...same, dynamicSource: { enabled: false, source: "shop.name" } }, ctx), { ...same, dynamicSource: { enabled: false, source: "shop.name" } }, "Disabled dynamic source is ignored");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "shop.name" } }, ctx).props.text, "Acme", "Path sources bind to text");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "product.price" } }, ctx).props.text, "$20.00", "Product price uses formatMoney");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "product.metafield", key: "badge" } }, ctx).props.text, "New", "Product metafield lookup defaults namespace to custom");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "metaobject.field", metaobjectType: "hero", key: "title" } }, ctx).props.text, "Hero title", "Metaobject fields use the type|id|key signature");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "query.search", fallback: "Search" } }, ctx).props.text, "Search", "query.search uses the fallback server-side");
equal(applyDynamicSource({ ...text, dynamicSource: { enabled: true, source: "shop.missing", fallback: "Fallback" } }, ctx).props.text, "Fallback", "Missing values use fallback");
const untouched = { ...text, dynamicSource: { enabled: true, source: "shop.missing" } };
equal(applyDynamicSource(untouched, ctx), untouched, "Missing value without fallback leaves the node unchanged");
equal(applyDynamicSource({ id: "i", type: "image", props: { src: "a.png" }, dynamicSource: { enabled: true, source: "shop.name", target: "src" } }, ctx).props.src, "Acme", "src target binds props.src");
equal(applyDynamicSource({ id: "b", type: "button", props: {}, dynamicSource: { enabled: true, source: "shop.name", target: "url" } }, ctx).props.url, "Acme", "url target binds props.url");
equal(applyDynamicSource({ id: "i", type: "image", props: { alt: "Kept" }, dynamicSource: { enabled: true, source: "shop.name" } }, ctx).props.alt, "Kept", "Image text binding keeps an existing alt");
equal(applyDynamicSource({ id: "i", type: "image", props: {}, dynamicSource: { enabled: true, source: "shop.name" } }, ctx).props.alt, "Acme", "Image text binding fills an empty alt");
const original = { ...text, props: { text: "Old" }, dynamicSource: { enabled: true, source: "shop.name" } };
applyDynamicSource(original, ctx);
equal(original.props.text, "Old", "Binding does not mutate the input node");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/dynamicSource.js", "utf8");
ok(route.includes('from "../storefront/dynamicSource.js"'), "Builder proxy imports dynamic-source boundary");
for (const name of ["formatMoney", "readPath", "applyDynamicSource"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
ok(route.includes("const legacyResolvedNode = applyDynamicSource(node, renderContext);"), "renderNode still resolves dynamic sources");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Dynamic-source boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6p storefront dynamic source audit: PASS (${checks}/${checks})`);
