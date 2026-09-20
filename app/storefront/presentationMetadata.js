export function renderableElements(elements) {
	return (Array.isArray(elements) ? elements : []).filter(
		(item) => !["global-styles", "template-settings"].includes(item?.type),
	);
}

export function safeJsonForHtml(value) {
	return JSON.stringify(value || {}).replace(/</g, "\\u003c");
}

export function buildSeoPayload({ page = null, title = "", settings = {}, product = null, article = null }) {
	const dynamicTitle = product?.title || article?.title || title || page?.title || "";
	const dynamicDescription = product?.description || article?.excerpt || "";
	return {
		title: settings.seoTitle || dynamicTitle,
		description: settings.seoDescription || dynamicDescription,
		canonical: settings.canonical || "",
		ogTitle: settings.ogTitle || settings.seoTitle || dynamicTitle,
		ogDescription: settings.ogDescription || settings.seoDescription || dynamicDescription,
		ogImage: settings.ogImage || product?.featuredImage?.url || article?.image?.url || "",
	};
}

export function buildSchemaMarkup({ product = null, article = null }) {
	const scripts = [];
	if (product?.id) {
		const price = product.price?.amount || product.variants?.[0]?.price || "";
		const currency = product.price?.currencyCode || "USD";
		scripts.push({
			"@context": "https://schema.org",
			"@type": "Product",
			name: product.title || "Product",
			description: product.description || "",
			image: product.featuredImage?.url ? [product.featuredImage.url] : undefined,
			sku: product.variants?.[0]?.sku || undefined,
			offers: price ? {
				"@type": "Offer",
				price: String(price),
				priceCurrency: currency,
				availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
			} : undefined,
		});
	}
	if (article?.id) {
		scripts.push({
			"@context": "https://schema.org",
			"@type": "Article",
			headline: article.title || "Article",
			description: article.excerpt || "",
			datePublished: article.publishedAt || undefined,
			author: article.author ? { "@type": "Person", name: article.author } : undefined,
			image: article.image?.url ? [article.image.url] : undefined,
		});
	}
	return scripts.map((item) => `<script type="application/ld+json">${safeJsonForHtml(item)}</script>`).join("");
}

