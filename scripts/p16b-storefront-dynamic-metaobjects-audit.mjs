import assert from "node:assert/strict";
import fs from "node:fs";
import {
  STOREFRONT_METAOBJECT_BINDING_LIMIT,
  collectDynamicMetaobjectBindings,
  loadDynamicMetaobjects,
} from "../app/storefront/dynamicMetaobjects.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const elements = [{
  id: "root",
  dynamicSource: {
    enabled: true,
    source: "metaobject.field",
    metaobjectId: "gid://shopify/Metaobject/1",
    key: "headline",
  },
  bindings: {
    "props.text": {
      enabled: true,
      source: "metaobject.field",
      metaobjectType: "feature",
      metaobjectId: "hero",
      key: "copy",
    },
    "props.duplicate": {
      enabled: true,
      source: "metaobject.field",
      metaobjectType: "feature",
      metaobjectId: "hero",
      key: "copy",
    },
    "props.disabled": {
      enabled: false,
      source: "metaobject.field",
      metaobjectType: "feature",
      metaobjectId: "ignored",
      key: "copy",
    },
  },
  children: [{
    id: "nested",
    bindings: {
      "props.image": {
        enabled: true,
        source: "metaobject.field",
        metaobjectType: "feature",
        metaobjectId: "nested-card",
        key: "image",
      },
    },
  }],
}];

const collected = collectDynamicMetaobjectBindings(elements);
equal(collected, [
  { signature: "|gid://shopify/Metaobject/1|headline", type: "", idOrHandle: "gid://shopify/Metaobject/1", key: "headline" },
  { signature: "feature|hero|copy", type: "feature", idOrHandle: "hero", key: "copy" },
  { signature: "feature|nested-card|image", type: "feature", idOrHandle: "nested-card", key: "image" },
], "Discovery keeps legacy/bindings depth-first order and deduplicates signatures");

equal(collectDynamicMetaobjectBindings([{ bindings: [] }]), [], "Non-object bindings remain ignored through normalizeBindings");

const capped = collectDynamicMetaobjectBindings([{
  children: Array.from({ length: 35 }, (_, index) => ({
    dynamicSource: {
      enabled: true,
      source: "metaobject.field",
      metaobjectType: "item",
      metaobjectId: `row-${index}`,
      key: "value",
    },
  })),
}]);
equal(capped.length, STOREFRONT_METAOBJECT_BINDING_LIMIT, "Discovery keeps the historical 30-binding cap");
equal(capped[0].signature, "item|row-0|value", "Binding cap keeps depth-first first item");
equal(capped.at(-1).signature, "item|row-29|value", "Binding cap keeps depth-first first 30 unique items");

const calls = [];
const admin = {
  async graphql(query, { variables }) {
    calls.push({ query, variables });
    if (variables?.handle?.handle === "broken") throw new Error("simulated lookup failure");
    if (variables?.id) {
      return { async json() { return { data: { metaobject: { fields: [{ key: "headline", value: "GID headline" }] } } }; } };
    }
    if (variables?.handle?.handle === "hero") {
      return { async json() { return { data: { metaobjectByHandle: { fields: [{ key: "copy", value: "Handle copy" }] } } }; } };
    }
    return { async json() { return { data: { metaobjectByHandle: { fields: [] } } }; } };
  },
};

const loadElements = [{
  dynamicSource: {
    enabled: true,
    source: "metaobject.field",
    metaobjectId: "gid://shopify/Metaobject/1",
    key: "headline",
  },
  bindings: {
    "props.copy": {
      enabled: true,
      source: "metaobject.field",
      metaobjectType: "feature",
      metaobjectId: "hero",
      key: "copy",
    },
    "props.missingType": {
      enabled: true,
      source: "metaobject.field",
      metaobjectId: "type-required",
      key: "copy",
    },
    "props.broken": {
      enabled: true,
      source: "metaobject.field",
      metaobjectType: "feature",
      metaobjectId: "broken",
      key: "copy",
    },
  },
}];

const originalWarn = console.warn;
console.warn = () => {};
let values;
try {
  values = await loadDynamicMetaobjects({ admin, elements: loadElements });
} finally {
  console.warn = originalWarn;
}

equal(values, {
  "|gid://shopify/Metaobject/1|headline": "GID headline",
  "feature|hero|copy": "Handle copy",
}, "Successful values survive a later per-binding lookup failure");

equal(calls.length, 3, "Missing-type handle binding is skipped without an Admin API call");
ok(calls[0].query.includes("metaobject(id:$id)"), "GID lookup keeps metaobject(id:) query");
equal(calls[0].variables, { id: "gid://shopify/Metaobject/1" }, "GID lookup keeps ID variables");
ok(calls[1].query.includes("metaobjectByHandle"), "Handle lookup keeps metaobjectByHandle query");
equal(calls[1].variables, { handle: { type: "feature", handle: "hero" } }, "Handle lookup keeps type/handle variables");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const moduleSource = fs.readFileSync("app/storefront/dynamicMetaobjects.server.js", "utf8");
ok(route.includes('from "../storefront/dynamicMetaobjects.server.js"'), "Builder proxy imports extracted dynamic metaobject boundary");
ok(route.includes("loadDynamicMetaobjects({ admin, elements: resolvedElements })"), "Builder proxy keeps existing dynamic metaobject call site");
ok(!route.includes("function collectDynamicMetaobjectBindings("), "Builder proxy no longer owns binding discovery");
ok(!route.includes("async function loadDynamicMetaobjects("), "Builder proxy no longer owns Admin metaobject loading");
ok(!route.includes("normalizeBindings } from \"../builder/dynamicBindings.js\""), "Builder proxy drops extraction-only normalizeBindings import");

for (const marker of [
  "STOREFRONT_METAOBJECT_BINDING_LIMIT",
  "normalizeBindings",
  "metaobject(id:$id)",
  "metaobjectByHandle",
  'console.warn("VSN dynamic metaobject lookup failed"',
]) {
  ok(moduleSource.includes(marker), `Dynamic metaobject boundary marker missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "authenticate.",
  "builderPage.",
  "Response(",
  "renderBuilder",
  "shopify.server",
]) {
  ok(!moduleSource.includes(forbidden), `Dynamic metaobject boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6b storefront dynamic metaobject audit: PASS (${checks}/${checks})`);
