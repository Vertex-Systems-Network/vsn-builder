const PRODUCT_SORT_VALUES = new Set([
  "featured",
  "newest",
  "oldest",
  "price-asc",
  "price-desc",
  "title-asc",
  "title-desc",
]);

export function clampProductPageSize(value, fallback = 8) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(24, Math.round(numeric)));
}

export function findCollectionProductPageSize(nodes, fallback = 8) {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    if (node?.type === "collection-product-grid") {
      return clampProductPageSize(node?.props?.limit, fallback);
    }
    const nested = findCollectionProductPageSize(node?.children, 0);
    if (nested > 0) return nested;
  }
  return fallback;
}

export function normalizeProductSort(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PRODUCT_SORT_VALUES.has(normalized) ? normalized : "featured";
}

export function findCollectionProductSort(nodes, fallback = "featured") {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    if (node?.type === "collection-product-grid") {
      return normalizeProductSort(node?.props?.sortBy || fallback);
    }
    const nested = findCollectionProductSort(node?.children, "");
    if (nested) return nested;
  }
  return fallback ? normalizeProductSort(fallback) : "";
}

export function getCollectionSortConfig(sortBy) {
  switch (normalizeProductSort(sortBy)) {
    case "newest":
      return { sortKey: "CREATED", reverse: true };
    case "oldest":
      return { sortKey: "CREATED", reverse: false };
    case "price-asc":
      return { sortKey: "PRICE", reverse: false };
    case "price-desc":
      return { sortKey: "PRICE", reverse: true };
    case "title-asc":
      return { sortKey: "TITLE", reverse: false };
    case "title-desc":
      return { sortKey: "TITLE", reverse: true };
    default:
      return { sortKey: "COLLECTION_DEFAULT", reverse: false };
  }
}

export function getAllProductsSortConfig(sortBy) {
  switch (normalizeProductSort(sortBy)) {
    case "oldest":
      return { sortKey: "CREATED_AT", reverse: false };
    case "title-asc":
      return { sortKey: "TITLE", reverse: false };
    case "title-desc":
      return { sortKey: "TITLE", reverse: true };
    case "newest":
    case "featured":
    default:
      return { sortKey: "CREATED_AT", reverse: true };
  }
}

export function isPriceSort(sortBy) {
  const value = normalizeProductSort(sortBy);
  return value === "price-asc" || value === "price-desc";
}

export function sortProductsByPrice(products, sortBy) {
  const direction = normalizeProductSort(sortBy) === "price-desc" ? -1 : 1;
  return [...products].sort((a, b) => {
    const aPrice = Number(a?.price?.amount || 0);
    const bPrice = Number(b?.price?.amount || 0);
    const difference = (aPrice - bPrice) * direction;
    if (difference !== 0) return difference;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

export function parsePriceSortCursor(cursor) {
  const match = /^price:(\d+)$/.exec(String(cursor || ""));
  return match ? Number(match[1]) : 0;
}

export function buildPriceSortPage(products, pageSize, afterCursor) {
  const size = clampProductPageSize(pageSize, 8);
  const offset = parsePriceSortCursor(afterCursor);
  const pageProducts = products.slice(offset, offset + size);
  const nextOffset = offset + pageProducts.length;
  const hasNextPage = nextOffset < products.length;
  return {
    products: pageProducts,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? `price:${nextOffset}` : null,
    },
  };
}
