import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSchemaMarkup,
  buildSeoPayload,
  renderableElements,
  safeJsonForHtml,
} from "../app/storefront/presentationMetadata.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

equal(renderableElements(null), [], "Non-array renderable input stays empty");
equal(
  renderableElements([
    { id: "globals", type: "global-styles" },
    { id: "settings", type: "template-settings" },
    { id: "hero", type: "section" },
    null,
  ]),
  [{ id: "hero", type: "section" }, null],
  "Renderable filtering only removes historical non-render nodes",
);

const unsafeJson = safeJsonForHtml({
  title: "</script><script>alert(1)</script>",
  amp: "&",
});
ok(!unsafeJson.includes("<"), "Embedded JSON escapes every less-than character");
ok(
  unsafeJson.includes("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"),
  "Embedded JSON preserves content while blocking script-breakout syntax",
);
equal(JSON.parse(unsafeJson), {
  title: "</script><script>alert(1)</script>",
  amp: "&",
}, "Escaped embedded JSON remains semantically parseable");

equal(
  buildSeoPayload({
    page: { title: "Page title" },
    title: "Explicit title",
    product: {
      title: "Product title",
      description: "Product description",
      featuredImage: { url: "product.jpg" },
    },
    article: {
      title: "Article title",
      excerpt: "Article excerpt",
      image: { url: "article.jpg" },
    },
    settings: {},
  }),
  {
    title: "Product title",
    description: "Product description",
    canonical: "",
    ogTitle: "Product title",
    ogDescription: "Product description",
    ogImage: "product.jpg",
  },
  "Product metadata keeps historical precedence over article/page fallbacks",
);

equal(
  buildSeoPayload({
    page: { title: "Page title" },
    title: "Explicit title",
    article: {
      title: "Article title",
      excerpt: "Article excerpt",
      image: { url: "article.jpg" },
    },
    settings: {},
  }),
  {
    title: "Article title",
    description: "Article excerpt",
    canonical: "",
    ogTitle: "Article title",
    ogDescription: "Article excerpt",
    ogImage: "article.jpg",
  },
  "Article metadata keeps historical fallback precedence",
);

equal(
  buildSeoPayload({
    page: { title: "Page title" },
    title: "Explicit title",
    settings: {
      seoTitle: "SEO override",
      seoDescription: "SEO description",
      canonical: "https://example.com/page",
      ogTitle: "OG override",
      ogDescription: "OG description",
      ogImage: "og.jpg",
    },
    product: {
      title: "Product",
      description: "Product desc",
      featuredImage: { url: "product.jpg" },
    },
  }),
  {
    title: "SEO override",
    description: "SEO description",
    canonical: "https://example.com/page",
    ogTitle: "OG override",
    ogDescription: "OG description",
    ogImage: "og.jpg",
  },
  "Explicit SEO settings stay authoritative over dynamic data",
);

equal(
  buildSeoPayload({
    page: { title: "Page fallback" },
    title: "",
    settings: {},
  }),
  {
    title: "Page fallback",
    description: "",
    canonical: "",
    ogTitle: "Page fallback",
    ogDescription: "",
    ogImage: "",
  },
  "Page title remains final title fallback",
);

const productSchema = buildSchemaMarkup({
  product: {
    id: "gid://shopify/Product/1",
    title: "Danger </script><script>alert(1)</script>",
    description: "Description",
    featuredImage: { url: "product.jpg" },
    variants: [{ sku: "SKU-1", price: "12.50" }],
    availableForSale: true,
  },
});
ok(productSchema.startsWith('<script type="application/ld+json">'), "Product schema keeps JSON-LD script wrapper");
ok(productSchema.endsWith("</script>"), "Product schema closes JSON-LD script wrapper");
const productJsonText = productSchema.slice(
  '<script type="application/ld+json">'.length,
  -"</script>".length,
);
ok(!productJsonText.includes("<"), "Product JSON-LD payload blocks raw less-than characters");
const productJson = JSON.parse(productJsonText);
equal(productJson["@context"], "https://schema.org", "Product schema context preserved");
equal(productJson["@type"], "Product", "Product schema type preserved");
equal(productJson.name, "Danger </script><script>alert(1)</script>", "Product title round-trips after safe JSON escaping");
equal(productJson.sku, "SKU-1", "Product schema keeps first variant SKU");
equal(productJson.offers, {
  "@type": "Offer",
  price: "12.50",
  priceCurrency: "USD",
  availability: "https://schema.org/InStock",
}, "Product schema keeps variant-price fallback, USD fallback, and availability mapping");

