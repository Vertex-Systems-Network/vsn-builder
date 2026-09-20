import assert from "node:assert/strict";
import fs from "node:fs";
import { mapProductNode } from "../app/storefront/productMapper.js";
import {
  STOREFRONT_WIDGET_GRID_REQUEST_LIMIT,
  collectWidgetGridRequests,
  loadWidgetGridData,
} from "../app/storefront/widgetGridData.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(mapProductNode({
  id: "gid://shopify/Product/1",
  title: "Alpha",
  handle: "alpha",
  vendor: "VSN",
  productType: "Demo",
  createdAt: "2026-01-02T00:00:00Z",
  featuredImage: { url: "alpha.jpg", altText: "", width: 800, height: 600 },
  priceRangeV2: { minVariantPrice: { amount: "12.50", currencyCode: "EUR" } },
  compareAtPriceRange: { minVariantCompareAtPrice: { amount: "15.00", currencyCode: "EUR" } },
  variants: { nodes: [{ availableForSale: false }, { availableForSale: true }] },
}), {
  id: "gid://shopify/Product/1",
  title: "Alpha",
  handle: "alpha",
  url: "/products/alpha",
  availableForSale: true,
  vendor: "VSN",
  productType: "Demo",
  createdAt: "2026-01-02T00:00:00Z",
  image: { url: "alpha.jpg", altText: "Alpha", width: 800, height: 600 },
  price: { amount: "12.50", currencyCode: "EUR" },
  compareAtPrice: { amount: "15.00", currencyCode: "EUR" },
}, "Product mapper keeps historical projection and image-alt fallback");

equal(mapProductNode(null), {
  id: "",
  title: "",
  handle: "",
  url: "#",
  availableForSale: false,
  vendor: "",
  productType: "",
  createdAt: "",
  image: null,
  price: { amount: "0", currencyCode: "USD" },
  compareAtPrice: { amount: "", currencyCode: "" },
}, "Product mapper keeps empty fallbacks");

const requestElements = [{
  type: "container",
  children: [
    { id: "p", type: "product-grid", props: { query: "vendor:VSN", limit: 6, sortBy: "title-asc" } },
    { id: "ignored", type: "heading", props: {} },
    { id: "c", type: "collection-grid", props: { limit: 3 } },
    { id: "r", type: "recently-viewed", props: {} },
  ],
}];
const requests = collectWidgetGridRequests(requestElements);
equal(requests.map((item) => item.id), ["p", "c", "r"], "Widget request discovery remains depth-first and type-filtered");
equal(requests[0].props.limit, 6, "Widget request discovery still normalizes grid props");
equal(requests[2].props.limit, 12, "Recently-viewed request keeps normalizeGridProps default limit");

const capped = collectWidgetGridRequests(Array.from({ length: 45 }, (_, index) => ({
  id: `grid-${index}`,
  type: "product-grid",
  props: { limit: 1 },
})));
equal(capped.length, STOREFRONT_WIDGET_GRID_REQUEST_LIMIT, "Widget request discovery keeps 40-request cap");
equal(capped.at(-1).id, "grid-39", "Widget request cap keeps the first 40 requests");

let contextCalls = 0;
const contextAdmin = { async graphql() { contextCalls += 1; throw new Error("context grids must not query"); } };
const collectionProducts = [{ title: "C1" }, { title: "C2" }, { title: "C3" }];
const searchItems = [
  { type: "Product", title: "S1" },
  { type: "Page", title: "Page" },
  { title: "Legacy product", productType: "Legacy" },
  { title: "Priced product", price: { amount: "1" } },
];
const contextResult = await loadWidgetGridData({
  admin: contextAdmin,
  collectionData: { products: collectionProducts },
  searchData: { items: searchItems },
  elements: [
    { id: "collection-context", type: "product-grid", props: { source: "current-collection", limit: 2 } },
    { id: "search-context", type: "product-grid", props: { source: "search-context", limit: 2 } },
    { id: "recent", type: "recently-viewed", props: { limit: 4 } },
    { id: "recommend", type: "product-recommendations", props: { limit: 4 } },
    { id: "upsell", type: "upsell-products", props: { limit: 4 } },
  ],
});
equal(contextCalls, 0, "Context-backed and placeholder grids avoid Admin API calls");
equal(contextResult["collection-context"], collectionProducts.slice(0, 2), "Current-collection grids keep direct collection products");
equal(contextResult["search-context"], [searchItems[0], searchItems[2]], "Search-context grids keep historical product-like filter and limit");
equal(contextResult.recent, [], "Recently-viewed remains an empty server placeholder");
equal(contextResult.recommend, [], "Recommendations remain an empty server placeholder");
equal(contextResult.upsell, [], "Upsell remains an empty server placeholder");

