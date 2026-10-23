import assert from "node:assert/strict";
import fs from "node:fs";
import {
  productTypographyStyle,
  renderProductAction,
  renderProductAvailability,
  renderProductDescription,
  renderProductGallery,
  renderProductImage,
  renderProductMeta,
  renderProductMetafield,
  renderProductPrice,
  renderProductQuantity,
  renderProductTitle,
  renderProductVariantSelector,
} from "../app/storefront/productWidgets.js";

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};

const product = {
  title: "Tee <b>",
  vendor: "Acme",
  description: "Line 1\nLine 2",
  availableForSale: true,
  inventoryQuantity: 3,
  price: { amount: "20", currencyCode: "USD" },
  compareAtPrice: { amount: "25", currencyCode: "USD" },
  featuredImage: { url: "https://cdn.example/a.jpg", altText: "A" },
  images: [{ url: "https://cdn.example/a.jpg", altText: "A" }, { url: "https://cdn.example/b.jpg", altText: "B" }],
  variants: [
    { variantId: "v1", title: "Small", sku: "SKU-1", price: "20", availableForSale: false },
    { variantId: "v2", title: "Large", sku: "SKU-2", price: "22", availableForSale: true },
  ],
  metafields: [{ namespace: "custom", key: "care", value: "Wash cold" }],
};
const ctx = { product };
const node = (type) => ({ id: `n-${type}`, type });

const typo = productTypographyStyle({ typography: { color: '"red"', fontSize: 12 } }, { fontWeight: "700" });
ok(typo.includes("color: &quot;red&quot;") && typo.includes("font-size: 12px") && typo.includes("font-weight: 700"), "Typography escapes values and applies defaults");

const title = renderProductTitle(node("product-title"), { tag: "script" }, {}, ctx);
ok(title.startsWith("<h1 ") && title.includes("Tee &lt;b&gt;"), "Title rejects unknown tags and escapes product title");
ok(renderProductTitle(node("t"), { tag: "h3" }, {}, {}).includes("Product Title"), "Title falls back without a product");

const image = renderProductImage(node("product-image"), { lightbox: true }, {}, ctx);
ok(image.includes('class="vsn-product-main-image"') && image.includes("data-vsn-lightbox=\"1\""), "Product image supports lightbox");
ok(renderProductImage(node("i"), {}, {}, {}).includes("data:image/svg+xml"), "Product image falls back to a placeholder");

const gallery = renderProductGallery(node("product-gallery"), { thumbnailPosition: "left", thumbnailSize: 999 }, {}, ctx);
equal((gallery.match(/vsn-product-gallery-thumb/g) || []).length, 3, "Gallery renders one thumb per image plus the container class");
ok(gallery.includes("is-thumbs-left") && gallery.includes("140px 1fr"), "Gallery clamps thumbnail size and honours side position");
ok(renderProductGallery(node("g"), { thumbnailPosition: "evil" }, {}, ctx).includes("is-thumbs-bottom"), "Gallery falls back to bottom thumbnails");

ok(renderProductPrice(node("p"), {}, {}, ctx, false).includes("$20.00"), "Price formats money");
ok(renderProductPrice(node("p"), {}, {}, ctx, true).includes("line-through"), "Compare price is struck through");
equal(renderProductPrice(node("p"), {}, {}, { product: { price: product.price } }, true), "", "Missing compare price renders nothing");
ok(renderProductPrice(node("p"), {}, {}, {}, false).includes("—"), "Missing price renders a dash");

ok(renderProductDescription(node("d"), {}, {}, ctx).includes("Line 1<br>Line 2"), "Plain description converts newlines");
ok(renderProductDescription(node("d"), {}, {}, { product: { descriptionHtml: "<p>Rich</p>" } }).includes("<p>Rich</p>"), "Shopify descriptionHtml is passed through as before");

ok(renderProductMeta(node("m"), {}, {}, ctx, "sku").includes("SKU: ") && renderProductMeta(node("m"), {}, {}, ctx, "sku").includes("SKU-1"), "SKU meta uses first variant");
ok(renderProductMeta(node("m"), {}, {}, ctx, "vendor").includes("Acme"), "Vendor meta uses product vendor");

const low = renderProductAvailability(node("inventory-status"), { lowThreshold: 5 }, {}, ctx);
ok(low.includes('data-vsn-stock-state="low-stock"') && low.includes("Low stock"), "Inventory widget reports low stock under threshold");
ok(renderProductAvailability(node("product-availability"), {}, {}, ctx).includes('data-vsn-stock-state="in-stock"'), "Availability widget ignores low-stock state");
ok(renderProductAvailability(node("product-availability"), {}, {}, { product: { availableForSale: false } }).includes("Sold out"), "Unavailable products are sold out");

const select = renderProductVariantSelector(node("v"), {}, {}, ctx);
ok(select.includes('value="v1"') && select.includes("disabled") && select.includes("Small — Sold out"), "Sold-out variants are disabled by default");
ok(!renderProductVariantSelector(node("v"), { disableSoldOut: false }, {}, ctx).includes("disabled"), "disableSoldOut=false keeps variants selectable");

const qty = renderProductQuantity(node("q"), { min: 0, max: -5, step: 0 });
ok(qty.includes('min="1"') && qty.includes('max="1"') && qty.includes('step="1"'), "Quantity clamps min, max and step");

const add = renderProductAction(node("a"), {}, {}, ctx, false);
ok(add.includes("vsn-product-add-to-cart") && add.includes('data-vsn-default-variant-id="v2"'), "Add to cart defaults to first available variant");
ok(renderProductAction(node("a"), {}, {}, { product: { availableForSale: false, variants: [] } }, true).includes("disabled"), "Buy now is disabled for unavailable products");

ok(renderProductMetafield(node("mf"), { key: "care" }, {}, ctx).includes("Wash cold"), "Metafield renders matching custom value");
equal(renderProductMetafield(node("mf"), { key: "none" }, {}, ctx), "", "Missing metafield without label renders nothing");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/productWidgets.js", "utf8");
ok(route.includes('from "../storefront/productWidgets.js"'), "Builder proxy imports product-widget boundary");
for (const name of ["productTypographyStyle", "renderProductTitle", "renderProductGallery", "renderProductPrice", "renderProductAvailability", "renderProductVariantSelector", "renderProductAction", "renderProductMetafield"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
ok(route.includes("function renderProductRecommendations("), "Recommendations stay in the route with getNodeSpacing");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Product-widget boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6s storefront product widgets audit: PASS (${checks}/${checks})`);
