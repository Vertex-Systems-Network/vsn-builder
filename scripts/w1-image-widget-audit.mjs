import fs from "node:fs";
import assert from "node:assert/strict";
import { widgetRegistry } from "../app/builder/widgetRegistry.js";
import {
  normalizeImageWidgetProps,
  resolveImageSource,
  buildImageRenderUrl,
  imageResolutionDimensions,
  imageAltText,
  imageCaptionText,
  imageLinkHref,
} from "../app/builder/imageWidget.js";

const image = widgetRegistry.image;
assert.ok(image, "Image widget must remain registered");
for (const key of ["sourceType","src","media","externalUrl","resolution","customWidth","customHeight","altMode","alt","captionMode","caption","linkType","linkUrl","openNewTab","lightbox","loading","fetchPriority"]) {
  assert.ok(Object.hasOwn(image.props, key), `Image registry missing ${key}`);
}

const shopify = normalizeImageWidgetProps({
  sourceType: "shopify",
  media: { url: "https://cdn.shopify.com/s/files/1/0000/files/photo.jpg?v=123", alt: "Media alt", width: 2400, height: 1600 },
  resolution: "800",
  altMode: "media",
  captionMode: "media",
  linkType: "media",
  loading: "eager",
  fetchPriority: "high",
});
const shopifySource = resolveImageSource(shopify, {});
assert.equal(shopifySource, shopify.media.url);
const transformed = buildImageRenderUrl(shopifySource, shopify, shopify.media);
assert.match(transformed, /[?&]width=800(?:&|$)/, "Shopify CDN resolution must add width=800");
assert.match(transformed, /[?&]v=123(?:&|$)/, "Shopify CDN transform must preserve version query");
assert.equal(imageAltText(shopify, shopify.media), "Media alt");
assert.equal(imageCaptionText(shopify, shopify.media), "Media alt");
assert.equal(imageLinkHref(shopify, shopifySource), shopifySource);

const custom = normalizeImageWidgetProps({ sourceType: "external", externalUrl: "https://images.example.com/photo.jpg", resolution: "custom", customWidth: 1200, customHeight: 700, altMode: "decorative", captionMode: "custom", caption: "Caption", linkType: "custom", linkUrl: "/pages/lookbook" });
assert.equal(resolveImageSource(custom, {}), custom.externalUrl);
assert.equal(buildImageRenderUrl(custom.externalUrl, custom, {}), custom.externalUrl, "External URLs must not receive Shopify CDN query transforms");
assert.deepEqual(imageResolutionDimensions(custom, {}), { width: 1200, height: 700 });
assert.equal(imageAltText(custom, {}), "");
assert.equal(imageCaptionText(custom, {}), "Caption");
assert.equal(imageLinkHref(custom, custom.externalUrl), "/pages/lookbook");

const properties = fs.readFileSync("app/components/editor/PropertiesPanel.jsx", "utf8");
for (const label of ["Image Source","Shopify Image","Image URL","Render Resolution","Custom Width (px)","Custom Height (px)","Alt Text","Caption","Link","Open in new tab","Open media in lightbox","Loading","Fetch Priority"]) {
  assert.ok(properties.includes(label), `Image inspector missing ${label}`);
}
assert.ok(properties.includes('selectedElement.type !== "image" ? <MediaControl'), "Legacy Advanced Media control must be hidden for rebuilt Image widget");
assert.ok(properties.includes('selectedElement.type !== "image" ? <ImageDimensionsControl'), "Legacy Advanced Image Dimensions control must be hidden for rebuilt Image widget");

const canvas = fs.readFileSync("app/components/editor/Canvas.jsx", "utf8");
const preview = fs.readFileSync("app/components/editor/PreviewRenderer.jsx", "utf8");
const storefront = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const runtime = fs.readFileSync("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js", "utf8");
for (const [name, source] of [["Canvas", canvas],["Preview", preview],["Storefront", storefront]]) {
  assert.ok(source.includes("buildImageRenderUrl"), `${name} must use shared render-resolution helper`);
  assert.ok(source.includes("imageAltText"), `${name} must use shared alt-text contract`);
  assert.ok(source.includes("imageCaptionText"), `${name} must use shared caption contract`);
  assert.ok(source.includes("imageLinkHref"), `${name} must use shared link contract`);
}
assert.match(storefront, /const height = [\s\S]{0,180}cssSize\(style\.height, "auto"\)/, "Storefront Image renderer must define height before output");
assert.ok(storefront.includes('fetchpriority="${fetchPriority}"'), "Storefront Image must emit fetchpriority");
assert.ok(storefront.includes('data-vsn-lightbox="1"'), "Storefront Image must emit lightbox metadata");
assert.ok(runtime.includes("openImageLightbox"), "Theme runtime must implement Image lightbox");
assert.ok(runtime.includes("[data-vsn-lightbox='1']"), "Theme runtime must bind lightbox click delegation");

console.log("W1 Image registry/options: PASS");
console.log("W1 Shopify CDN resolution/custom dimensions: PASS");
console.log("W1 Canvas/Preview/Storefront parity: PASS");
console.log("W1 Image lightbox runtime: PASS");
console.log("W1 audit: PASS");
