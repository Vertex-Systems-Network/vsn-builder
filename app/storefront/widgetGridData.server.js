import { normalizeGridProps } from "../builder/dataGridWidget.js";
import { mapProductNode } from "./productMapper.js";

export const STOREFRONT_WIDGET_GRID_REQUEST_LIMIT = 40;

const WIDGET_GRID_TYPES = new Set([
  "product-grid",
  "product-card",
  "collection-grid",
  "product-recommendations",
  "recently-viewed",
  "upsell-products",
]);

export function collectWidgetGridRequests(elements = []) {
  const requests = [];
  const walk = (nodes = []) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (WIDGET_GRID_TYPES.has(node?.type)) {
        requests.push({
          id: String(node.id || ""),
          type: node.type,
          props: normalizeGridProps(node.type, node.props || {}),
        });
      }
      walk(node?.children || []);
    }
  };
  walk(elements);
  return requests.slice(0, STOREFRONT_WIDGET_GRID_REQUEST_LIMIT);
}

export async function loadWidgetGridData({
  admin,
  elements = [],
  collectionData = null,
  searchData = null,
}) {
  const requests = collectWidgetGridRequests(elements);
  const result = {};
  if (!admin || !requests.length) return result;

  const productRequests = requests.filter(
    (item) => item.type !== "collection-grid",
  );
  const collectionRequests = requests.filter(
    (item) => item.type === "collection-grid",
  );

  const productCache = new Map();
  for (const item of productRequests) {
    if (
      item.type === "recently-viewed" ||
      item.type === "product-recommendations" ||
      item.type === "upsell-products"
    ) {
      result[item.id] = [];
      continue;
    }

    if (
      item.type === "product-grid" &&
      item.props.source === "current-collection" &&
      Array.isArray(collectionData?.products)
    ) {
      result[item.id] = collectionData.products.slice(0, item.props.limit);
      continue;
    }

    if (
      item.type === "product-grid" &&
      item.props.source === "search-context" &&
      Array.isArray(searchData?.items)
    ) {
      result[item.id] = searchData.items
        .filter(
          (entry) =>
            String(entry?.type || "").toLowerCase() === "product" ||
            entry?.productType ||
            entry?.price,
        )
        .slice(0, item.props.limit);
      continue;
    }

    const query = String(item.props.query || "").trim();
    const key = `${query}|${item.props.limit}`;
    if (!productCache.has(key)) {
      try {
        const response = await admin.graphql(
          `#graphql
          query VsnWidgetProducts($first:Int!,$query:String){
            products(first:$first,query:$query){nodes{
              id title handle vendor productType createdAt
              featuredImage{url altText width height}
              priceRangeV2{minVariantPrice{amount currencyCode}}
              compareAtPriceRange{minVariantCompareAtPrice{amount currencyCode}}
              variants(first:10){nodes{availableForSale}}
            }}
          }`,
          {
            variables: {
              first: Math.min(50, item.props.limit),
              query: query || null,
            },
          },
        );
        const json = await response.json();
        const nodes = Array.isArray(json.data?.products?.nodes)
          ? json.data.products.nodes.map(mapProductNode)
          : [];
        productCache.set(key, nodes);
      } catch (error) {
        console.warn(
          "VSN widget product query failed",
          error?.message || error,
        );
        productCache.set(key, []);
      }
    }

    let nodes = [...(productCache.get(key) || [])];
    if (item.props.sortBy === "title-asc") {
      nodes.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || "")),
      );
    }
    if (item.props.sortBy === "title-desc") {
      nodes.sort((a, b) =>
        String(b.title || "").localeCompare(String(a.title || "")),
      );
    }
    if (
      item.props.sortBy === "price-asc" ||
      item.props.sortBy === "price-desc"
    ) {
      const amount = (product) =>
        Number(
          product?.price?.amount ??
            product?.priceRangeV2?.minVariantPrice?.amount ??
            0,
        );
      nodes.sort((a, b) =>
        item.props.sortBy === "price-asc"
          ? amount(a) - amount(b)
          : amount(b) - amount(a),
      );
    }
    if (item.props.sortBy === "newest") {
      nodes.sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    }
    result[item.id] = nodes.slice(0, item.props.limit);
  }

  const collectionCache = new Map();
  for (const item of collectionRequests) {
    const query = String(item.props.query || "").trim();
    const key = `${query}|${item.props.limit}`;
    if (!collectionCache.has(key)) {
      try {
        const response = await admin.graphql(
          `#graphql
          query VsnWidgetCollections($first:Int!,$query:String){
            collections(first:$first,query:$query){nodes{id title handle description image{url altText width height} productsCount{count}}}
          }`,
          {
            variables: {
              first: Math.min(50, item.props.limit),
              query: query || null,
            },
          },
        );
        const json = await response.json();
        collectionCache.set(
          key,
          Array.isArray(json.data?.collections?.nodes)
            ? json.data.collections.nodes
            : [],
        );
      } catch (error) {
        console.warn(
          "VSN widget collection query failed",
          error?.message || error,
        );
        collectionCache.set(key, []);
      }
    }

    let nodes = [...(collectionCache.get(key) || [])];
    if (item.props.sortBy === "title-asc") {
      nodes.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || "")),
      );
    }
    if (item.props.sortBy === "title-desc") {
      nodes.sort((a, b) =>
        String(b.title || "").localeCompare(String(a.title || "")),
      );
    }
    result[item.id] = nodes.slice(0, item.props.limit);
  }

  return result;
}