const productRangeSchema = buildSchemaMarkup({
  product: {
    id: "gid://shopify/Product/2",
    title: "Range price",
    price: { amount: "20", currencyCode: "CAD" },
    variants: [{ sku: "", price: "9" }],
    availableForSale: false,
  },
});
const productRangeJson = JSON.parse(
  productRangeSchema.slice('<script type="application/ld+json">'.length, -"</script>".length),
);
equal(productRangeJson.offers, {
  "@type": "Offer",
  price: "20",
  priceCurrency: "CAD",
  availability: "https://schema.org/OutOfStock",
}, "Product range price/currency remain authoritative over variant fallback");

const noPriceSchema = buildSchemaMarkup({
  product: {
    id: "gid://shopify/Product/3",
    title: "No price",
    variants: [],
    availableForSale: false,
  },
});
const noPriceJson = JSON.parse(
  noPriceSchema.slice('<script type="application/ld+json">'.length, -"</script>".length),
);
ok(!Object.prototype.hasOwnProperty.call(noPriceJson, "offers"), "Product schema omits offers when no price exists");

const articleSchema = buildSchemaMarkup({
  article: {
    id: "gid://shopify/Article/1",
    title: "Article title",
    excerpt: "Article excerpt",
    publishedAt: "2026-09-20T00:00:00Z",
    author: "Author",
    image: { url: "article.jpg" },
  },
});
const articleJson = JSON.parse(
  articleSchema.slice('<script type="application/ld+json">'.length, -"</script>".length),
);
equal(articleJson, {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Article title",
  description: "Article excerpt",
  datePublished: "2026-09-20T00:00:00Z",
  author: { "@type": "Person", name: "Author" },
  image: ["article.jpg"],
}, "Article schema mapping remains unchanged");

const combinedSchema = buildSchemaMarkup({
  product: {
    id: "p",
    title: "Product",
    variants: [],
    availableForSale: false,
  },
  article: {
    id: "a",
    title: "Article",
  },
});
equal(
  (combinedSchema.match(/<script type="application\/ld\+json">/g) || []).length,
  2,
  "Product and article schemas remain separate JSON-LD script blocks",
);
equal(buildSchemaMarkup({}), "", "No product/article identity produces no schema markup");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/presentationMetadata.js", "utf8");

ok(route.includes('from "../storefront/presentationMetadata.js"'), "Builder proxy imports presentation metadata boundary");
for (const marker of [
  "buildSeoPayload({",
  "buildSchemaMarkup({",
  "renderableElements(elements)",
  "safeJsonForHtml(seoPayload)",
  "pageSettings.schemaEnabled === false",
]) {
  ok(route.includes(marker), `Builder proxy keeps metadata call-site contract: ${marker}`);
}
for (const duplicate of [
  "function renderableElements(",
  "function safeJsonForHtml(",
  "function buildSeoPayload(",
  "function buildSchemaMarkup(",
]) {
  ok(!route.includes(duplicate), `Builder proxy no longer owns metadata helper: ${duplicate}`);
}
for (const marker of [
  '["global-styles", "template-settings"]',
  'replace(/</g, "\\\\u003c")',
  "settings.seoTitle || dynamicTitle",
  "settings.ogImage || product?.featuredImage?.url || article?.image?.url ||",
  '"@context": "https://schema.org"',
  '"@type": "Product"',
  '"@type": "Article"',
  "https://schema.org/InStock",
  "https://schema.org/OutOfStock",
  "safeJsonForHtml(item)",
]) {
  ok(source.includes(marker), `Presentation metadata boundary marker missing: ${marker}`);
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
  "document.",
  "window.",
]) {
  ok(!source.includes(forbidden), `Presentation metadata boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6k storefront presentation metadata audit: PASS (${checks}/${checks})`);
