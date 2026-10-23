import { contextImageAlt, contextImageUrl, normalizeContextImageProps } from "../builder/contextMediaWidget.js";
import { toCssSize } from "./designTokens.js";
import { formatMoney } from "./dynamicSource.js";
import { escapeAttribute, escapeHtml } from "./safeCss.js";

export function productTypographyStyle(styles = {}, defaults = {}) {
	const typography = styles.typography || styles || {};
	return `
		color: ${escapeAttribute(typography.color || defaults.color || "#1a1a1a")};
		font-size: ${toCssSize(typography.fontSize, defaults.fontSize || "16px")};
		font-weight: ${escapeAttribute(typography.fontWeight || defaults.fontWeight || "400")};
		line-height: ${escapeAttribute(typography.lineHeight || defaults.lineHeight || "1.4")};
		text-align: ${escapeAttribute(typography.textAlign || "left")};
	`;
}

export function renderProductTitle(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const tag = ["h1","h2","h3","h4","h5","h6"].includes(String(props.tag || "h1")) ? String(props.tag || "h1") : "h1";
	return `<${tag} data-vsn-id="${escapeAttribute(node.id || "")}" style="margin:0;${productTypographyStyle(styles,{fontSize:"42px",fontWeight:"700"})}">${escapeHtml(product.title || props.fallbackText || "Product Title")}</${tag}>`;
}

export function renderProductImage(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const media=product.featuredImage||product.images?.[0]||{}; const settings=normalizeContextImageProps(props); const source=contextImageUrl(media,settings) || "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f1f1f1'/%3E%3C/svg%3E"; const alt=contextImageAlt(media,settings,product.title||"Product image");
  const width=toCssSize(styles?.size?.width||styles.width,"100%"); const height=toCssSize(styles?.size?.height||styles.height,"auto"); const radius=toCssSize(styles?.border?.radius||styles.borderRadius,"0px");
  const image=`<img data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-product-main-image" src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" style="display:block;width:${width};height:${height};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${radius};">`;
  return settings.lightbox?`<a href="${escapeAttribute(media.url||source)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url||source)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${image}</a>`:image;
}

export function renderProductGallery(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const images=(Array.isArray(product.images)?product.images:[]); const all=images.length?images:(product.featuredImage?[product.featuredImage]:[]); const first=product.featuredImage||all[0]||{}; const settings=normalizeContextImageProps(props); const source=contextImageUrl(first,settings)||first.url||""; const alt=contextImageAlt(first,settings,product.title||"Product image");
  const width=toCssSize(styles?.size?.width||styles.width,"100%"); const height=toCssSize(styles?.size?.height||styles.height,"560px"); const radius=toCssSize(styles?.border?.radius||styles.borderRadius,"12px"); const thumbSize=Math.max(44,Math.min(140,Number(props.thumbnailSize||76))); const thumbGap=Math.max(0,Math.min(40,Number(props.thumbnailGap||10)));
  const thumbSettings={...settings,resolution:props.thumbnailResolution||"320",customWidth:"",customHeight:"",lightbox:false};
  const thumbs=props.showThumbnails===false?"":all.map((image,index)=>{const thumb=contextImageUrl(image,thumbSettings)||image.url||""; const target=contextImageUrl(image,settings)||image.url||""; return `<button type="button" class="vsn-product-gallery-thumb${index===0?" is-active":""}" data-vsn-gallery-src="${escapeAttribute(target)}" data-vsn-gallery-original="${escapeAttribute(image.url||target)}" data-vsn-gallery-alt="${escapeAttribute(contextImageAlt(image,settings,product.title||"Product image"))}" style="width:${thumbSize}px;height:${thumbSize}px;border:1px solid #d9d9d9;border-radius:8px;padding:0;overflow:hidden;background:#fff;cursor:pointer;"><img src="${escapeAttribute(thumb)}" alt="${escapeAttribute(image.altText||"")}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></button>`}).join("");
  const main=`<img class="vsn-product-gallery-main vsn-product-main-image" src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" style="display:block;width:100%;height:${height};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${radius};">`;
  const visual=settings.lightbox?`<a class="vsn-product-gallery-lightbox" href="${escapeAttribute(first.url||source)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(first.url||source)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${main}</a>`:main;
  const pos=["top","bottom","left","right"].includes(props.thumbnailPosition)?props.thumbnailPosition:"bottom"; const side=pos==="left"||pos==="right"; const thumbHtml=`<div class="vsn-product-gallery-thumbs" style="display:${props.showThumbnails===false?"none":"flex"};${side?"flex-direction:column;":""}gap:${thumbGap}px;flex-wrap:wrap;">${thumbs}</div>`;
  return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-product-gallery is-thumbs-${escapeAttribute(pos)}" style="width:${width};display:${side?"grid":"block"};${side?`grid-template-columns:${pos==="left"?`${thumbSize}px 1fr`:`1fr ${thumbSize}px`};gap:${thumbGap}px;`:""}">${pos==="top"||pos==="left"?thumbHtml:""}${visual}${pos==="bottom"||pos==="right"?thumbHtml:""}</div>`;
}

