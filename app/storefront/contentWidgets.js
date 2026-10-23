import { contextImageAlt, contextImageUrl, normalizeContextImageProps } from "../builder/contextMediaWidget.js";
import { gridImageRatio, normalizeGridProps } from "../builder/dataGridWidget.js";
import { toCssSize } from "./designTokens.js";
import { formatMoney } from "./dynamicSource.js";
import { productTypographyStyle } from "./productWidgets.js";
import { escapeAttribute, escapeHtml } from "./safeCss.js";

export function getNodeSpacing(styles = {}) {
	const spacing = styles?.spacing || {};

	const margin = spacing.margin ?? styles.margin;
	const padding = spacing.padding ?? styles.padding;

	const buildBox = (direct, prefix, fallback = "0px") => {
		if (direct !== undefined && direct !== null && direct !== "") {
			if (typeof direct === "object" && !Array.isArray(direct)) {
				const source = direct.desktop || direct;
				const unit = source.unit || "px";
				const top = source.top ?? 0;
				const right = source.right ?? 0;
				const bottom = source.bottom ?? 0;
				const left = source.left ?? 0;
				return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
			}

			return toCssSize(direct, fallback);
		}

		const top = spacing[`${prefix}Top`] ?? styles[`${prefix}Top`];
		const right = spacing[`${prefix}Right`] ?? styles[`${prefix}Right`];
		const bottom = spacing[`${prefix}Bottom`] ?? styles[`${prefix}Bottom`];
		const left = spacing[`${prefix}Left`] ?? styles[`${prefix}Left`];

		if ([top, right, bottom, left].every((item) => item === undefined || item === null || item === "")) {
			return fallback;
		}

		return [top, right, bottom, left]
			.map((item) => toCssSize(item, "0px"))
			.join(" ");
	};

	return {
		margin: buildBox(margin, "margin"),
		padding: buildBox(padding, "padding"),
	};
}

export function sanitizeRichHtml(value) {
	return String(value || "")
		.replace(/<\/?(?:script|style|iframe|object|embed|form)[^>]*>/gi, "")
		.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href="#"');
}

export function contentTypography(styles={}, fallback={}) { return productTypographyStyle(styles, fallback); }

export function renderSearchQueryTitle(node, props, styles, ctx){ const q=ctx?.search?.query||""; const Tag=["h1","h2","h3"].includes(props.tag)?props.tag:"h1"; return `<${Tag} data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-search-query-title" style="${contentTypography(styles,{fontSize:"38px",fontWeight:"700"})}"><span class="vsn-search-query-prefix">${escapeHtml(props.prefix||"Search results for")}</span>${q?` <span class="vsn-search-query-value">“${escapeHtml(q)}”</span>`:""}</${Tag}>`; }

