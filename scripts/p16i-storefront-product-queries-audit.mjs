import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fetchAllProductsForPriceSort,
  getAllProducts,
  getAllProductsPage,
  getCollectionByHandle,
  getCollectionProductsPage,
  getProductByHandle,
} from "../app/storefront/productQueries.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const productNode = (id, title, amount, available = true) => ({
  id: `gid://shopify/Product/${id}`,
  title,
  handle: title.toLowerCase(),
  vendor: "VSN",
  productType: "Demo",
  featuredImage: { url: `${id}.jpg`, altText: "", width: 800, height: 600 },
  priceRangeV2: { minVariantPrice: { amount: String(amount), currencyCode: "USD" } },
  compareAtPriceRange: { minVariantCompareAtPrice: { amount: "", currencyCode: "" } },
  variants: { nodes: [{ availableForSale: available }] },
});

let collectionCalls = 0;
const collectionAdmin = {
  async graphql(query, { variables }) {
    collectionCalls += 1;
    ok(query.includes("query GetBuilderCollection("), "Collection lookup keeps GraphQL operation");
    equal(variables, {
      query: "handle:summer",
      first: 24,
      sortKey: "TITLE",
      reverse: false,
    }, "Collection lookup preserves handle query, page clamp and sort config");
    return {
      async json() {
        return {
          data: {
            collections: {
              nodes: [{
                id: "gid://shopify/Collection/1",
                title: "Summer",
                handle: "summer",
                description: "Seasonal",
                productsCount: { count: 2 },
                image: { url: "collection.jpg", altText: "", width: 1200, height: 800 },
                products: {
                  nodes: [productNode(1, "Beta", 20), productNode(2, "Alpha", 10, false)],
                  pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                },
              }],
            },
          },
        };
      },
    };
  },
};
const collection = await getCollectionByHandle({
  admin: collectionAdmin,
  handle: "summer",
  pageSize: 999,
  sortBy: "title-asc",
});
equal(collectionCalls, 1, "Collection lookup performs one Admin query");
equal(collection.id, "gid://shopify/Collection/1", "Collection ID mapping preserved");
equal(collection.productCount, 2, "Collection product count mapping preserved");
equal(collection.products.map((p) => p.title), ["Beta", "Alpha"], "Collection product order remains Shopify order");
equal(collection.products[0].availableForSale, true, "Collection product mapper remains shared");
equal(collection.products[1].availableForSale, false, "Collection availability mapping preserved");
equal(collection.pageInfo, { hasNextPage: true, endCursor: "cursor-1" }, "Collection pageInfo mapping preserved");
equal(collection.image, {
  url: "collection.jpg",
  altText: "Summer",
  width: 1200,
  height: 800,
}, "Collection image title fallback preserved");

equal(await getCollectionByHandle({ admin: null, handle: "summer" }), null, "Collection lookup fails soft without Admin");
equal(await getCollectionByHandle({ admin: collectionAdmin, handle: "" }), null, "Collection lookup fails soft without handle");