export function renderProductPrice(node, props, styles, renderContext, compare = false) {
	const product = renderContext?.product || {};
	const money = compare ? product.compareAtPrice : product.price;
	if (compare && !money) return "";
	const value = money ? formatMoney(money.amount, money.currencyCode) : (compare ? "" : "—");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="${compare ? "vsn-product-compare-price" : "vsn-product-price"}" data-vsn-prefix="${escapeAttribute(props.prefix || "")}" style="${productTypographyStyle(styles,{fontSize:compare?"18px":"24px",fontWeight:compare?"400":"700",color:compare?"#777777":"#1a1a1a"})}${compare ? "text-decoration:line-through;" : ""}">${escapeHtml(props.prefix || "")}${escapeHtml(value)}</div>`;
}

export function renderProductDescription(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const content = product.descriptionHtml || escapeHtml(product.description || props.fallbackText || "Product description").replaceAll("\n","<br>");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-description" style="${productTypographyStyle(styles,{fontSize:"16px",color:"#4a4a4a",lineHeight:"1.6"})}">${content}</div>`;
}

export function renderProductMeta(node, props, styles, renderContext, field) {
	const product = renderContext?.product || {};
	const value = field === "sku" ? (product.variants?.[0]?.sku || "—") : (product.vendor || "");
	const prefix = props.prefix ?? (field === "sku" ? "SKU: " : "Vendor: ");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="${field === "sku" ? "vsn-product-sku" : "vsn-product-vendor"}" data-vsn-prefix="${escapeAttribute(prefix)}" style="${productTypographyStyle(styles,{fontSize:"14px",color:"#666666"})}">${escapeHtml(prefix)}<span class="vsn-product-meta-value">${escapeHtml(value)}</span></div>`;
}

export function renderProductAvailability(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const available = product.availableForSale === true;
	const inventoryQuantity = Number(product.inventoryQuantity);
	const threshold = Math.max(1, Number(props.lowThreshold || 5));
	const isInventoryWidget = node.type === "inventory-status";
	const lowStock = isInventoryWidget && available && Number.isFinite(inventoryQuantity) && inventoryQuantity > 0 && inventoryQuantity <= threshold;
	const stockState = available ? (lowStock ? "low-stock" : "in-stock") : "sold-out";
	const statusClass = isInventoryWidget ? "vsn-inventory-status" : "vsn-product-availability";
	const label = !available ? (props.soldOutText || "Sold out") : lowStock ? (props.lowStockText || "Low stock") : (props.inStockText || "In stock");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="${statusClass}" data-vsn-stock-state="${stockState}" data-vsn-inventory-quantity="${Number.isFinite(inventoryQuantity) ? escapeAttribute(inventoryQuantity) : ""}" data-vsn-low-threshold="${escapeAttribute(threshold)}" data-vsn-in-stock-text="${escapeAttribute(props.inStockText || "In stock")}" data-vsn-low-stock-text="${escapeAttribute(props.lowStockText || "Low stock")}" data-vsn-sold-out-text="${escapeAttribute(props.soldOutText || "Sold out")}" style="${productTypographyStyle(styles,{fontSize:"14px",fontWeight:"600"})}">${escapeHtml(label)}</div>`;
}

export function renderProductVariantSelector(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const variants = product.variants || [];
	const currency = product.price?.currencyCode || "USD";
	const options = variants.map((variant) => `<option value="${escapeAttribute(variant.variantId || "")}" data-price="${escapeAttribute(variant.price ?? "")}" data-compare-price="${escapeAttribute(variant.compareAtPrice ?? "")}" data-currency="${escapeAttribute(currency)}" data-sku="${escapeAttribute(variant.sku || "")}" data-available="${variant.availableForSale ? "1" : "0"}" data-image="${escapeAttribute(variant.image?.url || "")}" ${(props.disableSoldOut !== false && !variant.availableForSale) ? "disabled" : ""}>${escapeHtml(variant.title || "Default")}${variant.availableForSale ? "" : " — Sold out"}</option>`).join("");
	const radius = toCssSize(styles?.border?.radius || props.borderRadius, "8px");
	return `<label data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-variant-wrap" style="display:grid;gap:${toCssSize(props.gap,"6px")};">${props.showLabel===false?"":`<span>${escapeHtml(props.label || "Variant")}</span>`}<select class="vsn-product-variant-selector" style="min-height:${toCssSize(props.height,"44px")};border:1px solid ${escapeAttribute(props.borderColor || "#d9d9d9")};border-radius:${radius};padding:8px 10px;background:${escapeAttribute(props.backgroundColor || "#fff")};color:${escapeAttribute(props.textColor || "#1a1a1a")};">${options || '<option value="">Default</option>'}</select></label>`;
}

