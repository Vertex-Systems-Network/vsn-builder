export function mapProductNode(product) {
  const variants = Array.isArray(product?.variants?.nodes)
    ? product.variants.nodes
    : [];

  const availableForSale = variants.some(
    (variant) => variant?.availableForSale === true,
  );

  return {
    id: product?.id || "",
    title: product?.title || "",
    handle: product?.handle || "",
    url: product?.handle ? `/products/${product.handle}` : "#",
    availableForSale,
    vendor: product?.vendor || "",
    productType: product?.productType || "",
    createdAt: product?.createdAt || "",
    image: product?.featuredImage
      ? {
          url: product.featuredImage.url || "",
          altText:
            product.featuredImage.altText ||
            product.title ||
            "Product image",
          width: product.featuredImage.width || null,
          height: product.featuredImage.height || null,
        }
      : null,
    price: {
      amount: product?.priceRangeV2?.minVariantPrice?.amount || "0",
      currencyCode:
        product?.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
    },
    compareAtPrice: {
      amount:
        product?.compareAtPriceRange?.minVariantCompareAtPrice?.amount || "",
      currencyCode:
        product?.compareAtPriceRange?.minVariantCompareAtPrice?.currencyCode ||
        "",
    },
  };
}