export function renderSearchResultCount(node, props, styles, ctx){ const count=Number(ctx?.search?.count||0); return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-search-result-count" style="${contentTypography(styles,{fontSize:"15px",color:"#666"})}"><span class="vsn-search-count-value">${count}</span><span class="vsn-search-count-label">${escapeHtml(count===1?(props.singularText||"result"):(props.pluralText||"results"))}</span></div>`; }

export function renderSearchResultsGrid(node, props, styles, ctx) {
	const items = ctx?.search?.items || [];
	const grid = normalizeGridProps("search-results-grid", props);
	const limit=grid.limit, desktop=grid.columnsDesktop, tablet=grid.columnsTablet, mobile=grid.columnsMobile;
	const gap = `${grid.gap}px`;
	const card = styles?.card || {};
	const cardCss = `background:${escapeAttribute(card.backgroundColor || "#ffffff")};border:${toCssSize(card.borderWidth,"1px")} solid ${escapeAttribute(card.borderColor || "#e5e5e5")};border-radius:${toCssSize(card.borderRadius,"12px")};padding:${toCssSize(card.padding,"14px")};overflow:hidden;`;
	const cards = items.slice(0, limit).map((item) => {
		const image = grid.showImage && item.image?.url ? `<img class="vsn-search-card-media" src="${escapeAttribute(item.image.url)}" alt="${escapeAttribute(item.image.altText || item.title || "")}" loading="lazy" style="width:100%;aspect-ratio:${escapeAttribute(gridImageRatio(grid.imageRatio))};object-fit:cover;border-radius:${toCssSize(styles?.image?.borderRadius,"8px")};margin-bottom:10px;">` : "";
		return `<article class="vsn-search-card" style="${cardCss}"><a href="${escapeAttribute(item.url || "#")}" style="color:inherit;text-decoration:none;">${image}${grid.showType === false ? "" : `<div class="vsn-search-type" style="font-size:11px;text-transform:uppercase;color:#777;">${escapeHtml(item.type || "")}</div>`}${grid.showTitle ? `<h3 class="vsn-search-card-title" style="margin:6px 0;font-size:17px;">${escapeHtml(item.title || "")}</h3>` : ""}${grid.showPrice && item.price ? `<div class="vsn-search-card-price" style="font-size:13px;font-weight:600;margin:4px 0;">${escapeHtml(formatMoney(item.price.amount,item.price.currencyCode))}</div>` : ""}${grid.showExcerpt === false ? "" : `<p class="vsn-search-card-excerpt" style="margin:0;color:#666;font-size:14px;">${escapeHtml(item.excerpt || "")}</p>`}</a></article>`;
	}).join("");
	const id = escapeAttribute(node.id || "");
	return `<style>@media(max-width:749px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${mobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${tablet},minmax(0,1fr))!important}}</style><div data-vsn-id="${id}" class="vsn-search-results-grid" style="display:grid;grid-template-columns:repeat(${desktop},minmax(0,1fr));gap:${gap};">${cards || `<div class="vsn-search-empty">${escapeHtml(grid.emptyText)}</div>`}</div>`;
}

export function renderBlogTitle(node,props,styles,ctx){ const b=ctx?.blog||{}; return `<h1 data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"42px",fontWeight:"700"})}">${escapeHtml(b.title||props.fallbackText||"Blog")}</h1>`; }

export function renderBlogDescription(node,props,styles,ctx){ const b=ctx?.blog||{}; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"16px",color:"#4a4a4a",lineHeight:"1.6"})}">${escapeHtml(b.description||props.fallbackText||"")}</div>`; }

export function articleCard(item, blogHandle = "", props = {}, styles = {}) {
	const url = item.url || `/blogs/${blogHandle}/${item.handle || ""}`;
	const card = styles?.card || {};
	const image = props.showImage !== false && item.image?.url ? `<img src="${escapeAttribute(item.image.url)}" alt="${escapeAttribute(item.image.altText || item.title || "")}" loading="lazy" style="width:100%;aspect-ratio:${escapeAttribute(gridImageRatio(props.imageRatio || "landscape"))};object-fit:${escapeAttribute(props.imageFit || "cover")};border-radius:${toCssSize(styles?.image?.borderRadius,"8px")};">` : "";
	const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }) : "";
	return `<article class="vsn-article-card" style="background:${escapeAttribute(card.backgroundColor || "transparent")};border:${toCssSize(card.borderWidth,"0px")} solid ${escapeAttribute(card.borderColor || "transparent")};border-radius:${toCssSize(card.borderRadius,"12px")};padding:${toCssSize(card.padding,"0px")};overflow:hidden;"><a href="${escapeAttribute(url)}" style="color:inherit;text-decoration:none;">${image}${props.showTitle === false ? "" : `<h3 class="vsn-article-card-title" style="margin:12px 0 6px;">${escapeHtml(item.title || "")}</h3>`}<div class="vsn-article-card-meta">${props.showDate === false || !date ? "" : `<div class="vsn-article-card-date" style="font-size:12px;color:#777;margin-bottom:5px;">${escapeHtml(date)}</div>`}${props.showAuthor === true && item.author ? `<div class="vsn-article-card-author" style="font-size:12px;color:#777;margin-bottom:5px;">${escapeHtml(item.author)}</div>` : ""}</div>${props.showExcerpt === false ? "" : `<p class="vsn-article-card-excerpt" style="margin:0;color:#666;">${escapeHtml(item.excerpt || "")}</p>`}</a></article>`;
}

export function renderBlogArticleGrid(node, props, styles, ctx) {
	const b = ctx?.blog || {};
	const items = b.articles || [];
	const grid=normalizeGridProps("blog-article-grid",props);
	const desktop=grid.columnsDesktop, tablet=grid.columnsTablet, mobile=grid.columnsMobile;
	const id = escapeAttribute(node.id || "");
	const cards = items.slice(0, grid.limit).map((item) => articleCard(item, b.handle, props, styles)).join("");
	return `<style>@media(max-width:749px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${mobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${tablet},minmax(0,1fr))!important}}</style><div data-vsn-id="${id}" class="vsn-blog-article-grid" style="display:grid;grid-template-columns:repeat(${desktop},minmax(0,1fr));gap:${`${grid.gap}px`};">${cards || escapeHtml(grid.emptyText)}</div>`;
}