let productCalls = 0;
let collectionCalls = 0;
const admin = {
  async graphql(query, { variables }) {
    if (query.includes("VsnWidgetProducts")) {
      productCalls += 1;
      equal(variables, { first: 3, query: "tag:featured" }, "Widget product query variables remain query+limit based");
      return {
        async json() {
          return {
            data: {
              products: {
                nodes: [
                  {
                    id: "3", title: "Gamma", handle: "gamma", createdAt: "2024-01-01T00:00:00Z",
                    priceRangeV2: { minVariantPrice: { amount: "30", currencyCode: "USD" } },
                    variants: { nodes: [{ availableForSale: true }] },
                  },
                  {
                    id: "1", title: "Alpha", handle: "alpha", createdAt: "2026-01-01T00:00:00Z",
                    priceRangeV2: { minVariantPrice: { amount: "10", currencyCode: "USD" } },
                    variants: { nodes: [{ availableForSale: true }] },
                  },
                  {
                    id: "2", title: "Beta", handle: "beta", createdAt: "2025-01-01T00:00:00Z",
                    priceRangeV2: { minVariantPrice: { amount: "20", currencyCode: "USD" } },
                    variants: { nodes: [{ availableForSale: false }] },
                  },
                ],
              },
            },
          };
        },
      };
    }
    if (query.includes("VsnWidgetCollections")) {
      collectionCalls += 1;
      equal(variables, { first: 2, query: "featured" }, "Widget collection query variables remain query+limit based");
      return {
        async json() {
          return {
            data: {
              collections: {
                nodes: [
                  { id: "c2", title: "Zulu", handle: "zulu" },
                  { id: "c1", title: "Alpha", handle: "alpha" },
                ],
              },
            },
          };
        },
      };
    }
    throw new Error("unexpected query");
  },
};

const loaded = await loadWidgetGridData({
  admin,
  elements: [
    { id: "title", type: "product-grid", props: { query: "tag:featured", limit: 3, sortBy: "title-asc" } },
    { id: "price", type: "product-card", props: { query: "tag:featured", limit: 3, sortBy: "price-desc" } },
    { id: "newest", type: "product-grid", props: { query: "tag:featured", limit: 3, sortBy: "newest" } },
    { id: "collections-a", type: "collection-grid", props: { query: "featured", limit: 2, sortBy: "title-asc" } },
    { id: "collections-b", type: "collection-grid", props: { query: "featured", limit: 2, sortBy: "title-desc" } },
  ],
});

equal(productCalls, 1, "Product widget queries remain cached by query+limit across sort variants");
equal(collectionCalls, 1, "Collection widget queries remain cached by query+limit across sort variants");
equal(loaded.title.map((item) => item.title), ["Alpha", "Beta", "Gamma"], "Title-ascending product sort remains stable");
equal(loaded.price.map((item) => item.title), ["Gamma", "Beta", "Alpha"], "Price-descending product sort remains stable");
equal(loaded.newest.map((item) => item.title), ["Alpha", "Beta", "Gamma"], "Newest product sort remains stable");
equal(loaded["collections-a"].map((item) => item.title), ["Alpha", "Zulu"], "Collection title-ascending sort remains stable");
equal(loaded["collections-b"].map((item) => item.title), ["Zulu", "Alpha"], "Collection title-descending sort remains stable");
ok(loaded.title.every((item) => "availableForSale" in item && "price" in item), "Widget product query still uses shared product projection");

const originalWarn = console.warn;
console.warn = () => {};
try {
  let failures = 0;
  const failingAdmin = {
    async graphql() {
      failures += 1;
      throw new Error("offline");
    },
  };
  const failed = await loadWidgetGridData({
    admin: failingAdmin,
    elements: [
      { id: "p1", type: "product-grid", props: { query: "same", limit: 2 } },
      { id: "p2", type: "product-card", props: { query: "same", limit: 2 } },
      { id: "c1", type: "collection-grid", props: { query: "same", limit: 2 } },
      { id: "c2", type: "collection-grid", props: { query: "same", limit: 2 } },
    ],
  });
  equal(failures, 2, "Failed product and collection queries are cached independently");
  equal(failed, { p1: [], p2: [], c1: [], c2: [] }, "Widget query failures remain isolated to empty results");
} finally {
  console.warn = originalWarn;
}

equal(await loadWidgetGridData({ admin: null, elements: requestElements }), {}, "Missing Admin client remains a safe empty result");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const mapperSource = fs.readFileSync("app/storefront/productMapper.js", "utf8");
const widgetSource = fs.readFileSync("app/storefront/widgetGridData.server.js", "utf8");
const querySource = fs.readFileSync("app/storefront/productQueries.server.js", "utf8");

ok(querySource.includes('from "./productMapper.js"'), "Product query boundary imports shared product mapper");
ok(route.includes('from "../storefront/widgetGridData.server.js"'), "Builder proxy imports widget-grid data boundary");
ok(route.includes("loadWidgetGridData({ admin, elements: resolvedElements, collectionData, searchData })"), "Builder proxy keeps existing widget-grid call site");
for (const duplicate of ["function mapProductNode(", "function collectWidgetGridRequests(", "async function loadWidgetGridData("]) {
  ok(!route.includes(duplicate), `Builder proxy must not retain extracted helper: ${duplicate}`);
}
for (const marker of ["availableForSale", "Product image", '"USD"']) {
  ok(mapperSource.includes(marker), `Product mapper contract marker missing: ${marker}`);
}
for (const marker of ["STOREFRONT_WIDGET_GRID_REQUEST_LIMIT", "VsnWidgetProducts", "VsnWidgetCollections", "current-collection", "search-context"]) {
  ok(widgetSource.includes(marker), `Widget-grid boundary marker missing: ${marker}`);
}
for (const forbidden of ["db.", "fetch(", "authenticate.", "builderPage.", "Response(", "renderBuilder", "shopify.server"]) {
  ok(!mapperSource.includes(forbidden), `Product mapper gained unrelated authority: ${forbidden}`);
  ok(!widgetSource.includes(forbidden), `Widget-grid boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6d storefront widget-grid data audit: PASS (${checks}/${checks})`);