export function renderProductQuantity(node, props) {
	const min=Math.max(1,Number(props.min||1)); const max=Math.max(min,Number(props.max||99)); const step=Math.max(1,Number(props.step||1)); return `<label data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-quantity-wrap" style="display:grid;gap:6px;">${props.showLabel===false?"":`<span>${escapeHtml(props.label || "Quantity")}</span>`}<input class="vsn-product-quantity" type="number" min="${escapeAttribute(min)}" max="${escapeAttribute(max)}" step="${escapeAttribute(step)}" value="${escapeAttribute(min)}" style="width:${toCssSize(props.width,"110px")};min-height:${toCssSize(props.height,"44px")};border:1px solid ${escapeAttribute(props.borderColor || "#d9d9d9")};border-radius:${toCssSize(props.borderRadius,"8px")};padding:8px 10px;"></label>`;
}

export function renderProductAction(node, props, styles, renderContext, buyNow = false) {
	const product = renderContext?.product || {};
	const firstAvailable = (product.variants || []).find((variant) => variant.availableForSale) || product.variants?.[0];
	const typography = styles.typography || {};
	const background = styles.background?.color || styles.backgroundColor || (buyNow ? "#008060" : "#1a1a1a");
	const radius = toCssSize(styles.border?.radius || styles.borderRadius, "8px");
	const spacing = styles.spacing || {};
	const padding = `${toCssSize(spacing.paddingTop,"14px")} ${toCssSize(spacing.paddingRight,"22px")} ${toCssSize(spacing.paddingBottom,"14px")} ${toCssSize(spacing.paddingLeft,"22px")}`;
	return `<button type="button" data-vsn-id="${escapeAttribute(node.id || "")}" class="${buyNow ? "vsn-product-buy-now" : "vsn-product-add-to-cart"}" data-vsn-default-variant-id="${escapeAttribute(firstAvailable?.variantId || "")}" data-vsn-ready-text="${escapeAttribute(props.text || (buyNow ? "Buy Now" : "Add to Cart"))}" ${product.availableForSale ? "" : "disabled"} style="display:inline-flex;width:${props.fullWidth ? "100%" : "auto"};align-items:center;justify-content:center;border:${toCssSize(props.borderWidth,"0px")} solid ${escapeAttribute(props.borderColor || "transparent")};border-radius:${radius};background:${escapeAttribute(background)};color:${escapeAttribute(typography.color || "#ffffff")};font-size:${toCssSize(typography.fontSize,"16px")};font-weight:${escapeAttribute(typography.fontWeight || "600")};padding:${padding};cursor:${product.availableForSale ? "pointer" : "not-allowed"};opacity:${product.availableForSale ? "1" : ".55"};">${escapeHtml(props.text || (buyNow ? "Buy Now" : "Add to Cart"))}</button>`;
}

export function renderProductMetafield(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const namespace = String(props.namespace || "custom");
	const key = String(props.key || "");
	const field = (product.metafields || []).find((item) => item.namespace === namespace && item.key === key);
	const value = field?.value ?? props.emptyText ?? "";
	if (!value && !props.label) return "";
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-metafield" style="${productTypographyStyle(styles,{fontSize:"14px",color:"#4a4a4a"})}">${props.label ? `<strong>${escapeHtml(props.label)}</strong> ` : ""}${escapeHtml(value)}</div>`;
}
