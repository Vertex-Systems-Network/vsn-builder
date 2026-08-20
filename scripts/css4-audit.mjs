import { auditBatchCss4Profiles, batchCss4Targets, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";
import { buildWidgetSpecificCss } from "../app/builder/widgetSpecificStyleEngine.js";

const groups = auditBatchCss4Profiles();
for (const [name, result] of Object.entries(groups)) {
  if (result.missing.length) throw new Error(`CSS-4 ${name} missing profiles: ${result.missing.join(", ")}`);
  if (result.covered !== result.total) throw new Error(`CSS-4 ${name} coverage mismatch ${result.covered}/${result.total}`);
}

const required = {
  "product-price": ["commercePrice"],
  "product-availability": ["commerceMeta"],
  "product-variant-selector": ["commerceOptions", "form"],
  "collection-product-grid": ["gridCards", "commerceGrid", "collectionTools", "commercePagination"],
  "collection-filters": ["collectionTools", "form"],
  "collection-pagination": ["commercePagination", "button"],
  "cart-drawer": ["cartSurface", "button"],
  "sticky-add-to-cart": ["stickyCart", "button"],
  "product-recommendations": ["commerceGrid", "commerceHeading"],
};
for (const [type, features] of Object.entries(required)) {
  const profile = getWidgetStyleProfile(type);
  for (const feature of features) if (!profile.features.includes(feature)) throw new Error(`${type} missing CSS-4 feature ${feature}`);
}

const priceCss = buildWidgetSpecificCss("product-price", "css4-price", { commercePrice: { color: "#111111", fontSize: "26px", gap: "8px" } });
if (!priceCss.includes("font-size:26px") || !priceCss.includes("color:#111111")) throw new Error("Commerce price CSS missing");

const compareCss = buildWidgetSpecificCss("product-compare-price", "css4-compare", { commercePrice: { compareColor: "#777777", compareOpacity: 0.6, decorationThickness: "2px" } });
if (!compareCss.includes("opacity:0.6") || !compareCss.includes("text-decoration-thickness:2px")) throw new Error("Compare price CSS missing");

const metaCss = buildWidgetSpecificCss("product-availability", "css4-meta", { commerceMeta: { inStockColor: "#008060", soldOutColor: "#d72c0d", pillRadius: "999px" } });
if (!metaCss.includes("data-vsn-stock-state=\"in-stock\"") || !metaCss.includes("border-radius:999px")) throw new Error("Commerce status CSS missing");

const optionsCss = buildWidgetSpecificCss("product-variant-selector", "css4-options", { commerceOptions: { width: "100%", selectedBorderColor: "#111111" } });
if (!optionsCss.includes("width:100%") || !optionsCss.includes("border-color:#111111")) throw new Error("Commerce options CSS missing");

const gridCss = buildWidgetSpecificCss("collection-product-grid", "css4-grid", { commerceGrid: { saleBadgeBackground: "#d72c0d", soldOutBadgeBackground: "#111111", titleClamp: 2, priceColor: "#111111" } });
if (!gridCss.includes("vsn-product-badge-sale") || !gridCss.includes("-webkit-line-clamp:2") || !gridCss.includes("vsn-card-price")) throw new Error("Commerce grid CSS missing");

const toolsCss = buildWidgetSpecificCss("collection-product-grid", "css4-tools", { collectionTools: { padding: "12px", radius: "10px", clearBackground: "#ffffff" } });
if (!toolsCss.includes("data-vsn-grid-id=\"css4-tools\"") || !toolsCss.includes("padding:12px")) throw new Error("Collection toolbar CSS missing");

const paginationCss = buildWidgetSpecificCss("collection-pagination", "css4-pagination", { commercePagination: { alignment: "center", gap: "8px", loadingOpacity: 0.5 } });
if (!paginationCss.includes("justify-content:center") || !paginationCss.includes("opacity:0.5")) throw new Error("Commerce pagination CSS missing");

const cartCss = buildWidgetSpecificCss("cart-drawer", "css4-cart", { cartSurface: { padding: "20px", radius: "14px", shadow: "0 16px 48px rgba(0,0,0,.12)" } });
if (!cartCss.includes("padding:20px") || !cartCss.includes("box-shadow:0 16px 48px")) throw new Error("Cart surface CSS missing");

const stickyCss = buildWidgetSpecificCss("sticky-add-to-cart", "css4-sticky", { stickyCart: { borderWidth: "1px", priceColor: "#666666" } });
if (!stickyCss.includes("border-top-width:1px") || !stickyCss.includes("color:#666666")) throw new Error("Sticky cart CSS missing");

const headingCss = buildWidgetSpecificCss("product-recommendations", "css4-heading", { commerceHeading: { fontSize: "28px", marginBottom: "20px" } });
if (!headingCss.includes("font-size:28px") || !headingCss.includes("margin-bottom:20px")) throw new Error("Commerce heading CSS missing");

const entries = Object.values(batchCss4Targets).flat().length;
const unique = new Set(Object.values(batchCss4Targets).flat()).size;
console.log(`CSS-4 target profile entries: ${entries}/${entries} (${unique} unique widgets)`);
console.log("Product/Collection/Commerce/Grid-Card renderer checks: PASS");
console.log("Batch CSS-4 audit: PASS");
