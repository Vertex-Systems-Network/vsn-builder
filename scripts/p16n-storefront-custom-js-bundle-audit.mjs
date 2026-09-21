import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCustomJsBundle } from "../app/storefront/customJsBundle.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const validCode = 'element.setAttribute("data-test","ok");';
const duplicate = {
  id: "node-1",
  styles: { advanced: { customJs: validCode } },
  children: [],
};
const invalidCode = "if (";
const weirdId = "line\nbreak\u2028quote'\\";
const bundle = buildCustomJsBundle([
  [
    duplicate,
    { ...duplicate },
    {
      id: "invalid-node",
      styles: { advanced: { customJs: invalidCode } },
      children: [],
    },
    {
      id: weirdId,
      styles: { advanced: { customJs: 'element.setAttribute("data-weird","1");' } },
      children: [],
    },
  ],
]);

ok(bundle.startsWith("(function(){"), "Bundle keeps historical IIFE wrapper");
ok(bundle.endsWith("})();"), "Bundle keeps historical IIFE close");
equal((bundle.match(/data-test/g) || []).length, 1, "Duplicate ID/code entries execute once");
ok(!bundle.includes(invalidCode), "Invalid merchant JavaScript is omitted from executable bundle");
ok(bundle.includes("VSN custom JS skipped for invalid-node"), "Invalid merchant JavaScript emits a diagnostic warning");
ok(bundle.includes(JSON.stringify(weirdId)), "Element lookup serializes arbitrary node IDs");
ok(bundle.includes(JSON.stringify(`VSN custom JS failed for ${weirdId}:`)), "Runtime error diagnostics serialize arbitrary node IDs");
new Function("document", "window", bundle);
checks += 1;

const attrs = new Map();
const target = {
  getAttribute(name) {
    if (name === "data-vsn-id") return "node-1";
    return attrs.get(name) ?? null;
  },
  setAttribute(name, value) {
    attrs.set(name, value);
  },
};
const weirdAttrs = new Map();
const weirdTarget = {
  getAttribute(name) {
    if (name === "data-vsn-id") return weirdId;
    return weirdAttrs.get(name) ?? null;
  },
  setAttribute(name, value) {
    weirdAttrs.set(name, value);
  },
};
const root = {
  querySelectorAll(selector) {
    return selector === "[data-vsn-id]" ? [target, weirdTarget] : [];
  },
};
const documentStub = {
  currentScript: { parentElement: root },
  querySelectorAll(selector) {
    return selector === "[data-vsn-id]" ? [target, weirdTarget] : [];
  },
};
new Function("document", "window", bundle)(documentStub, {});
equal(attrs.get("data-test"), "ok", "Valid custom JavaScript executes against its target element");
equal(attrs.get("data-vsn-js-ready"), "1", "Successful custom JavaScript marks its target ready");
equal(weirdAttrs.get("data-weird"), "1", "Serialized weird-ID target still executes custom JavaScript");
equal(weirdAttrs.get("data-vsn-js-ready"), "1", "Weird-ID target still receives ready marker");

const empty = buildCustomJsBundle([]);
ok(empty.includes("function __vsnFind"), "Empty bundle keeps runtime lookup scaffold");
ok(!empty.includes("data-vsn-js-ready"), "Empty bundle contains no executable element entries");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/customJsBundle.js", "utf8");
const customCode = fs.readFileSync("app/builder/customCode.js", "utf8");

ok(route.includes('from "../storefront/customJsBundle.js"'), "Builder proxy imports custom-JS bundle boundary");
ok(!route.includes('from "../builder/customCode.js"'), "Builder proxy no longer owns direct custom-code validation/collection dependency");
ok(!route.includes("function buildCustomJsBundle("), "Builder proxy no longer owns custom-JS bundle assembly");
ok(route.includes('if (enterpriseSettings.safeMode) return javascriptResponse("/* VSN Safe Mode: custom JavaScript disabled. */");'), "Safe mode still blocks custom JavaScript before bundle assembly");
ok(route.includes("return javascriptResponse(buildCustomJsBundle([resolvedElements, globalHeader?.elements || [], globalFooter?.elements || []]));"), "Custom-JS endpoint keeps page/header/footer bundle inputs");

for (const marker of [
  'collectCustomJsGroups(groups)',
  'validateCustomJs(entry.code)',
  'JSON.stringify(entry.id)',
  'JSON.stringify(`VSN custom JS failed for ${String(entry.id)}:`)',
  '"use strict"',
  "data-vsn-js-ready",
]) {
  ok(source.includes(marker), `Custom-JS boundary contract marker missing: ${marker}`);
}
for (const marker of [
  "MAX_CUSTOM_JS_PER_ELEMENT = 50_000",
  "MAX_CUSTOM_JS_ENTRIES = 150",
]) {
  ok(customCode.includes(marker), `Custom-JS bounded collection contract missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "session.",
  "Response(",
  "renderNode",
  "shopify.server",
  "process.env",
]) {
  ok(!source.includes(forbidden), `Custom-JS bundle boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6n storefront custom JavaScript bundle audit: PASS (${checks}/${checks})`);