let pageCalls = 0;
const collectionPageAdmin = {
  async graphql(query, { variables }) {
    pageCalls += 1;
    ok(query.includes("GetBuilderCollectionProductsPage"), "Collection pagination keeps GraphQL operation");
    equal(variables, {
      query: "handle:summer",
      after: "after-1",
      first: 7,
      sortKey: "PRICE",
      reverse: true,
    }, "Collection pagination preserves cursor, size and sort variables");
    return {
      async json() {
        return {
          data: {
            collections: {
              nodes: [{
                products: {
                  nodes: [productNode(3, "Gamma", 30)],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              }],
            },
          },
        };
      },
    };
  },
};
const collectionPage = await getCollectionProductsPage({
  admin: collectionPageAdmin,
  handle: "summer",
  afterCursor: "after-1",
  pageSize: 7,
  sortBy: "price-desc",
});
equal(pageCalls, 1, "Collection pagination performs one Admin query");
equal(collectionPage.products.map((p) => p.title), ["Gamma"], "Collection pagination maps products");
equal(collectionPage.pageInfo, { hasNextPage: false, endCursor: null }, "Collection pagination maps pageInfo");

let snapshotCalls = 0;
const snapshotAdmin = {
  async graphql(query, { variables }) {
    snapshotCalls += 1;
    ok(query.includes("GetAllProductsPriceSnapshot"), "Price snapshot keeps dedicated GraphQL operation");
    if (snapshotCalls === 1) {
      equal(variables, { after: null }, "Price snapshot starts without cursor");
      return {
        async json() {
          return {
            data: {
              products: {
                nodes: [productNode(10, "Expensive", 99)],
                pageInfo: { hasNextPage: true, endCursor: "snapshot-1" },
              },
            },
          };
        },
      };
    }
    equal(variables, { after: "snapshot-1" }, "Price snapshot advances cursor");
    return {
      async json() {
        return {
          data: {
            products: {
              nodes: [productNode(11, "Cheap", 5)],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        };
      },
    };
  },
};
const snapshot = await fetchAllProductsForPriceSort(snapshotAdmin);
equal(snapshotCalls, 2, "Price snapshot follows Shopify pagination");
equal(snapshot.map((p) => p.title), ["Expensive", "Cheap"], "Price snapshot accumulates mapped products");

let brokenCursorCalls = 0;
const brokenCursorAdmin = {
  async graphql() {
    brokenCursorCalls += 1;
    return {
      async json() {
        return {
          data: {
            products: {
              nodes: [productNode(20, "Only", 1)],
              pageInfo: { hasNextPage: true, endCursor: null },
            },
          },
        };
      },
    };
  },
};
const brokenSnapshot = await fetchAllProductsForPriceSort(brokenCursorAdmin);
equal(brokenCursorCalls, 1, "Price snapshot stops if hasNextPage lacks end cursor");
equal(brokenSnapshot.length, 1, "Broken-cursor snapshot returns products already fetched");

let allCalls = 0;
const allAdmin = {
  async graphql(query, { variables }) {
    allCalls += 1;
    ok(query.includes("GetBuilderAllProducts("), "All-products lookup keeps GraphQL operation");
    equal(variables, { first: 24, sortKey: "CREATED_AT", reverse: true }, "All-products lookup preserves clamp and newest config");
    return {
      async json() {
        return {
          data: {
            products: {
              nodes: [productNode(30, "One", 10), productNode(31, "Two", 20)],
              pageInfo: { hasNextPage: true, endCursor: "all-1" },
            },
            productsCount: { count: 42 },
          },
        };
      },
    };
  },
};
const all = await getAllProducts({ admin: allAdmin, pageSize: 100, sortBy: "newest" });
equal(allCalls, 1, "All-products lookup performs one query for non-price sort");
equal(all.productCount, 42, "All-products count uses Shopify count");
equal(all.products.map((p) => p.title), ["One", "Two"], "All-products mapping preserved");
equal(all.pageInfo, { hasNextPage: true, endCursor: "all-1" }, "All-products pageInfo preserved");

let priceSortCalls = 0;
const priceSortAdmin = {
  async graphql(query) {
    priceSortCalls += 1;
    ok(query.includes("GetAllProductsPriceSnapshot"), "Price-sorted all-products uses snapshot query");
    return {
      async json() {
        return {
          data: {
            products: {
              nodes: [
                productNode(40, "Zulu", 30),
                productNode(41, "Alpha", 10),
                productNode(42, "Beta", 20),
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        };
      },
    };
  },
};
const priceSorted = await getAllProducts({ admin: priceSortAdmin, pageSize: 2, sortBy: "price-asc" });
equal(priceSortCalls, 1, "Price-sorted initial page uses one snapshot page when complete");
equal(priceSorted.productCount, 3, "Price-sorted all-products count uses snapshot length");
equal(priceSorted.products.map((p) => p.title), ["Alpha", "Beta"], "Price-asc initial page remains deterministic");
equal(priceSorted.pageInfo, { hasNextPage: true, endCursor: "price:2" }, "Price-sort synthetic cursor preserved");

let allPageCalls = 0;
const allPageAdmin = {
  async graphql(query, { variables }) {
    allPageCalls += 1;
    ok(query.includes("GetBuilderAllProductsPage"), "All-products pagination keeps GraphQL operation");
    equal(variables, {
      after: "cursor-a",
      first: 5,
      sortKey: "TITLE",
      reverse: true,
    }, "All-products pagination preserves cursor, size and title-desc config");
    return {
      async json() {
        return {
          data: {
            products: {
              nodes: [productNode(50, "Last", 50)],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        };
      },
    };
  },
};
const allPage = await getAllProductsPage({
  admin: allPageAdmin,
  afterCursor: "cursor-a",
  pageSize: 5,
  sortBy: "title-desc",
});
equal(allPageCalls, 1, "All-products pagination performs one non-price query");
equal(allPage.products[0].title, "Last", "All-products page maps product nodes");
equal(allPage.pageInfo, { hasNextPage: false, endCursor: null }, "All-products page maps pageInfo");

const pricePage = await getAllProductsPage({
  admin: priceSortAdmin,
  afterCursor: "price:2",
  pageSize: 2,
  sortBy: "price-asc",
});
equal(pricePage.products.map((p) => p.title), ["Zulu"], "Price-sort pagination honors synthetic cursor");
equal(pricePage.pageInfo, { hasNextPage: false, endCursor: null }, "Final price-sort page ends cursor");

let detailCalls = 0;
const detailAdmin = {
  async graphql(query, { variables }) {
    detailCalls += 1;
    ok(query.includes("BuilderProductByHandle"), "Product detail keeps GraphQL operation");
    ok(query.includes("variants(first: 100)"), "Product detail keeps 100-variant query cap");
    ok(query.includes("metafields(first: 30)"), "Product detail keeps 30-metafield query cap");
    equal(variables, { handle: "shirt" }, "Product detail passes handle variable unchanged");
    return {
      async json() {
        return {
          data: {
            productByHandle: {
              id: "gid://shopify/Product/99",
              title: "Shirt",
              handle: "shirt",
              description: "Desc",
              descriptionHtml: "<p>Desc</p>",
              vendor: "VSN",
              productType: "Top",
              tags: ["a"],
              featuredImage: { url: "shirt.jpg" },
              images: { nodes: [{ url: "shirt-2.jpg" }] },
              priceRangeV2: { minVariantPrice: { amount: "10", currencyCode: "USD" } },
              compareAtPriceRange: { minVariantCompareAtPrice: { amount: "15", currencyCode: "USD" } },
              variants: {
                nodes: [
                  {
                    id: "gid://shopify/ProductVariant/1",
                    title: "",
                    sku: null,
                    availableForSale: true,
                    inventoryQuantity: 3,
                    price: "10",
                    compareAtPrice: "15",
                    image: null,
                    selectedOptions: [{ name: "Size", value: "M" }],
                  },
                  {
                    id: "gid://shopify/ProductVariant/2",
                    title: "L",
                    sku: "SKU-L",
                    availableForSale: false,
                    inventoryQuantity: -4,
                    price: "11",
                    compareAtPrice: null,
                    image: { url: "l.jpg" },
                    selectedOptions: [],
                  },
                ],
              },
              metafields: { nodes: [{ namespace: "custom", key: "x", type: "single_line_text_field", value: "y" }] },
            },
          },
        };
      },
    };
  },
};
const detail = await getProductByHandle({ admin: detailAdmin, handle: "shirt" });
equal(detailCalls, 1, "Product detail performs one Admin query");
equal(detail.numericId, "99", "Product detail numeric ID mapping preserved");
equal(detail.availableForSale, true, "Product detail availability is any available variant");
equal(detail.inventoryQuantity, 3, "Product detail inventory sums non-negative finite quantities");
equal(detail.variants[0].variantId, "1", "Variant numeric ID mapping preserved");
equal(detail.variants[0].title, "Default", "Variant default title fallback preserved");
equal(detail.variants[0].sku, "", "Variant SKU fallback preserved");
equal(detail.metafields.length, 1, "Product detail metafields preserved");

const originalError = console.error;
console.error = () => {};
try {
  const graphqlErrorAdmin = {
    async graphql(query) {
      return {
        async json() {
          if (query.includes("GetBuilderCollection(")) return { errors: [{ message: "bad" }] };
          if (query.includes("GetAllProductsPriceSnapshot")) return { errors: [{ message: "bad" }] };
          if (query.includes("GetBuilderAllProducts(")) return { errors: [{ message: "bad" }] };
          if (query.includes("GetBuilderAllProductsPage")) return { errors: [{ message: "bad" }] };
          return { data: { productByHandle: null } };
        },
      };
    },
  };
  equal(await getCollectionByHandle({ admin: graphqlErrorAdmin, handle: "x" }), null, "Collection GraphQL errors fail soft");
  equal(await fetchAllProductsForPriceSort(graphqlErrorAdmin), null, "Price snapshot GraphQL errors fail soft");
  equal(await getAllProducts({ admin: graphqlErrorAdmin }), null, "All-products GraphQL errors fail soft");
  equal(await getAllProductsPage({ admin: graphqlErrorAdmin }), null, "All-products page GraphQL errors fail soft");
  equal(await getProductByHandle({ admin: graphqlErrorAdmin, handle: "missing" }), null, "Missing product fails soft");

  const throwingAdmin = { async graphql() { throw new Error("offline"); } };
  equal(await getCollectionProductsPage({ admin: throwingAdmin, handle: "x" }), null, "Collection page exceptions fail soft");
  equal(await getAllProducts({ admin: throwingAdmin }), null, "All-products exceptions fail soft");
  equal(await getProductByHandle({ admin: throwingAdmin, handle: "x" }), null, "Product detail exceptions fail soft");
} finally {
  console.error = originalError;
}

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const moduleSource = fs.readFileSync("app/storefront/productQueries.server.js", "utf8");

ok(moduleSource.includes('from "./productMapper.js"'), "Product-query boundary reuses shared product mapper");
ok(moduleSource.includes('from "./productPagination.js"'), "Product-query boundary reuses shared pagination contract");

ok(route.includes('from "../storefront/productQueries.server.js"'), "Builder proxy imports extracted product-query boundary");
for (const call of [
  "getCollectionByHandle({",
  "getCollectionProductsPage({",
  "getAllProducts({",
  "getAllProductsPage({",
  "getProductByHandle({",
]) {
  ok(route.includes(call), `Builder proxy keeps product-query call site: ${call}`);
}
for (const duplicate of [
  "async function getCollectionByHandle(",
  "async function getCollectionProductsPage(",
  "async function fetchAllProductsForPriceSort(",
  "async function getAllProducts(",
  "async function getAllProductsPage(",
  "async function getProductByHandle(",
]) {
  ok(!route.includes(duplicate), `Builder proxy no longer owns product-query helper: ${duplicate}`);
}
for (const marker of [
  "GetBuilderCollection",
  "GetBuilderCollectionProductsPage",
  "GetAllProductsPriceSnapshot",
  "first: 250",
  "GetBuilderAllProducts",
  "GetBuilderAllProductsPage",
  "BuilderProductByHandle",
  "variants(first: 100)",
  "metafields(first: 30)",
]) {
  ok(moduleSource.includes(marker), `Product-query boundary marker missing: ${marker}`);
}
for (const forbidden of [
  "db.",
  "fetch(",
  "authenticate.",
  "session.",
  "builderPage.",
  "Response(",
  "renderBuilder",
  "shopify.server",
  "process.env",
]) {
  ok(!moduleSource.includes(forbidden), `Product-query boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6i storefront product query audit: PASS (${checks}/${checks})`);