export function renderArticleTitle(node,props,styles,ctx){ const a=ctx?.article||{}; return `<h1 data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"46px",fontWeight:"700"})}">${escapeHtml(a.title||props.fallbackText||"Article title")}</h1>`; }

export function renderArticleImage(node,props,styles,ctx){ const a=ctx?.article||{}; const media=a.image||{}; const settings=normalizeContextImageProps(props); const src=contextImageUrl(media,settings); if(!src)return ""; const alt=contextImageAlt(media,settings,a.title||"Article image"); const image=`<img loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" data-vsn-id="${escapeAttribute(node.id||"")}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" style="width:${toCssSize(styles?.size?.width,"100%")};height:${toCssSize(styles?.size?.height,"520px")};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${toCssSize(styles?.border?.radius,"12px")};">`; return settings.lightbox?`<a href="${escapeAttribute(media.url||src)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url||src)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${image}</a>`:image; }

export function renderArticleContent(node,props,styles,ctx){ const a=ctx?.article||{}; const html=a.contentHtml?sanitizeRichHtml(a.contentHtml):escapeHtml(a.content||props.fallbackText||"").replaceAll("\n","<br>"); return `<article data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-content" style="${contentTypography(styles,{fontSize:"17px",color:"#333",lineHeight:"1.75"})}">${html}</article>`; }

export function renderArticleAuthor(node,props,styles,ctx){ const a=ctx?.article||{}; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-author" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${escapeHtml(props.prefix||"By ")}${escapeHtml(a.author||"Author")}</div>`; }

export function renderArticleDate(node,props,styles,ctx){ const a=ctx?.article||{}; let date=""; if(a.publishedAt){const d=new Date(a.publishedAt); date=props.format==="iso"?d.toISOString().slice(0,10):d.toLocaleDateString("en-US",props.format==="short"?{year:"numeric",month:"numeric",day:"numeric"}:props.format==="medium"?{year:"numeric",month:"short",day:"numeric"}:{year:"numeric",month:"long",day:"numeric"});} return `<time data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-date" datetime="${escapeAttribute(a.publishedAt||"")}" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${escapeHtml(date)}</time>`; }

export function renderArticleTags(node,props,styles,ctx){ const tags=ctx?.article?.tags||[]; const prefix=props.prefix?`<span class="vsn-article-tags-prefix">${escapeHtml(props.prefix)}</span>`:""; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-tags" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${prefix}${tags.map((tag)=>`<span class="vsn-article-tag">${escapeHtml(tag)}</span>`).join(escapeHtml(props.separator||" · "))}</div>`; }

export function renderArticleNavigation(node,props,styles,ctx){ const a=ctx?.article||{}; const prev=a.previous?`<a class="vsn-article-nav-prev" href="${escapeAttribute(a.previous.url)}">← ${escapeHtml(props.previousText||a.previous.title||"Previous article")}</a>`:"<span></span>"; const next=a.next?`<a class="vsn-article-nav-next" href="${escapeAttribute(a.next.url)}">${escapeHtml(props.nextText||a.next.title||"Next article")} →</a>`:"<span></span>"; return `<nav data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-navigation" style="display:flex;justify-content:space-between;gap:20px;${getNodeSpacing(styles).margin?`margin:${getNodeSpacing(styles).margin};`:""}">${prev}${next}</nav>`; }

export function renderRelatedArticles(node,props,styles,ctx){ const a=ctx?.article||{}; const items=a.related||[]; const grid=normalizeGridProps("related-articles",props); const id=escapeAttribute(node.id||""); return `<section data-vsn-id="${id}" class="vsn-related-articles" style="margin:${getNodeSpacing(styles).margin};"><h2 class="vsn-related-articles-heading">${escapeHtml(props.heading||"Related articles")}</h2><style>@media(max-width:749px){[data-vsn-id="${id}"] .vsn-related-articles-grid{grid-template-columns:repeat(${grid.columnsMobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"] .vsn-related-articles-grid{grid-template-columns:repeat(${grid.columnsTablet},minmax(0,1fr))!important}}</style><div class="vsn-related-articles-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;">${items.slice(0,grid.limit).map(i=>articleCard(i,a.blogHandle,{...props,...grid},styles)).join("")||escapeHtml(grid.emptyText)}</div></section>`; }
