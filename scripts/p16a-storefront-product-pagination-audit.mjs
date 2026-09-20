import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildPriceSortPage,
  clampProductPageSize,
  findCollectionProductPageSize,
  findCollectionProductSort,
  getAllProductsSortConfig,
  getCollectionSortConfig,
  isPriceSort,
  normalizeProductSort,
  parsePriceSortCursor,
  sortProductsByPrice,
} from "../app/storefront/productPagination.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(clampProductPageSize("9.6", 8), 10, "Page size keeps numeric rounding behavior");
equal(clampProductPageSize(0, 8), 1, "Page size keeps lower bound");
equal(clampProductPageSize(100, 8), 24, "Page size keeps upper bound");
equal(clampProductPageSize("invalid", 7), 7, "Invalid page size keeps caller fallback");

equal(normalizeProductSort(" TITLE-DESC "), "title-desc", "Sort normalization remains trim/lowercase based");
equal(normalizeProductSort("unknown"), "featured", "Unknown sort remains featured");
equal(getCollectionSortConfig("featured"), { sortKey: "COLLECTION_DEFAULT", reverse: false }, "Featured collection sort remains collection-default");
equal(getCollectionSortConfig("newest"), { sortKey: "CREATED", reverse: true }, "Newest collection sort mapping remains stable");
equal(getCollectionSortConfig("oldest"), { sortKey: "CREATED", reverse: false }, "Oldest collection sort mapping remains stable");
equal(getCollectionSortConfig("price-asc"), { sortKey: "PRICE", reverse: false }, "Ascending collection price mapping remains stable");
equal(getCollectionSortConfig("price-desc"), { sortKey: "PRICE", reverse: true }, "Descending collection price mapping remains stable");
equal(getCollectionSortConfig("title-asc"), { sortKey: "TITLE", reverse: false }, "Ascending collection title mapping remains stable");
equal(getCollectionSortConfig("title-desc"), { sortKey: "TITLE", reverse: true }, "Descending collection title mapping remains stable");

equal(getAllProductsSortConfig("featured"), { sortKey: "CREATED_AT", reverse: true }, "Featured all-products order remains newest-first");
equal(getAllProductsSortConfig("newest"), { sortKey: "CREATED_AT", reverse: true }, "Newest all-products mapping remains stable");
equal(getAllProductsSortConfig("oldest"), { sortKey: "CREATED_AT", reverse: false }, "Oldest all-products mapping remains stable");
equal(getAllProductsSortConfig("title-asc"), { sortKey: "TITLE", reverse: false }, "Ascending all-products title mapping remains stable");
equal(getAllProductsSortConfig("title-desc"), { sortKey: "TITLE", reverse: true }, "Descending all-products title mapping remains stable");
equal(getAllProductsSortConfig("price-asc"), { sortKey: "CREATED_AT", reverse: true }, "Price sorts keep historical non-price config fallback when called directly");

ok(isPriceSort("price-asc") && isPriceSort("price-desc"), "Both price sort modes remain recognized");
ok(!isPriceSort("featured"), "Non-price sort remains excluded");

const tree = [{
  type: "section",
  children: [{
    type: "collection-product-grid",
    props: { limit: 31, sortBy: "TITLE-ASC" },
    children: [],
  }],
}];
equal(findCollectionProductPageSize(tree, 8), 24, "Nested collection grid page size keeps clamp behavior");
equal(findCollectionProductPageSize([], 6), 6, "Missing collection grid keeps size fallback");
equal(findCollectionProductSort(tree, "featured"), "title-asc", "Nested collection grid sort keeps normalization");
equal(findCollectionProductSort([], "newest"), "newest", "Missing collection grid keeps normalized sort fallback");

const products = [
  { id: "b", title: "Beta", price: { amount: "10.00" } },
  { id: "a", title: "Alpha", price: { amount: "10.00" } },
  { id: "c", title: "Cheap", price: { amount: "2.50" } },
];
equal(sortProductsByPrice(products, "price-asc").map((item) => item.id), ["c", "a", "b"], "Ascending price sort keeps title tiebreaker");
equal(sortProductsByPrice(products, "price-desc").map((item) => item.id), ["a", "b", "c"], "Descending price sort keeps title tiebreaker");
equal(products.map((item) => item.id), ["b", "a", "c"], "Price sorting remains non-mutating");

equal(parsePriceSortCursor("price:12"), 12, "Valid synthetic price cursor remains numeric");
equal(parsePriceSortCursor("price:001"), 1, "Synthetic price cursor keeps leading-zero behavior");
equal(parsePriceSortCursor("invalid"), 0, "Invalid price cursor still restarts at zero");

equal(buildPriceSortPage(products, 2, null), {
  products: products.slice(0, 2),
  pageInfo: { hasNextPage: true, endCursor: "price:2" },
}, "First synthetic price page remains stable");
equal(buildPriceSortPage(products, 2, "price:2"), {
  products: products.slice(2, 3),
  pageInfo: { hasNextPage: false, endCursor: null },
}, "Final synthetic price page remains stable");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const helper = fs.readFileSync("app/storefront/productPagination.js", "utf8");
for (const marker of [
  'from "../storefront/productPagination.js"',
  "clampProductPageSize",
  "findCollectionProductPageSize",
  "findCollectionProductSort",
  "getAllProductsSortConfig",
  "getCollectionSortConfig",
  "isPriceSort",
  "sortProductsByPrice",
  "buildPriceSortPage",
]) {
  ok(route.includes(marker), `Builder proxy must consume extracted product pagination helper: ${marker}`);
}
for (const duplicate of [
  "function clampProductPageSize(",
  "function findCollectionProductPageSize(",
  "function normalizeProductSort(",
  "function findCollectionProductSort(",
  "function getCollectionSortConfig(",
  "function getAllProductsSortConfig(",
  "function isPriceSort(",
  "function sortProductsByPrice(",
  "function parsePriceSortCursor(",
  "function buildPriceSortPage(",
]) {
  ok(!route.includes(duplicate), `Builder proxy must not retain extracted helper implementation: ${duplicate}`);
}
for (const forbidden of ["fetch(", "admin.graphql", "db.", "authenticate.", "Response("]) {
  ok(!helper.includes(forbidden), `Extracted pagination boundary must remain pure: ${forbidden}`);
}

console.log(`VSN P1.6a storefront product pagination audit: PASS (${checks}/${checks})`);
