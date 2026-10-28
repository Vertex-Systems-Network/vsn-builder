import { isPrerenderCacheable, prerenderKey, PRERENDER_TEMPLATES, storePrerender } from "../services/storefront-prerender.server.js";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { buildNodeStyle } from "../builder/styleEngine.js";
import { buildStyleBundleCss } from "../builder/stylePipeline.js";
import { normalizeImageWidgetProps, resolveImageSource, buildImageRenderUrl, imageResolutionDimensions, imageAltText, imageCaptionText, imageLinkHref, isShopifyHostedImageUrl } from "../builder/imageWidget.js";
import { isNestedSliderType } from "../builder/nestedCarouselWidget.js";
import { applyDynamicBindings } from "../builder/dynamicBindings.js";
import { normalizeContextImageProps, contextImageUrl, contextImageAlt } from "../builder/contextMediaWidget.js";
import { normalizeGridProps, gridImageRatio } from "../builder/dataGridWidget.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { normalizeQueryDefinition } from "../builder/queryBuilder.js";
import { runShopifyLoopQuery } from "../services/query-engine.server.js";
import { CAMPAIGN_TEMPLATE_TYPES, normalizeCampaignSettings, campaignScheduleState, campaignMatchesContext } from "../builder/campaignSystem.js";
import { resolveExperimentRender } from "../services/experiment-engine.server.js";
import { resolveLocalizedPage } from "../services/localization.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { loadGoogleMapsApiKey, loadGoogleCaptchaSettings } from "../services/google-platform.server.js";
import { loadRenderFormConfigs } from "../services/storefront-form-submission.server.js";
import { renderVsnStorefrontWidget } from "../sdk/runtime.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { parseEnterpriseSettings } from "../services/enterprise-hardening.server.js";
import { trackStorefrontVisitorRequest } from "../services/visitor-analytics.server.js";
import { loadStorefrontWidgetPlatform } from "../services/widget-studio.server.js";
import { applyVisualTemplateOverride } from "../builder/visualTemplate.js";
import { serveGlobalCodeRuntime } from "../services/global-code-runtime.server.js";
import { handleWishlistProxyLoader, proxyWishlistCustomer } from "../services/wishlist-proxy.server.js";
import { loadDynamicMetaobjects } from "../storefront/dynamicMetaobjects.server.js";
import { getArticleData, getBlogData, getSearchData } from "../storefront/contentQueries.server.js";
import {
	getAllProducts,
	getAllProductsPage,
	getCollectionByHandle,
	getCollectionProductsPage,
	getProductByHandle,
} from "../storefront/productQueries.server.js";
import { loadWidgetGridData } from "../storefront/widgetGridData.server.js";
import { getTemplateSettings } from "../storefront/templateSettings.js";
import { getGlobalSection, resolveReusableSections } from "../storefront/reusableSections.server.js";
import { columnsResponsiveCss, normalizeColumnsProps } from "../builder/columnsWidget.js";
import {
	buildSchemaMarkup,
	buildSeoPayload,
	renderableElements,
	safeJsonForHtml,
} from "../storefront/presentationMetadata.js";
import {
	getGlobalStyles,
	mergeShopDesignTokens,
	toCssSize,
} from "../storefront/designTokens.js";
import { vsnFontRuntime } from "../storefront/fontRuntime.js";
import { buildCustomJsBundle } from "../storefront/customJsBundle.js";
import { serverConditionMatches } from "../storefront/serverConditions.js";
import { applyDynamicSource, formatMoney } from "../storefront/dynamicSource.js";
import { injectNodeBehavior } from "../storefront/nodeBehavior.js";
import { productTypographyStyle, renderProductTitle, renderProductImage, renderProductGallery, renderProductPrice, renderProductDescription, renderProductMeta, renderProductAvailability, renderProductVariantSelector, renderProductQuantity, renderProductAction, renderProductMetafield } from "../storefront/productWidgets.js";
import { getNodeSpacing, renderSearchQueryTitle, renderSearchResultCount, renderSearchResultsGrid, renderBlogTitle, renderBlogDescription, renderBlogArticleGrid, renderArticleTitle, renderArticleImage, renderArticleContent, renderArticleAuthor, renderArticleDate, renderArticleTags, renderArticleNavigation, renderRelatedArticles } from "../storefront/contentWidgets.js";
import { renderNavigationMenu, renderFormWidget, renderIconWidget } from "../storefront/formWidgets.js";
import { renderExtendedWidget } from "../storefront/extendedWidgets.js";
import { PHASE10_SERVER_WIDGET_TYPES, renderPhase10Widget } from "../storefront/phase10Widgets.js";
import { responsiveValue, cssSize, individualSpacingCss, spacingCss, safeNumber, allowedValue, safeColor, safeUrl, escapeHtml, escapeAttribute } from "../storefront/safeCss.js";
import { htmlResponse, javascriptResponse, jsonResponse, liquidResponse } from "../storefront/responses.server.js";
import { buildLiquidBody, hasLiquidPlaceholders } from "../storefront/liquidOutput.js";
import {
	clampProductPageSize,
	findCollectionProductPageSize,
	findCollectionProductSort,
	normalizeProductSort,
} from "../storefront/productPagination.js";
ensureBuiltinSdkPlugins();
export async function loader({ request, params }) {
	const { admin, session } =
		await authenticate.public.appProxy(request);

	const url = new URL(request.url);
	const fragmentMode =
		url.searchParams.get("fragment") === "1";
	const assetPipelineOptimized = url.searchParams.get("vsnAssetPipeline") === "1";

	const customJsMode =
		url.searchParams.get("customJs") === "1";
	const globalCodeKind = String(url.searchParams.get("globalCode") || "").toLowerCase(), globalCodeMode = globalCodeKind === "css" || globalCodeKind === "js";
	const campaignMode = url.searchParams.get("campaigns") === "1";
	const loopQueryMode = url.searchParams.get("loopQuery") === "1";
	const requestedLoopId = String(url.searchParams.get("loopId") || "").trim();
	const requestedLoopAfter = String(url.searchParams.get("loopAfter") || "").trim();
	const requestedLoopPageSize = Math.max(1, Math.min(50, Number(url.searchParams.get("loopPageSize") || 12) || 12));

	const loadMoreMode =
		url.searchParams.get("loadMore") === "1";

	const afterCursor =
		String(
			url.searchParams.get("after") || "",
		).trim();

	const requestedPageSize = clampProductPageSize(
		url.searchParams.get("pageSize"),
		8,
	);

	const requestedSortBy = normalizeProductSort(
		url.searchParams.get("sortBy"),
	);

	const requestedTemplate =
		String(
			url.searchParams.get("template") || "",
		).trim();
	const visitorPath = String(url.searchParams.get("visitorPath") || "/").trim() || "/";
	const visitorId = String(url.searchParams.get("vsnVisitorId") || "").trim().slice(0,120);
	const visitorSessionId = String(url.searchParams.get("vsnSessionId") || "").trim().slice(0,120);
	const forcedExperimentId = String(url.searchParams.get("vsnExpPreview") || "").trim().slice(0,120);
	const forcedVariantKey = String(url.searchParams.get("vsnVariant") || "").trim().slice(0,40);
	const requestedLocale = String(url.searchParams.get("language") || "").trim();
	const requestedMarketKey = String(url.searchParams.get("market") || url.searchParams.get("country") || "*").trim() || "*";
	const localizationEnabled = getServerFeatureFlags().localizationMarketsV1 === true;

	const searchQuery = String(url.searchParams.get("query") || "").trim();
	const requestedBlogHandle = String(url.searchParams.get("blogHandle") || "").trim().toLowerCase();
	const requestedArticleHandle = String(url.searchParams.get("articleHandle") || "").trim().toLowerCase();

	const requestedResourceHandle =
		String(
			url.searchParams.get(
				"resourceHandle",
			) || "",
		)
			.trim()
			.toLowerCase();

	const { signedCustomerId, customerData } = proxyWishlistCustomer(url);
	const campaignContext = {
		path: visitorPath,
		template: requestedTemplate,
		pageType: requestedTemplate,
		resourceHandle: requestedResourceHandle,
		customerLoggedIn: customerData.loggedIn,
		language: requestedLocale,
		country: String(url.searchParams.get("country") || "").trim(),
		market: requestedMarketKey,
		cartItemCount: Number(url.searchParams.get("cartItemCount") || 0) || 0,
	};
	if (!session?.shop) {
		return htmlResponse(
			fragmentMode
				? renderMessageFragment(
					"Invalid storefront request.",
				)
				: renderMessagePage(
					"Invalid storefront request.",
				),
			401,
		);
	}

	const wishlistLoader=await handleWishlistProxyLoader({db,admin,session,url,signedCustomerId}); if(wishlistLoader)return wishlistLoader;
	const [googleMapsApiKey,googleCaptcha]=await Promise.all([loadGoogleMapsApiKey(db,session.shop).catch(()=>""),loadGoogleCaptchaSettings(db,session.shop).catch(()=>({v2:{},v3:{}}))]);

	if (globalCodeMode) return serveGlobalCodeRuntime({ db, shop:session.shop, kind:globalCodeKind, context:{ template:requestedTemplate || String(url.searchParams.get("pageType") || ""), path:visitorPath,
		locale:requestedLocale, language:requestedLocale, market:requestedMarketKey, country:String(url.searchParams.get("country") || "") } });

	await trackStorefrontVisitorRequest(db, session.shop, { visitorId, sessionId: visitorSessionId, country: campaignContext.country, path: visitorPath }, { campaignMode, loopQueryMode, customJsMode, loadMoreMode });
	if (campaignMode) {
		try {
			const [pages, shopSetting] = await Promise.all([
				db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null, status: "published", template: { in: CAMPAIGN_TEMPLATE_TYPES } }, orderBy: { publishedAt: "desc" }, take: 100 }),
				db.builderShopSetting.findUnique({ where: { shop: session.shop } }),
			]);
			let tokens = {}; try { tokens = JSON.parse(shopSetting?.designTokensJson || "{}"); } catch { /* best-effort */ }
			const campaigns = []; const byId = new Map(pages.map((item)=>[String(item.id),item])); const included = new Set();
			let customFonts = []; try { customFonts = await db.builderCustomFont.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id:true, family:true, weight:true, style:true, mimeType:true } }); } catch { /* best-effort */ }
			const addCampaign = async (campaignPage, forceFallback = false) => {
				if (!campaignPage || included.has(campaignPage.id)) return;
				const campaignBaseElements = migrateBuilderContent(safeParseJson(campaignPage.publishedJson, []));
				const campaignLocalization = localizationEnabled
					? await resolveLocalizedPage(db, { shop: session.shop, page: campaignPage, elements: campaignBaseElements, locale: requestedLocale, marketKey: requestedMarketKey }).catch(() => ({ elements: campaignBaseElements, seo: {}, direction: "ltr" }))
					: { elements: campaignBaseElements, seo: {}, direction: "ltr" };
				const elements = campaignLocalization.elements;
				const settings = normalizeCampaignSettings({ ...getTemplateSettings(elements), ...(campaignLocalization.seo || {}) }, campaignPage.template);
				const state = campaignScheduleState(settings);
				if (!forceFallback && state !== "active") {
					if (state === "expired" && settings.campaignFallbackPageId) await addCampaign(byId.get(String(settings.campaignFallbackPageId)), true);
					return;
				}
				if (settings.campaignEnabled === false || !campaignMatchesContext(settings, campaignContext)) return;
				const resolved = await resolveReusableSections({ database: db, shop: session.shop, elements, locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled });
				if (!renderableElements(resolved).length) return;
				const formConfigs=await loadRenderFormConfigs(session.shop,resolved).catch(()=>({}));
				const html = renderBuilderFragment({ page: campaignPage, elements: resolved, pageSettings: settings, customerData, cartContext:{itemCount:campaignContext.cartItemCount}, designTokens: tokens, customFonts, googleMapsApiKey, googleCaptcha, formConfigs, localization: { locale: requestedLocale, marketKey: requestedMarketKey, direction: campaignLocalization.direction || "ltr" } });
				included.add(campaignPage.id); campaigns.push({ id: campaignPage.id, title: campaignPage.title, kind: campaignPage.template, settings, html, fallback: forceFallback });
			};
			for (const campaignPage of pages) await addCampaign(campaignPage, false);
			return jsonResponse({ ok: true, campaigns, serverTime: new Date().toISOString() }, 200);
		} catch (error) {
			console.error("VSN campaign lookup failed:", error);
			return jsonResponse({ ok: false, campaigns: [], error: "Campaigns could not be loaded." }, 200);
		}
	}

	if (
		loadMoreMode &&
		requestedTemplate === "collection" &&
		requestedResourceHandle
	) {
		let result = null;

		if (
			requestedResourceHandle === "all"
		) {
			result =
				await getAllProductsPage({
					admin,
					afterCursor:
						afterCursor || null,
					pageSize: requestedPageSize,
					sortBy: requestedSortBy,
				});
		} else {
			result =
				await getCollectionProductsPage({
					admin,
					handle:
						requestedResourceHandle,
					afterCursor:
						afterCursor || null,
					pageSize: requestedPageSize,
					sortBy: requestedSortBy,
				});
		}

		if (!result) {
			// Keep storefront stable on transient Admin API errors. The client can
			// stop pagination without receiving a red 500 network error.
			return jsonResponse({
				ok: false,
				error: "Products could not be loaded right now.",
				products: [],
				pageInfo: { hasNextPage: false, endCursor: null },
			}, 200);
		}

		return jsonResponse({
			ok: true,
			products: result.products,
			pageInfo: result.pageInfo,
		});
	}

	const splat = String(params["*"] || "")
		.replace(/^\/+|\/+$/g, "");

	if (splat.startsWith("font/")) {
		const fontId = splat.slice(5).trim();
		const font = await db.builderCustomFont.findFirst({ where: { id: fontId, shop: session.shop, deletedAt: null } });
		if (!font) return new Response("Font not found.", { status: 404 });
		return new Response(font.fileData, { headers: {
			"Content-Type": font.mimeType || "application/octet-stream",
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
			"Access-Control-Allow-Origin": "*",
		} });
	}

	if (splat.startsWith("svg/")) {
		const svgId = splat.slice(4).trim();
		const asset = await db.builderSvgAsset.findFirst({ where: { id: svgId, shop: session.shop, deletedAt: null } });
		if (!asset) return new Response("SVG not found.", { status: 404 });
		return new Response(asset.svgText, { headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
			"X-Content-Type-Options": "nosniff",
			"Access-Control-Allow-Origin": "*",
		} });
	}

	if (!splat) {
		return htmlResponse(
			fragmentMode
				? renderMessageFragment(
					"Builder page handle is required.",
				)
				: renderMessagePage(
					"Builder page handle is required.",
				),
			404,
		);
	}

	let page = null;

	if (
		requestedTemplate === "collection"
	) {
		/*
		 * Pehle selected collection ka
		 * specific published template.
		 */
		if (
			requestedResourceHandle &&
			requestedResourceHandle !== "all"
		) {
			page =
				await db.builderPage.findFirst({
					where: {
						shop: session.shop,
						deletedAt: null,
						status: "published",
						template: "collection",
						isDefault: false,
						resourceHandle:
							requestedResourceHandle,
					},
					orderBy: {
						publishedAt: "desc",
					},
				});
		}

		/*
		 * Specific template na mile to
		 * published default collection template.
		 */
		if (!page) {
			page =
				await db.builderPage.findFirst({
					where: {
						shop: session.shop,
						deletedAt: null,
						status: "published",
						template: "collection",
						isDefault: true,
					},
					orderBy: {
						publishedAt: "desc",
					},
				});
		}
	} else if (requestedTemplate === "product") {
		if (requestedResourceHandle) {
			page = await db.builderPage.findFirst({
				where: {
					shop: session.shop,
					deletedAt: null,
					status: "published",
					template: "product",
					isDefault: false,
					resourceHandle: requestedResourceHandle,
				},
				orderBy: { publishedAt: "desc" },
			});
		}

		if (!page) {
			page = await db.builderPage.findFirst({
				where: {
					shop: session.shop,
					deletedAt: null,
					status: "published",
					template: "product",
					isDefault: true,
				},
				orderBy: { publishedAt: "desc" },
			});
		}
	} else if (["blog", "article"].includes(requestedTemplate)) {
		if (requestedResourceHandle) {
			page = await db.builderPage.findFirst({ where:{ shop:session.shop,deletedAt:null,status:"published",template:requestedTemplate,isDefault:false,resourceHandle:requestedResourceHandle }, orderBy:{publishedAt:"desc"} });
		}
		if (!page) page = await db.builderPage.findFirst({ where:{ shop:session.shop,deletedAt:null,status:"published",template:requestedTemplate,isDefault:true }, orderBy:{publishedAt:"desc"} });
	} else if (requestedTemplate === "search") {
		page = await db.builderPage.findFirst({ where:{ shop:session.shop,deletedAt:null,status:"published",template:"search",isDefault:true }, orderBy:{publishedAt:"desc"} });
	} else if (requestedTemplate) {
		page =
			await db.builderPage.findFirst({
				where: {
					shop: session.shop,
					deletedAt: null,
					status: "published",
					template:
						requestedTemplate,
				},
				orderBy: {
					publishedAt: "desc",
				},
			});
	} else {
		page =
			await db.builderPage.findFirst({
				where: {
					shop: session.shop,
					deletedAt: null,
					status: "published",
					OR: [
						{
							id: splat,
						},
						{
							handle: splat,
						},
					],
				},
			});
	}

	const specificTemplateMatched = Boolean(page && !page.isDefault && ["collection", "product", "blog", "article"].includes(requestedTemplate));
	if (requestedTemplate && !specificTemplateMatched) {
		try {
			const rules = await db.builderTemplateRule.findMany({ where: { shop: session.shop, template: requestedTemplate, enabled: true }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 50 });
			for (const rule of rules) {
				let conditions = {}; try { conditions = JSON.parse(rule.conditionsJson || "{}"); } catch { /* best-effort */ }
				const includePath = String(conditions.includePath || "").trim();
				const excludePath = String(conditions.excludePath || "").trim();
				const customerState = String(conditions.customerState || "any");
				if (includePath && !visitorPath.includes(includePath)) continue;
				if (excludePath && visitorPath.includes(excludePath)) continue;
				if (customerState === "logged-in" && !customerData.loggedIn) continue;
				if (customerState === "logged-out" && customerData.loggedIn) continue;
				const ruledPage = await db.builderPage.findFirst({ where: { id: rule.pageId, shop: session.shop, deletedAt: null, template: requestedTemplate, status: "published" } });
				if (ruledPage?.publishedJson) { page = ruledPage; break; }
			}
		} catch (error) { console.error("VSN template assignment rules failed:", error); }
	}

	if (!page || !page.publishedJson) {
		return htmlResponse(
			fragmentMode
				? renderMessageFragment(
					"Published builder page was not found.",
				)
				: renderMessagePage(
					"Published builder page was not found.",
				),
			404,
		);
	}

	const baseElements = migrateBuilderContent(safeParseJson(page.publishedJson, []));
	const experimentRender = await resolveExperimentRender({ db, shop:session.shop, page, elements:baseElements, visitorId, sessionId:visitorSessionId, forcedExperimentId, forcedVariantKey }).catch((error) => { console.error("VSN experiment assignment failed:", error); return { page, elements:baseElements, experiment:null, variant:null, assignment:null, changed:false }; });
	const localizationRender = localizationEnabled
		? await resolveLocalizedPage(db, { shop: session.shop, page, elements: experimentRender.elements, locale: requestedLocale, marketKey: requestedMarketKey }).catch((error) => { console.warn("VSN storefront localization fallback:", error?.message || error); return { elements: experimentRender.elements, seo: {}, locale: requestedLocale, marketKey: requestedMarketKey, direction: "ltr" }; })
		: { elements: experimentRender.elements, seo: {}, locale: "", marketKey: "*", direction: "ltr" };
	const elements = localizationRender.elements;
	const experimentMeta = experimentRender.experiment && experimentRender.variant ? {
		id:experimentRender.experiment.id, variantId:experimentRender.variant.id, variantKey:experimentRender.variant.key, variantName:experimentRender.variant.name,
		visitorId, sessionId:visitorSessionId, goalType:experimentRender.experiment.goalType, goalValue:experimentRender.experiment.goalValue || "", changed:Boolean(experimentRender.changed), preview:Boolean(experimentRender.preview),
	} : null;
	const pageSettings = { ...getTemplateSettings(elements), ...(localizationRender.seo || {}) };
	const resolvedElements = await resolveReusableSections({ database: db, shop: session.shop, elements, locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled });

	const collectionPageSize =
		findCollectionProductPageSize(
			resolvedElements,
			8,
		);

	const collectionSortBy =
		findCollectionProductSort(
			resolvedElements,
			"featured",
		);

	let collectionData = null;

	if (
		requestedTemplate === "collection" &&
		requestedResourceHandle
	) {
		if (
			requestedResourceHandle === "all"
		) {
			collectionData =
				await getAllProducts({
					admin,
					pageSize: collectionPageSize,
					sortBy: collectionSortBy,
				});
		} else {
			collectionData =
				await getCollectionByHandle({
					admin,
					handle:
						requestedResourceHandle,
					pageSize: collectionPageSize,
					sortBy: collectionSortBy,
				});
		}
	}

	if (
		requestedTemplate === "collection" &&
		!collectionData
	) {
		collectionData = {
			id: null,

			title:
				requestedResourceHandle === "all"
					? "Products"
					: "Collection",

			handle:
				requestedResourceHandle || "",

			description: "",
			productCount: 0,
			products: [],
			image: null,
		};
	}

	let productData = null;

	if (requestedTemplate === "product" && requestedResourceHandle) {
		productData = await getProductByHandle({
			admin,
			handle: requestedResourceHandle,
		});
	}

	if (requestedTemplate === "product" && !productData) {
		productData = {
			id: null,
			title: "Product",
			handle: requestedResourceHandle || "",
			description: "",
			descriptionHtml: "",
			vendor: "",
			productType: "",
			featuredImage: null,
			images: [],
			price: null,
			compareAtPrice: null,
			availableForSale: false,
			variants: [],
		};
	}

	let searchData = null;
	if (requestedTemplate === "search") searchData = await getSearchData({ admin, query: searchQuery });

	let blogData = null;
	if (requestedTemplate === "blog" && requestedResourceHandle) blogData = await getBlogData({ admin, handle: requestedResourceHandle });

	let articleData = null;
	if (requestedTemplate === "article") {
		const resource = requestedResourceHandle || [requestedBlogHandle, requestedArticleHandle].filter(Boolean).join("/");
		const [blogHandle, articleHandle] = resource.split("/");
		if (blogHandle && articleHandle) articleData = await getArticleData({ admin, blogHandle, articleHandle });
	}

	const globalHeader = !["header", "footer"].includes(page.template) && pageSettings.headerEnabled !== false
		? await getGlobalSection(db, session.shop, "header", pageSettings.headerId || null, { locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled })
		: null;
	const globalFooter = !["header", "footer"].includes(page.template) && pageSettings.footerEnabled !== false
		? await getGlobalSection(db, session.shop, "footer", pageSettings.footerId || null, { locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled })
		: null;
	if (globalHeader?.elements) globalHeader.elements = await resolveReusableSections({ database: db, shop: session.shop, elements: globalHeader.elements, locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled });
	if (globalFooter?.elements) globalFooter.elements = await resolveReusableSections({ database: db, shop: session.shop, elements: globalFooter.elements, locale: requestedLocale, marketKey: requestedMarketKey, localizationEnabled });

	let shopDesignTokens = {};
	let enterpriseSettings = parseEnterpriseSettings({});
	try {
		const setting = await db.builderShopSetting.findUnique({ where: { shop: session.shop }, select: { designTokensJson: true, enterpriseJson: true } });
		shopDesignTokens = JSON.parse(setting?.designTokensJson || "{}");
		enterpriseSettings = parseEnterpriseSettings(setting?.enterpriseJson);
	} catch (error) {
		console.error("VSN shop settings lookup failed:", error);
	}

	const widgetPlatform=await loadStorefrontWidgetPlatform(db,session.shop).catch((error)=>{console.error("VSN storefront widget platform load failed:",error);return{customWidgets:[],templates:{}};});

	if (customJsMode) {
		if (enterpriseSettings.safeMode) return javascriptResponse("/* VSN Safe Mode: custom JavaScript disabled. */");
		return javascriptResponse(buildCustomJsBundle([resolvedElements, globalHeader?.elements || [], globalFooter?.elements || []]));
	}

	const dynamicMetaobjects = await loadDynamicMetaobjects({ admin, elements: resolvedElements });
	const widgetQueries = await loadWidgetGridData({ admin, elements: resolvedElements, collectionData, searchData });
	const formConfigs=await loadRenderFormConfigs(session.shop,[resolvedElements,globalHeader?.elements||[],globalFooter?.elements||[]].flat()).catch(()=>({}));
	if (loopQueryMode && requestedLoopId) {
		const loopNode = collectLoopNodes(resolvedElements, []).find((node) => node.id === requestedLoopId);
		if (!loopNode) return jsonResponse({ ok:false, success:false, error:"Loop widget was not found.", html:"", pageInfo:{hasNextPage:false,endCursor:null} }, 200);
		const definition = normalizeQueryDefinition(loopNode.props?.query || {});
		const result = await runShopifyLoopQuery({ admin, definition, afterCursor: requestedLoopAfter || null, pageSize: requestedLoopPageSize, context: {
			productHandle: productData?.handle || (requestedTemplate === "product" ? requestedResourceHandle : ""),
			collectionHandle: collectionData?.handle || (requestedTemplate === "collection" ? requestedResourceHandle : ""),
		} });
		const template = (Array.isArray(loopNode.children) ? loopNode.children : []).find((child) => child?.props?.__loopItem) || loopNode.children?.[0] || null;
		const html = result.success && template ? (result.items || []).map((item) => `<div class="vsn-loop-item" data-vsn-loop-key="${escapeAttribute(item.id || item.handle || "")}">${renderNode(template, { collection:collectionData, product:productData, search:searchData, blog:blogData, article:articleData, customer:customerData, cart:{itemCount:campaignContext.cartItemCount}, dynamicMetaobjects, widgetQueries, loop:item, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs })}</div>`).join("") : "";
		return jsonResponse({ ok:result.success, ...result, html, loopId:requestedLoopId, pageId:page.id }, 200);
	}
	const loopQueries = await loadLoopQueryData({ admin, elements: resolvedElements, context: { productHandle: productData?.handle || "", collectionHandle: collectionData?.handle || "" } });
	let customFonts = [];
	try { customFonts = await db.builderCustomFont.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id:true, family:true, weight:true, style:true, mimeType:true } }); }
	catch (error) { console.error("VSN custom font lookup failed:", error); }

	if (!Array.isArray(resolvedElements) || renderableElements(resolvedElements).length === 0) {
		return htmlResponse(
			fragmentMode
				? '<div class="vsn-page" data-vsn-page-boundary="1" data-vsn-empty="1"></div>'
				: renderMessagePage("This builder template is published but currently empty."),
			200,
		);
	}

	const html = fragmentMode
		? renderBuilderFragment({
			page,
			elements: resolvedElements,
			pageSettings,
			collectionData,
			productData, searchData, blogData, articleData, customerData, cartContext:{itemCount:campaignContext.cartItemCount}, dynamicMetaobjects, widgetQueries, loopQueries,
			headerElements: globalHeader, footerElements: globalFooter,
			designTokens: shopDesignTokens,
			customFonts,
			enterpriseSettings,
			assetPipelineOptimized,
			experiment: experimentMeta,
			widgetPlatform,
			googleMapsApiKey, googleCaptcha, formConfigs,
			localization: { locale: localizationRender.locale || requestedLocale, marketKey: requestedMarketKey, direction: localizationRender.direction || "ltr" },
		})
		: renderBuilderDocument({
			page,
			title: page.title,
			elements: resolvedElements,
			pageSettings,
			collectionData,
			productData, searchData, blogData, articleData, customerData, cartContext:{itemCount:campaignContext.cartItemCount}, dynamicMetaobjects, widgetQueries, loopQueries,
			headerElements: globalHeader, footerElements: globalFooter,
			designTokens: shopDesignTokens,
			customFonts,
			enterpriseSettings,
			assetPipelineOptimized,
			experiment: experimentMeta,
			widgetPlatform,
			googleMapsApiKey, googleCaptcha, formConfigs,
			localization: { locale: localizationRender.locale || requestedLocale, marketKey: requestedMarketKey, direction: localizationRender.direction || "ltr" },
		});

	if (fragmentMode && admin && PRERENDER_TEMPLATES.includes(requestedTemplate)) {
		try {
			const ruleCount = await db.builderTemplateRule.count({ where: { shop: session.shop, template: requestedTemplate, enabled: true } });
			if (isPrerenderCacheable({ template: requestedTemplate, html, experiment: experimentMeta, localizationEnabled, hasLiquid: hasLiquidPlaceholders(html), dynamicData: [dynamicMetaobjects, widgetQueries, loopQueries], elementGroups: [resolvedElements, globalHeader?.elements || [], globalFooter?.elements || []], ruleCount })) {
				await storePrerender(admin, { key: prerenderKey(requestedTemplate, requestedResourceHandle), html });
			}
		} catch (error) { console.warn("VSN prerender cache skipped:", error?.message || error); }
	}

	if (hasLiquidPlaceholders(html)) {
		const liquid = buildLiquidBody(html, { enabled: !enterpriseSettings.safeMode });
		return liquid.liquid ? liquidResponse(liquid.body, 200) : htmlResponse(liquid.body, 200);
	}
	return htmlResponse(html, 200);
}

function safeParseJson(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function collectLoopNodes(elements = [], out = []) {
	for (const node of Array.isArray(elements) ? elements : []) {
		if (node?.type === "loop" && node?.id) out.push(node);
		collectLoopNodes(node?.children || [], out);
	}
	return out;
}

async function loadLoopQueryData({ admin, elements = [], context = {} }) {
	const nodes = collectLoopNodes(elements, []);
	if (!nodes.length) return {};
	const entries = await Promise.all(nodes.map(async (node) => {
		const definition = normalizeQueryDefinition(node.props?.query || {});
		const result = await runShopifyLoopQuery({ admin, definition, context });
		return [node.id, { ...result, definition }];
	}));
	return Object.fromEntries(entries);
}

function renderBuilderFragment({
	page,
	elements,
	pageSettings = {},
	collectionData = null,
	productData = null,
	searchData = null, blogData = null, articleData = null, customerData = null, cartContext = {}, dynamicMetaobjects = {}, widgetQueries = {}, loopQueries = {},
	headerElements = null, footerElements = null,
	designTokens = {},
	customFonts = [],
	enterpriseSettings = {},
	assetPipelineOptimized = false,
	experiment = null,
	widgetPlatform = {},
	googleMapsApiKey = "", googleCaptcha = {}, formConfigs = {},
	localization = null,
}) {
	const globals = mergeShopDesignTokens(getGlobalStyles(elements), designTokens);
	const fontRuntime = vsnFontRuntime({ elements: [elements, headerElements?.elements || [], footerElements?.elements || []], globals, customFonts });
	const styleCss = buildStyleBundleCss(
		[elements, headerElements?.elements || [], footerElements?.elements || []],
		globals,
		{ includeBase: true, importantBase: true, includeHidden: true, includeResponsive: true, importantResponsive: true },
	);
	const inlineStyleCss = assetPipelineOptimized && enterpriseSettings?.criticalCss !== false
		? buildStyleBundleCss([renderableElements(elements).slice(0,2), Array.isArray(headerElements?.elements) ? renderableElements(headerElements.elements).slice(0,1) : []], globals, { includeBase: true, importantBase: true, includeHidden: false, includeResponsive: true, importantResponsive: true })
		: styleCss;
	const content = renderableElements(elements)
		.map((element) =>
			renderNode(element, {
				collection: collectionData,
				product: productData, search: searchData, blog: blogData, article: articleData, customer: customerData, cart: cartContext, dynamicMetaobjects, widgetQueries, loopQueries, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs,
			}),
		)
		.join("");
	const headerContent = Array.isArray(headerElements?.elements) ? renderableElements(headerElements.elements).map((el)=>renderNode(el,{ customer: customerData, cart: cartContext, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs })).join("") : "";
	const footerContent = Array.isArray(footerElements?.elements) ? renderableElements(footerElements.elements).map((el)=>renderNode(el,{ customer: customerData, cart: cartContext, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs })).join("") : "";
	const headerSettings = headerElements?.settings || {};
	const footerSettings = footerElements?.settings || {};
	const seoPayload = buildSeoPayload({ page, title: page?.title || "", settings: pageSettings, product: productData, article: articleData });
	const schemaMarkup = pageSettings.schemaEnabled === false ? "" : buildSchemaMarkup({ product: productData, article: articleData });

	return `
    <style data-vsn-inline-bundle="1">
      ${fontRuntime.googleUrl ? `@import url("${fontRuntime.googleUrl}");` : ""}
      ${fontRuntime.css}
      .vsn-page,
      .vsn-page *,
      .vsn-page *::before,
      .vsn-page *::after {
        box-sizing: border-box;
      }

      .vsn-page {
        width: 100%;
        min-height: 1px;
        color: ${escapeAttribute(globals.textColor)};
        background: ${escapeAttribute(globals.backgroundColor)};
        font-family: ${escapeAttribute(globals.fontFamily)};
        --vsn-primary: ${escapeAttribute(globals.primaryColor)};
        --vsn-secondary: ${escapeAttribute(globals.secondaryColor)};
        --vsn-accent: ${escapeAttribute(globals.accentColor)};
        --vsn-surface: ${escapeAttribute(globals.surfaceColor)};
        --vsn-surface-muted: ${escapeAttribute(globals.mutedSurfaceColor)};
        --vsn-border: ${escapeAttribute(globals.borderColor)};
        --vsn-button-bg: ${escapeAttribute(globals.buttonBackground)};
        --vsn-button-color: ${escapeAttribute(globals.buttonTextColor)};
        --vsn-button-radius: ${escapeAttribute(globals.buttonRadius)};
        --vsn-form-bg: ${escapeAttribute(globals.formBackground)};
        --vsn-form-color: ${escapeAttribute(globals.formTextColor)};
        --vsn-form-border: ${escapeAttribute(globals.formBorderColor)};
        --vsn-form-radius: ${escapeAttribute(globals.formRadius)};
        --vsn-container-max: ${escapeAttribute(designTokens.containerMd || globals.containerMaxWidth)};
        --vsn-space-xs: ${escapeAttribute(designTokens.spacingXs || "4px")};
        --vsn-space-sm: ${escapeAttribute(designTokens.spacingSm || "8px")};
        --vsn-space-md: ${escapeAttribute(designTokens.spacingMd || "16px")};
        --vsn-space-lg: ${escapeAttribute(designTokens.spacingLg || "24px")};
        --vsn-space-xl: ${escapeAttribute(designTokens.spacingXl || "40px")};
        --vsn-radius-sm: ${escapeAttribute(designTokens.radiusSm || globals.radiusSm)};
        --vsn-radius-md: ${escapeAttribute(designTokens.radiusMd || globals.radiusMd)};
        --vsn-radius-lg: ${escapeAttribute(designTokens.radiusLg || globals.radiusLg)};
        --vsn-shadow-sm: ${escapeAttribute(designTokens.shadowSm || globals.shadowSm)};
        --vsn-shadow-md: ${escapeAttribute(designTokens.shadowMd || globals.shadowMd)};
        --vsn-shadow-lg: ${escapeAttribute(designTokens.shadowLg || globals.shadowLg)};
        --vsn-space-unit: ${escapeAttribute(`${globals.spacingBase}px`)};
      }

      .vsn-page h1, .vsn-page h2, .vsn-page h3, .vsn-page h4, .vsn-page h5, .vsn-page h6 {
        font-family: ${escapeAttribute(globals.headingFontFamily)};
      }
      .vsn-page button, .vsn-page .vsn-button { border-radius: var(--vsn-button-radius); }
      .vsn-page input:not([type="checkbox"]):not([type="radio"]), .vsn-page textarea, .vsn-page select { background:var(--vsn-form-bg); color:var(--vsn-form-color); border-color:var(--vsn-form-border); border-radius:var(--vsn-form-radius); }

      .vsn-page img {
        display: block;
        max-width: 100%;
      }

      .vsn-page .vsn-container {
        display: flex;
        width: 100%;
      }

      .vsn-page .vsn-heading,
      .vsn-page .vsn-text {
        margin: 0;
      }

      .vsn-page .vsn-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        cursor: pointer;
      }

      @media (max-width: 749px) {
        .vsn-page .vsn-columns,
        .vsn-page .vsn-search-results-grid,
        .vsn-page .vsn-blog-article-grid {
          grid-template-columns: 1fr !important;
        }
      }
      .vsn-global-header[data-vsn-sticky="1"] { position: sticky; top: 0; z-index: 50; }
      .vsn-global-header[data-vsn-transparent="1"] { position: absolute; inset: 0 0 auto 0; z-index: 50; background: transparent !important; }
      .vsn-global-header, .vsn-global-footer { width: 100%; }
      @keyframes vsnMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @media (max-width: 1024px) { .vsn-gallery-grid:not(.is-masonry):not(.is-justified) { grid-template-columns: repeat(var(--vsn-gallery-cols-tablet,2),minmax(0,1fr)) !important; } .vsn-gallery-grid.is-masonry { column-count: var(--vsn-gallery-cols-tablet,2) !important; } }
      @media (max-width: 749px) { .vsn-gallery-grid:not(.is-masonry):not(.is-justified) { grid-template-columns: repeat(var(--vsn-gallery-cols-mobile,1),minmax(0,1fr)) !important; } .vsn-gallery-grid.is-masonry { column-count: var(--vsn-gallery-cols-mobile,1) !important; } }
      .vsn-slider-track{display:flex;gap:var(--vsn-slider-gap,16px);transition:transform var(--vsn-slider-speed,450ms) ease;will-change:transform}.vsn-slider-slide{flex:0 0 calc((100% - (var(--vsn-slider-desktop,1) - 1)*var(--vsn-slider-gap,16px))/var(--vsn-slider-desktop,1));box-sizing:border-box}.vsn-slider-prev,.vsn-slider-next{position:absolute;top:50%;transform:translateY(-50%);z-index:4;width:38px;height:38px;border:1px solid #ddd;border-radius:999px;background:#fff;color:#111;cursor:pointer}.vsn-slider-prev{left:8px}.vsn-slider-next{right:8px}.vsn-slider-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}.vsn-slider-dots button{width:8px;height:8px;padding:0;border:0;border-radius:999px;background:#ccc;cursor:pointer}.vsn-slider-dots button.is-active{background:#111}.vsn-slider-fraction{text-align:center;font-size:12px;margin-top:8px}.vsn-slider-progress{height:3px;background:#eee;margin-top:8px;overflow:hidden}.vsn-slider-progress span{display:block;height:100%;width:0;background:#111;transition:width .2s}.vsn-video-play{z-index:3}@media(max-width:1024px){.vsn-slider-slide{flex-basis:calc((100% - (var(--vsn-slider-tablet,1) - 1)*var(--vsn-slider-gap,16px))/var(--vsn-slider-tablet,1))}}@media(max-width:749px){.vsn-slider-slide{flex-basis:calc((100% - (var(--vsn-slider-mobile,1) - 1)*var(--vsn-slider-gap,16px))/var(--vsn-slider-mobile,1))}}

      ${inlineStyleCss}
    </style>

    ${headerContent ? `<div class="vsn-global-header" data-vsn-sticky="${headerSettings.sticky ? "1" : "0"}" data-vsn-transparent="${headerSettings.transparent ? "1" : "0"}" data-vsn-mobile-menu="${headerSettings.mobileMenu !== false ? "1" : "0"}" data-vsn-mobile-breakpoint="${escapeAttribute(headerSettings.mobileBreakpoint || 749)}">${headerContent}</div>` : ""}
    <div
      class="vsn-page"
      data-vsn-safe-mode="${enterpriseSettings?.safeMode ? "1" : "0"}"
      lang="${escapeAttribute(localization?.locale || "")}"
      dir="${escapeAttribute(localization?.direction || "ltr")}"
      data-vsn-locale="${escapeAttribute(localization?.locale || "")}"
      data-vsn-market="${escapeAttribute(localization?.marketKey || "*")}"
      data-vsn-page-boundary="1"
      data-vsn-page-id="${escapeAttribute(
		page.id || "",
	)}"
      data-vsn-page-handle="${escapeAttribute(
		page.handle || "",
	)}"
      data-vsn-experiment-id="${escapeAttribute(experiment?.id || "")}"
      data-vsn-experiment-variant-id="${escapeAttribute(experiment?.variantId || "")}"
      data-vsn-experiment-variant-key="${escapeAttribute(experiment?.variantKey || "")}"
      data-vsn-experiment-goal="${escapeAttribute(experiment?.goalType || "")}"
      data-vsn-experiment-goal-value="${escapeAttribute(experiment?.goalValue || "")}"
      data-vsn-experiment-runtime-css="${experiment?.changed ? "1" : "0"}"
      data-vsn-experiment-preview="${experiment?.preview ? "1" : "0"}"
      data-vsn-lightbox-enabled="${globals.lightboxEnabled === false ? "0" : "1"}"
      data-vsn-lightbox-backdrop="${escapeAttribute(globals.lightboxBackdrop || "#000000")}"
      data-vsn-lightbox-opacity="${escapeAttribute(globals.lightboxBackdropOpacity ?? 0.86)}"
      data-vsn-lightbox-max-width="${escapeAttribute(globals.lightboxMaxWidth || 96)}"
      data-vsn-lightbox-max-height="${escapeAttribute(globals.lightboxMaxHeight || 92)}"
      data-vsn-lightbox-show-close="${globals.lightboxShowClose === false ? "0" : "1"}"
      data-vsn-lightbox-close-backdrop="${globals.lightboxCloseOnBackdrop === false ? "0" : "1"}"
      data-vsn-lightbox-close-escape="${globals.lightboxCloseOnEscape === false ? "0" : "1"}"
      data-vsn-lightbox-animation="${escapeAttribute(globals.lightboxAnimation || "fade")}"
      data-vsn-mobile-breakpoint="${escapeAttribute(globals.mobileBreakpoint)}"
      data-vsn-tablet-breakpoint="${escapeAttribute(globals.tabletBreakpoint)}"
    >
      ${content}
    </div>
    ${footerContent ? `<div class="vsn-global-footer" data-vsn-full-width="${footerSettings.fullWidth !== false ? "1" : "0"}">${footerContent}</div>` : ""}
    <script type="application/json" class="vsn-seo-payload">${safeJsonForHtml(seoPayload)}</script>
    ${enterpriseSettings?.safeMode ? "" : `<span hidden data-vsn-custom-js-url="/apps/vsn-builder/${encodeURIComponent(page.id || page.handle || "default")}?customJs=1"></span>`}
    ${schemaMarkup}
  `;
}

function renderBuilderDocument({
	page = null,
	title,
	elements,
	pageSettings = {},
	collectionData = null,
	productData = null,
	searchData = null, blogData = null, articleData = null, customerData = null, cartContext = {}, dynamicMetaobjects = {}, widgetQueries = {}, loopQueries = {},
	headerElements = null, footerElements = null,
	designTokens = {},
	customFonts = [],
	enterpriseSettings = {},
	experiment = null,
	widgetPlatform = {},
	googleMapsApiKey = "", googleCaptcha = {}, formConfigs = {},
	localization = null,
}) {
	const globals = mergeShopDesignTokens(getGlobalStyles(elements), designTokens);
	const fontRuntime = vsnFontRuntime({ elements: [elements, headerElements?.elements || [], footerElements?.elements || []], globals, customFonts });
	const styleCss = buildStyleBundleCss(
		[elements, headerElements?.elements || [], footerElements?.elements || []],
		globals,
		{ includeBase: true, importantBase: true, includeHidden: true, includeResponsive: true, importantResponsive: true },
	);
	const content = renderableElements(elements)
		.map((element) =>
			renderNode(element, {
				collection: collectionData,
				product: productData, search: searchData, blog: blogData, article: articleData, customer: customerData, cart: cartContext, dynamicMetaobjects, widgetQueries, loopQueries, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs,
			}),
		)
		.join("");
	const headerContent = Array.isArray(headerElements?.elements) ? renderableElements(headerElements.elements).map((el)=>renderNode(el,{ customer: customerData, cart: cartContext, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs })).join("") : "";
	const footerContent = Array.isArray(footerElements?.elements) ? renderableElements(footerElements.elements).map((el)=>renderNode(el,{ customer: customerData, cart: cartContext, enterpriseSettings, widgetTemplates:widgetPlatform.templates, googleMapsApiKey, googleCaptcha, formConfigs })).join("") : "";
	const headerSettings = headerElements?.settings || {};
	const footerSettings = footerElements?.settings || {};
	const seoPayload = buildSeoPayload({ title, settings: pageSettings, product: productData, article: articleData });
	const schemaMarkup = pageSettings.schemaEnabled === false ? "" : buildSchemaMarkup({ product: productData, article: articleData });

	return `
    <!doctype html>
    <html lang="${escapeAttribute(localization?.locale || "en")}" dir="${escapeAttribute(localization?.direction || "ltr")}">
      <head>
        <meta charset="utf-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

        <title>${escapeHtml(seoPayload.title || title)}</title>
        ${seoPayload.description ? `<meta name="description" content="${escapeAttribute(seoPayload.description)}">` : ""}
        ${seoPayload.canonical ? `<link rel="canonical" href="${escapeAttribute(seoPayload.canonical)}">` : ""}
        ${seoPayload.ogTitle ? `<meta property="og:title" content="${escapeAttribute(seoPayload.ogTitle)}">` : ""}
        ${seoPayload.ogDescription ? `<meta property="og:description" content="${escapeAttribute(seoPayload.ogDescription)}">` : ""}
        ${seoPayload.ogImage ? `<meta property="og:image" content="${escapeAttribute(seoPayload.ogImage)}">` : ""}
        ${schemaMarkup}
        ${fontRuntime.googleUrl ? `<link rel="stylesheet" href="${escapeAttribute(fontRuntime.googleUrl)}">` : ""}

        <style>
          ${fontRuntime.css}
          *,
          *::before,
          *::after {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          body {
            font-family: ${escapeAttribute(globals.fontFamily)};
            color: ${escapeAttribute(globals.textColor)};
            background: ${escapeAttribute(globals.backgroundColor)};
            --vsn-primary: ${escapeAttribute(globals.primaryColor)}; --vsn-secondary: ${escapeAttribute(globals.secondaryColor)}; --vsn-accent: ${escapeAttribute(globals.accentColor)};
            --vsn-surface: ${escapeAttribute(globals.surfaceColor)}; --vsn-surface-muted: ${escapeAttribute(globals.mutedSurfaceColor)}; --vsn-border: ${escapeAttribute(globals.borderColor)};
            --vsn-button-bg: ${escapeAttribute(globals.buttonBackground)}; --vsn-button-color: ${escapeAttribute(globals.buttonTextColor)}; --vsn-button-radius: ${escapeAttribute(globals.buttonRadius)};
            --vsn-form-bg: ${escapeAttribute(globals.formBackground)}; --vsn-form-color: ${escapeAttribute(globals.formTextColor)}; --vsn-form-border: ${escapeAttribute(globals.formBorderColor)}; --vsn-form-radius: ${escapeAttribute(globals.formRadius)};
            --vsn-shadow-sm: ${escapeAttribute(globals.shadowSm)}; --vsn-shadow-md: ${escapeAttribute(globals.shadowMd)}; --vsn-shadow-lg: ${escapeAttribute(globals.shadowLg)};
            --vsn-container-max: ${escapeAttribute(designTokens.containerMd || globals.containerMaxWidth)};
            --vsn-space-xs: ${escapeAttribute(designTokens.spacingXs || "4px")};
            --vsn-space-sm: ${escapeAttribute(designTokens.spacingSm || "8px")};
            --vsn-space-md: ${escapeAttribute(designTokens.spacingMd || "16px")};
            --vsn-space-lg: ${escapeAttribute(designTokens.spacingLg || "24px")};
            --vsn-radius-md: ${escapeAttribute(designTokens.radiusMd || "10px")};
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: ${escapeAttribute(globals.headingFontFamily)};
          }

          img {
            display: block;
            max-width: 100%;
          }

          .vsn-page {
            width: 100%;
            min-height: 100vh;
          }

          .vsn-container {
            display: flex;
            width: 100%;
          }

          .vsn-heading,
          .vsn-text {
            margin: 0;
          }

          .vsn-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            cursor: pointer;
          }
          .vsn-global-header[data-vsn-sticky="1"] { position: sticky; top: 0; z-index: 50; }
          .vsn-global-header[data-vsn-transparent="1"] { position: absolute; inset: 0 0 auto 0; z-index: 50; background: transparent !important; }
          ${styleCss}
        </style>
      </head>

      <body>
        ${headerContent ? `<div class="vsn-global-header" data-vsn-sticky="${headerSettings.sticky ? "1" : "0"}" data-vsn-transparent="${headerSettings.transparent ? "1" : "0"}" data-vsn-mobile-menu="${headerSettings.mobileMenu !== false ? "1" : "0"}" data-vsn-mobile-breakpoint="${escapeAttribute(headerSettings.mobileBreakpoint || 749)}">${headerContent}</div>` : ""}
        <main class="vsn-page" data-vsn-page-boundary="1" data-vsn-page-id="${escapeAttribute(page?.id || "")}" data-vsn-experiment-id="${escapeAttribute(experiment?.id || "")}" data-vsn-experiment-variant-id="${escapeAttribute(experiment?.variantId || "")}" data-vsn-experiment-variant-key="${escapeAttribute(experiment?.variantKey || "")}" data-vsn-experiment-goal="${escapeAttribute(experiment?.goalType || "")}" data-vsn-experiment-goal-value="${escapeAttribute(experiment?.goalValue || "")}" data-vsn-experiment-runtime-css="${experiment?.changed ? "1" : "0"}" data-vsn-experiment-preview="${experiment?.preview ? "1" : "0"}" data-vsn-lightbox-enabled="${globals.lightboxEnabled === false ? "0" : "1"}" data-vsn-lightbox-backdrop="${escapeAttribute(globals.lightboxBackdrop || "#000000")}" data-vsn-lightbox-opacity="${escapeAttribute(globals.lightboxBackdropOpacity ?? 0.86)}" data-vsn-lightbox-max-width="${escapeAttribute(globals.lightboxMaxWidth || 96)}" data-vsn-lightbox-max-height="${escapeAttribute(globals.lightboxMaxHeight || 92)}" data-vsn-lightbox-show-close="${globals.lightboxShowClose === false ? "0" : "1"}" data-vsn-lightbox-close-backdrop="${globals.lightboxCloseOnBackdrop === false ? "0" : "1"}" data-vsn-lightbox-close-escape="${globals.lightboxCloseOnEscape === false ? "0" : "1"}" data-vsn-lightbox-animation="${escapeAttribute(globals.lightboxAnimation || "fade")}" data-vsn-mobile-breakpoint="${escapeAttribute(globals.mobileBreakpoint)}" data-vsn-tablet-breakpoint="${escapeAttribute(globals.tabletBreakpoint)}">
          ${content}
        </main>
        ${footerContent ? `<div class="vsn-global-footer" data-vsn-full-width="${footerSettings.fullWidth !== false ? "1" : "0"}">${footerContent}</div>` : ""}
        ${page?.id ? `<script src="/apps/vsn-builder/${encodeURIComponent(page.id)}?customJs=1" defer></script>` : ""}
      </body>
    </html>
  `;
}

const normalizeNodeStyles = buildNodeStyle;

function renderCollectionProductGrid(
	node,
	props,
	styles,
	renderContext,
) {
	const PRODUCT_PLACEHOLDER =
		"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f1f1f1'/%3E%3Cpath%20d='M270%20515l100-115%2070%2075%2090-110%20100%20150H270z'%20fill='%23d7d7d7'/%3E%3Ccircle%20cx='330'%20cy='300'%20r='42'%20fill='%23d7d7d7'/%3E%3C/svg%3E";

	const collection =
		renderContext.collection;

	const allProducts =
		Array.isArray(collection?.products)
			? collection.products
			: [];

	const limit = Math.max(
		1,
		Math.min(
			Number(props.limit || 8),
			24,
		),
	);

	const products =
		allProducts.slice(0, limit);

	const columnsDesktop = Math.max(
		1,
		Math.min(
			Number(
				props.columnsDesktop || 4,
			),
			6,
		),
	);

	const columnsTablet = Math.max(
		1,
		Math.min(
			Number(
				props.columnsTablet || 2,
			),
			4,
		),
	);

	const columnsMobile = Math.max(
		1,
		Math.min(
			Number(
				props.columnsMobile || 1,
			),
			2,
		),
	);

	const showImage =
		props.showImage !== false;

	const showTitle =
		props.showTitle !== false;

	const showPrice =
		props.showPrice !== false;

	const showCompareAtPrice =
		props.showCompareAtPrice !== false;

	const filtersEnabled =
		props.filtersEnabled === true;

	const filterAvailabilityEnabled =
		props.filterAvailabilityEnabled !== false;

	const filterPriceEnabled =
		props.filterPriceEnabled !== false;

	const filterVendorEnabled =
		props.filterVendorEnabled !== false;

	const filterProductTypeEnabled =
		props.filterProductTypeEnabled !== false;

	const filterLabel =
		String(props.filterLabel || "Filter products").trim() ||
		"Filter products";

	const clearFiltersText =
		String(props.clearFiltersText || "Clear filters").trim() ||
		"Clear filters";

	const loadMoreEnabled =
		props.loadMoreEnabled !== false;

	const loadMoreText =
		String(
			props.loadMoreText || "Load More",
		).trim() || "Load More";

	const loadMoreLoadingText =
		String(
			props.loadMoreLoadingText || "Loading...",
		).trim() || "Loading...";

	const loadMoreAlignment =
		allowedValue(
			props.loadMoreAlignment,
			["left", "center", "right"],
			"center",
		);

	const loadMoreJustify =
		loadMoreAlignment === "left"
			? "flex-start"
			: loadMoreAlignment === "right"
				? "flex-end"
				: "center";

	const imageRatioMap = {
		square: "1 / 1",
		portrait: "4 / 5",
		landscape: "4 / 3",
		wide: "16 / 9",
	};

	const naturalImage =
		props.imageRatio === "natural";

	const imageAspectRatio =
		imageRatioMap[
		props.imageRatio || "square"
		] || "1 / 1";

	const imageObjectFit =
		allowedValue(
			styles?.image?.objectFit,
			[
				"cover",
				"contain",
				"fill",
			],
			"cover",
		);

	const imageRadius =
		cssSize(
			styles?.image?.borderRadius,
			"8px",
		);

	const gap = cssSize(
		styles?.grid?.gap,
		"24px",
	);

	const cardBackground =
		safeColor(
			styles?.card
				?.backgroundColor,
			"#ffffff",
		);

	const cardBorderColor =
		safeColor(
			styles?.card
				?.borderColor,
			"#e5e5e5",
		);

	const cardBorderWidth =
		cssSize(
			styles?.card
				?.borderWidth,
			"1px",
		);

	const cardRadius =
		cssSize(
			styles?.card
				?.borderRadius,
			"12px",
		);

	const cardPadding =
		cssSize(
			styles?.card?.padding,
			"12px",
		);

	const titleTypographyCss = productTypographyStyle(
		styles?.titleTypography || {},
		{
			fontSize: "16px",
			fontWeight: "600",
			lineHeight: "1.4",
			color: "#1a1a1a",
		},
	);

	const priceTypographyCss = productTypographyStyle(
		styles?.priceTypography || {},
		{
			fontSize: "15px",
			fontWeight: "600",
			lineHeight: "1.4",
			color: "#1a1a1a",
		},
	);

	const comparePriceTypographyCss = productTypographyStyle(
		styles?.comparePriceTypography || {},
		{
			fontSize: "14px",
			fontWeight: "400",
			lineHeight: "1.4",
			color: "#777777",
		},
	);

	const loadMoreBackground =
		safeColor(
			styles?.loadMoreButton?.backgroundColor,
			"#1a1a1a",
		);

	const loadMoreColor =
		safeColor(
			styles?.loadMoreButton?.color,
			"#ffffff",
		);

	const loadMoreBorderColor =
		safeColor(
			styles?.loadMoreButton?.borderColor,
			"#1a1a1a",
		);

	const loadMoreBorderWidth =
		cssSize(
			styles?.loadMoreButton?.borderWidth,
			"0px",
		);

	const loadMoreRadius =
		cssSize(
			styles?.loadMoreButton?.borderRadius,
			"8px",
		);

	const loadMorePaddingY =
		cssSize(
			styles?.loadMoreButton?.paddingY,
			"12px",
		);

	const loadMorePaddingX =
		cssSize(
			styles?.loadMoreButton?.paddingX,
			"22px",
		);

	const loadMoreFontSize =
		cssSize(
			styles?.loadMoreButton?.fontSize,
			"14px",
		);

	const loadMoreFontWeight =
		allowedValue(
			String(
				styles?.loadMoreButton?.fontWeight || "600",
			),
			["400", "500", "600", "700", "800"],
			"600",
		);

	const loadMoreMarginTop =
		cssSize(
			styles?.loadMoreButton?.marginTop,
			"24px",
		);

	const spacing =
		individualSpacingCss(
			normalizeNodeStyles(styles),
		);

	if (!products.length) {
		return `
      <div
        class="vsn-collection-product-grid-empty"
        data-vsn-id="${escapeAttribute(
			node.id || "",
		)}"
        style="
          margin: ${spacing.margin};
          padding: ${spacing.padding};
        "
      >
        ${escapeHtml(
			props.emptyText ||
			"No products found in this collection.",
		)}
      </div>
    `;
	}

	const productCards =
		products
			.map((product) => {
				const imageUrl =
					product.image?.url ||
					PRODUCT_PLACEHOLDER;
				const imageAlt =
					product.image?.altText ||
					product.title ||
					"Product image";

				const price =
					formatMoney(
						product.price?.amount,
						product.price
							?.currencyCode,
					);

				const compareAtPriceAmount =
					Number(
						product.compareAtPrice
							?.amount || 0,
					);

				const normalPriceAmount =
					Number(
						product.price?.amount ||
						0,
					);

				const isOnSale =
					compareAtPriceAmount >
					normalPriceAmount;

				const isSoldOut =
					product.availableForSale === false;

				const compareAtPrice =
					isOnSale
						? formatMoney(
							compareAtPriceAmount,
							product.compareAtPrice
								?.currencyCode ||
							product.price
								?.currencyCode,
						)
						: "";

				return `
          <article
            class="vsn-product-card"
            data-vsn-available="${isSoldOut ? "0" : "1"}"
            data-vsn-price="${escapeAttribute(normalPriceAmount)}"
            data-vsn-vendor="${escapeAttribute(product.vendor || "")}"
            data-vsn-product-type="${escapeAttribute(product.productType || "")}"
            data-vsn-title="${escapeAttribute(product.title || "")}"
            style="
				opacity: ${isSoldOut ? "0.72" : "1"};
              background: ${cardBackground};
              border: ${cardBorderWidth}
                solid ${cardBorderColor};
              border-radius: ${cardRadius};
              padding: ${cardPadding};
              overflow: hidden;
            "
          >
            <a
              href="${escapeAttribute(
					safeUrl(
						product.url || "#",
					),
				)}"
              style="
                color: inherit;
                text-decoration: none;
              "
            >
              ${showImage
						? `
      <div
        class="vsn-product-image-wrap"
        style="
          position: relative;
          width: 100%;
        "
      >
        <img
          src="${escapeAttribute(
							safeUrl(imageUrl),
						)}"
          alt="${escapeAttribute(
							imageAlt,
						)}"
          loading="lazy"
          style="
            display: block;
            width: 100%;
            ${naturalImage
							? "height: auto;"
							: `aspect-ratio: ${imageAspectRatio};`
						}
            object-fit: ${imageObjectFit};
            border-radius: ${imageRadius};
          "
        >

        ${isSoldOut
							? `
              <span
                class="vsn-product-badge vsn-product-badge-sold-out"
                style="
                  position: absolute;
                  top: 10px;
                  left: 10px;
                  display: inline-flex;
                  align-items: center;
                  padding: 6px 10px;
                  border-radius: 999px;
                  background: #1a1a1a;
                  color: #ffffff;
                  font-size: 11px;
                  font-weight: 700;
                  line-height: 1;
                  text-transform: uppercase;
                  letter-spacing: 0.04em;
                "
              >
                Sold out
              </span>
            `
							: isOnSale
								? `
                <span
                  class="vsn-product-badge vsn-product-badge-sale"
                  style="
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: #d72c0d;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                  "
                >
                  Sale
                </span>
              `
								: ""
						}
      </div>
    `
						: ""
					}

              ${showTitle
						? `
                    <div
                      class="vsn-product-card-title vsn-card-title"
                      style="
                        margin-top: 12px;
                        ${titleTypographyCss}
                      "
                    >
                      ${escapeHtml(
							product.title ||
							"",
						)}
                    </div>
                  `
						: ""
					}

              ${showPrice
						? `
                    <div
                      class="vsn-product-price-row vsn-card-price-row"
                      style="
                        display: flex;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin-top: 6px;
                      "
                    >
                      <span
                        class="vsn-product-card-price vsn-card-price"
                        style="
                          ${priceTypographyCss}
                        "
                      >
                        ${escapeHtml(
							price,
						)}
                      </span>

                      ${showCompareAtPrice &&
							isOnSale &&
							compareAtPrice
							? `
							<span
                                class="vsn-product-card-compare-price vsn-card-compare-price"
								style="
								${comparePriceTypographyCss}
								opacity: 0.55;
								text-decoration: line-through;
								"
							>
								${escapeHtml(
								compareAtPrice,
							)}
							</span>
							`
							: ""
						}
                    </div>
                  `
						: ""
					}
            </a>
          </article>
        `;
			})
			.join("");

	const vendors = Array.from(
		new Set(
			products
				.map((product) => String(product.vendor || "").trim())
				.filter(Boolean),
		),
	).sort((a, b) => a.localeCompare(b));

	const productTypes = Array.from(
		new Set(
			products
				.map((product) => String(product.productType || "").trim())
				.filter(Boolean),
		),
	).sort((a, b) => a.localeCompare(b));

	const filterControlStyle =
		"min-height:40px;border:1px solid #d9d9d9;border-radius:8px;background:#fff;padding:8px 10px;font:inherit;color:inherit;";

	const filterBar = filtersEnabled
		? `
		<div class="vsn-product-filters" data-vsn-grid-id="${escapeAttribute(node.id || "")}" style="display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-bottom:18px;">
			<div style="width:100%;font-weight:600;">${escapeHtml(filterLabel)}</div>
			${filterAvailabilityEnabled ? `
			<label style="display:grid;gap:5px;font-size:13px;"><span>Availability</span>
			<select data-vsn-filter="availability" style="${filterControlStyle}"><option value="all">All</option><option value="in-stock">In stock</option><option value="out-of-stock">Out of stock</option></select></label>` : ""}
			${filterPriceEnabled ? `
			<label style="display:grid;gap:5px;font-size:13px;"><span>Min price</span><input data-vsn-filter="min-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" style="${filterControlStyle}width:120px;"></label>
			<label style="display:grid;gap:5px;font-size:13px;"><span>Max price</span><input data-vsn-filter="max-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Any" style="${filterControlStyle}width:120px;"></label>` : ""}
			${filterVendorEnabled ? `
			<label style="display:grid;gap:5px;font-size:13px;"><span>Vendor</span><select data-vsn-filter="vendor" style="${filterControlStyle}"><option value="">All vendors</option>${vendors.map((vendor) => `<option value="${escapeAttribute(vendor)}">${escapeHtml(vendor)}</option>`).join("")}</select></label>` : ""}
			${filterProductTypeEnabled ? `
			<label style="display:grid;gap:5px;font-size:13px;"><span>Product type</span><select data-vsn-filter="product-type" style="${filterControlStyle}"><option value="">All types</option>${productTypes.map((type) => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`).join("")}</select></label>` : ""}
			<button type="button" data-vsn-filter-clear style="${filterControlStyle}cursor:pointer;">${escapeHtml(clearFiltersText)}</button>
		</div>`
		: "";

	const uniqueId =
		String(node.id || "grid")
			.replace(
				/[^a-zA-Z0-9_-]/g,
				"",
			);

	return `
    <style>
      .vsn-product-grid-${uniqueId} {
        display: grid;
        grid-template-columns:
          repeat(
            ${columnsDesktop},
            minmax(0, 1fr)
          );
        gap: ${gap};
        width: 100%;
      }

      @media (max-width: 990px) {
        .vsn-product-grid-${uniqueId} {
          grid-template-columns:
            repeat(
              ${columnsTablet},
              minmax(0, 1fr)
            );
        }
      }

      @media (max-width: 749px) {
        .vsn-product-grid-${uniqueId} {
          grid-template-columns:
            repeat(
              ${columnsMobile},
              minmax(0, 1fr)
            );
        }
      }
    </style>
${filterBar}
<div
  class="
    vsn-collection-product-grid
    vsn-product-grid-${uniqueId}
  "
  data-vsn-show-image="${showImage ? "1" : "0"}"
data-vsn-show-title="${showTitle ? "1" : "0"}"
data-vsn-show-price="${showPrice ? "1" : "0"}"
data-vsn-show-compare-price="${showCompareAtPrice ? "1" : "0"}"

data-vsn-image-natural="${naturalImage ? "1" : "0"}"
data-vsn-image-ratio="${escapeAttribute(
		imageAspectRatio,
	)}"
data-vsn-image-fit="${escapeAttribute(
		imageObjectFit,
	)}"
data-vsn-image-radius="${escapeAttribute(
		imageRadius,
	)}"

data-vsn-card-background="${escapeAttribute(
		cardBackground,
	)}"
data-vsn-card-border-color="${escapeAttribute(
		cardBorderColor,
	)}"
data-vsn-card-border-width="${escapeAttribute(
		cardBorderWidth,
	)}"
data-vsn-card-radius="${escapeAttribute(
		cardRadius,
	)}"
data-vsn-card-padding="${escapeAttribute(
		cardPadding,
	)}"
data-vsn-page-size="${limit}"
  data-vsn-sort-by="${escapeAttribute(
		normalizeProductSort(props.sortBy),
	)}"
  data-vsn-id="${escapeAttribute(
		node.id || "",
	)}"
  data-vsn-dynamic="collection-product-grid"

  data-vsn-has-next="${collection?.pageInfo?.hasNextPage
			? "1"
			: "0"
		}"

  data-vsn-end-cursor="${escapeAttribute(
			collection?.pageInfo?.endCursor || "",
		)}"

  data-vsn-collection-handle="${escapeAttribute(
			collection?.handle || "",
		)}"

  style="
    margin: ${spacing.margin};
    padding: ${spacing.padding};
  "
>
  ${productCards}
</div>
<div class="vsn-filter-empty" data-vsn-filter-empty-for="${escapeAttribute(node.id || "")}" hidden style="padding:18px 0;text-align:center;color:#6d7175;">
  No loaded products match these filters.
</div>

${loadMoreEnabled &&
		collection?.pageInfo?.hasNextPage
			? `
      <div
        class="vsn-load-more-wrap"
        style="
          display: flex;
          justify-content: ${loadMoreJustify};
          width: 100%;
          margin-top: ${loadMoreMarginTop};
        "
      >
        <button
          type="button"
          class="vsn-load-more-button"

          data-vsn-grid-id="${escapeAttribute(
				node.id || "",
			)}"
          data-vsn-loading-text="${escapeAttribute(
				loadMoreLoadingText,
			)}"

          style="
            appearance: none;
            border-style: solid;
            border-color: ${loadMoreBorderColor};
            border-width: ${loadMoreBorderWidth};
            border-radius: ${loadMoreRadius};
            background: ${loadMoreBackground};
            color: ${loadMoreColor};
            padding: ${loadMorePaddingY} ${loadMorePaddingX};
            font-size: ${loadMoreFontSize};
            font-weight: ${loadMoreFontWeight};
            line-height: 1.2;
            cursor: pointer;
          "
        >
          ${escapeHtml(loadMoreText)}
        </button>
      </div>
    `
			: ""
		}
`;
}

function renderLoop(node, props, styles, renderContext) {
	const query = normalizeQueryDefinition(props?.query || {});
	const payload = renderContext?.loopQueries?.[node.id] || { success:true, items:[], pageInfo:{hasNextPage:false,endCursor:null} };
	const template = (Array.isArray(node.children) ? node.children : []).find((child) => child?.props?.__loopItem) || node.children?.[0] || null;
	const id = escapeAttribute(node.id || "");
	const desktop = Math.max(1, Math.min(12, Number(props.columnsDesktop || 4)));
	const tablet = Math.max(1, Math.min(8, Number(props.columnsTablet || 2)));
	const mobile = Math.max(1, Math.min(4, Number(props.columnsMobile || 1)));
	const gap = Math.max(0, Math.min(200, Number(props.gap || 20)));
	if (!payload.success) return `<div data-vsn-id="${id}" class="vsn-loop vsn-loop-error">${escapeHtml(payload.error || query.errorText)}</div>`;
	const items = Array.isArray(payload.items) ? payload.items : [];
	const body = template ? items.map((item) => `<div class="vsn-loop-item" data-vsn-loop-key="${escapeAttribute(item.id || item.handle || "")}">${renderNode(template, { ...renderContext, loop:item })}</div>`).join("") : "";
	const empty = !items.length ? `<div class="vsn-loop-empty">${escapeHtml(query.emptyText)}</div>` : "";
	const pageInfo = payload.pageInfo || {};
	const canLoad = query.pagination === "load-more" && pageInfo.hasNextPage && pageInfo.endCursor;
	const button = canLoad ? `<button type="button" class="vsn-loop-load-more" data-vsn-loop-load-more="1" data-vsn-loop-id="${id}" data-vsn-loop-after="${escapeAttribute(pageInfo.endCursor || "")}" data-vsn-loop-page-size="${escapeAttribute(query.limit)}">Load more</button>` : "";
	return `<section data-vsn-id="${id}" data-vsn-node-type="loop" class="vsn-loop" data-vsn-loop-source="${escapeAttribute(query.source)}" data-vsn-loop-pagination="${escapeAttribute(query.pagination)}"><style>@media(max-width:749px){[data-vsn-id="${id}"] .vsn-loop-grid{grid-template-columns:repeat(${mobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"] .vsn-loop-grid{grid-template-columns:repeat(${tablet},minmax(0,1fr))!important}}</style><div class="vsn-loop-grid" style="display:grid;grid-template-columns:repeat(${desktop},minmax(0,1fr));gap:${gap}px;">${body}${empty}</div>${button}</section>`;
}

function renderNodeCore(
	node,
	renderContext = {},
) {
	if (!node || typeof node !== "object") {
		return "";
	}

	const type = String(
		node.type || "",
	);

	const props =
		node.props &&
			typeof node.props === "object"
			? node.props
			: {};

	const styles =
		node.styles &&
			typeof node.styles === "object"
			? node.styles
			: {};

	const children = Array.isArray(
		node.children,
	)
		? node.children
		: [];

	if (type === "slider" || isNestedSliderType(type)) return renderPhase10Widget(node, props, styles, renderContext, renderNode);
	if (PHASE10_SERVER_WIDGET_TYPES.has(type)) return renderPhase10Widget(node, props, styles, renderContext, renderNode);

	switch (type) {
		case "loop":
			return renderLoop(node, props, styles, renderContext);

		case "columns":
			return renderColumns(node, props, styles, children, renderContext);

		case "container":
		case "section":
		case "global-section":
		case "banner":
			return renderContainer(
				node,
				props,
				styles,
				children,
				renderContext,
			);

		case "heading":
			return renderHeading(
				node,
				props,
				styles,
			);

		case "navigation-menu": return renderNavigationMenu(node, props, styles);
		case "contact-form": return renderFormWidget(node, props, styles, "contact-form", renderContext);
		case "newsletter-form": return renderFormWidget(node, props, styles, "newsletter-form", renderContext);
		case "product-inquiry-form": return renderFormWidget(node, props, styles, "product-inquiry-form", renderContext);

		case "search-query-title": return renderSearchQueryTitle(node, props, styles, renderContext);
		case "search-result-count": return renderSearchResultCount(node, props, styles, renderContext);
		case "search-results-grid": return renderSearchResultsGrid(node, props, styles, renderContext);
		case "blog-title": return renderBlogTitle(node, props, styles, renderContext);
		case "blog-description": return renderBlogDescription(node, props, styles, renderContext);
		case "blog-article-grid": return renderBlogArticleGrid(node, props, styles, renderContext);
		case "article-title": return renderArticleTitle(node, props, styles, renderContext);
		case "article-featured-image": return renderArticleImage(node, props, styles, renderContext);
		case "article-content": return renderArticleContent(node, props, styles, renderContext);
		case "article-author": return renderArticleAuthor(node, props, styles, renderContext);
		case "article-date": return renderArticleDate(node, props, styles, renderContext);
		case "article-tags": return renderArticleTags(node, props, styles, renderContext);
		case "article-navigation": return renderArticleNavigation(node, props, styles, renderContext);
		case "related-articles": return renderRelatedArticles(node, props, styles, renderContext);

		case "collection-title":
			return renderCollectionTitle(
				node,
				props,
				styles,
				renderContext,
			);

		case "text":
		case "paragraph":
			return renderText(
				node,
				props,
				styles,
			);

		case "collection-description":
			return renderCollectionDescription(
				node,
				props,
				styles,
				renderContext,
			);

		case "collection-product-count":
			return renderCollectionProductCount(
				node,
				props,
				styles,
				renderContext,
			);

		case "collection-product-grid":
			return renderCollectionProductGrid(
				node,
				props,
				styles,
				renderContext,
			);

		case "product-title":
			return renderProductTitle(node, props, styles, renderContext);

		case "product-image":
			return renderProductImage(node, props, styles, renderContext);

		case "product-gallery":
			return renderProductGallery(node, props, styles, renderContext);

		case "product-price":
			return renderProductPrice(node, props, styles, renderContext, false);

		case "product-compare-price":
			return renderProductPrice(node, props, styles, renderContext, true);

		case "product-description":
			return renderProductDescription(node, props, styles, renderContext);

		case "product-vendor":
			return renderProductMeta(node, props, styles, renderContext, "vendor");

		case "product-sku":
			return renderProductMeta(node, props, styles, renderContext, "sku");

		case "product-availability":
			return renderProductAvailability(node, props, styles, renderContext);

		case "product-variant-selector":
			return renderProductVariantSelector(node, props, styles, renderContext);

		case "product-quantity":
			return renderProductQuantity(node, props, styles);

		case "product-add-to-cart":
			return renderProductAction(node, props, styles, renderContext, false);

		case "product-buy-now":
			return renderProductAction(node, props, styles, renderContext, true);

		case "product-metafield":
			return renderProductMetafield(node, props, styles, renderContext);

		case "product-recommendations":
			return renderProductRecommendations(node, props, styles, renderContext);

		case "faq":
		case "testimonials":
		case "logo-cloud":
		case "stats":
		case "team-grid":
		case "gallery-grid":
		case "marquee":
		case "tabs":
		case "product-tabs":
		case "size-guide":
		case "shipping-info":
		case "stock-progress":
		case "trust-badges":
		case "recently-viewed":
		case "related-collections":
		case "upsell-products":
		case "sticky-add-to-cart":
		case "announcement-bar":
		case "mega-menu":
		case "header-search":
		case "cart-icon":
		case "account-link":
		case "customer-name":
		case "customer-login":
		case "customer-logout":
		case "customer-orders-link":
		case "customer-addresses-link":
		case "localization-switcher":
			return renderExtendedWidget(node, props, styles, renderContext);

		case "icon":
			return renderIconWidget(node, props, styles);

		case "button":
			return renderButton(
				node,
				props,
				styles,
			);

		case "image":
			return renderImage(
				node,
				props,
				styles,
				renderContext,
			);

		case "collection-image":
			return renderCollectionImage(
				node,
				props,
				styles,
				renderContext,
			);

		case "spacer":
			return renderSpacer(
				node,
				props,
				styles,
			);

		case "divider":
			return renderDivider(
				node,
				props,
				styles,
			);

		default:
			/*
			 * Unknown wrapper element ho to
			 * uske children phir bhi render hon.
			 */
			return children
				.map((child) =>
					renderNode(
						child,
						renderContext,
					),
				)
				.join("");
	}
}

function renderNode(node, renderContext = {}) {
	if (!node || typeof node !== "object" || node.hidden === true) return "";
	if (!serverConditionMatches(node, renderContext)) return "";
	const legacyResolvedNode = applyDynamicSource(node, renderContext);
	const resolvedNode = applyDynamicBindings(legacyResolvedNode, renderContext);
	const sdkRender = renderVsnStorefrontWidget(resolvedNode, { ...renderContext, helpers: { escapeHtml, escapeAttribute } });
	let html = injectNodeBehavior(sdkRender.handled ? sdkRender.value : renderNodeCore(resolvedNode, renderContext), node);
	const link = node?.styles?.advanced?.link || {};
	const url = String(link.url || "").trim();
	if (html && url && !/^(javascript:|data:)/i.test(url) && !["button", "product-add-to-cart", "product-buy-now", "contact-form", "newsletter-form", "product-inquiry-form", "navigation-menu"].includes(node.type)) {
		const attrs = [];
		if (link.newWindow) attrs.push('target="_blank"');
		const rel = [link.nofollow ? "nofollow" : "", link.newWindow ? "noopener" : ""].filter(Boolean).join(" ");
		if (rel) attrs.push(`rel="${escapeAttribute(rel)}"`);
		for (const pair of String(link.customAttributes || "").split(",")) {
			const [rawKey, ...rest] = pair.split("|");
			const key = String(rawKey || "").trim();
			const value = rest.join("|").trim();
			if (/^(data-[a-z0-9_-]+|aria-[a-z0-9_-]+|title)$/i.test(key) && value) attrs.push(`${key}="${escapeAttribute(value)}"`);
		}
		html = `<a class="vsn-element-link" href="${escapeAttribute(url)}" ${attrs.join(" ")} style="color:inherit;text-decoration:none;display:contents;">${html}</a>`;
	}
	const template=renderContext.widgetTemplates?.[resolvedNode.type];
	if(template)try{html=applyVisualTemplateOverride(template,resolvedNode,html);}catch(error){console.error(`VSN widget template render failed (${resolvedNode.type}):`,error);}
	return html;
}

function renderProductRecommendations(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const id=product.numericId||String(product.id||"").split("/").pop(); const grid=normalizeGridProps("product-recommendations",props); const spacing=getNodeSpacing(styles); const nodeId=escapeAttribute(node.id||"");
  return `<section data-vsn-id="${nodeId}" class="vsn-product-recommendations" data-vsn-product-id="${escapeAttribute(id)}" data-vsn-limit="${grid.limit}" data-vsn-columns-desktop="${grid.columnsDesktop}" data-vsn-columns-tablet="${grid.columnsTablet}" data-vsn-columns-mobile="${grid.columnsMobile}" data-vsn-gap="${grid.gap}" data-vsn-show-image="${grid.showImage?"1":"0"}" data-vsn-show-title="${grid.showTitle?"1":"0"}" data-vsn-show-price="${grid.showPrice?"1":"0"}" data-vsn-image-ratio="${escapeAttribute(gridImageRatio(grid.imageRatio))}" data-vsn-recommendation-intent="related" style="margin:${spacing.margin};padding:${spacing.padding};"><h2 style="margin:0 0 18px;font-size:24px;">${escapeHtml(props.heading||"You may also like")}</h2><div class="vsn-product-recommendations-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;"><div style="color:#777;font-size:14px;">Loading recommendations…</div></div></section>`;
}

function renderColumns(node, props, styles, children, renderContext) {
	const columns = normalizeColumnsProps({ ...props, columns: props.columns || styles.columns }, children.length).columns;
	const gap = toCssSize(styles.gap || styles.grid?.gap, "24px");
	const spacing = getNodeSpacing(styles);
	const content = children.map((child, index) => `<div class="vsn-column-cell" data-vsn-column-cell="1" data-vsn-column-index="${index}" style="min-width:0;align-self:stretch;">${renderNode(child, renderContext)}</div>`).join("");
	return `<style>${columnsResponsiveCss(node.id || "", props, children.length)}</style><div class="vsn-columns" data-vsn-id="${escapeAttribute(node.id || "")}" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gap};width:100%;margin:${spacing.margin};padding:${spacing.padding};">${content}</div>`;
}

function renderContainer(
	node,
	props,
	styles,
	children,
	renderContext = {},
) {
	const style =
		normalizeNodeStyles(styles);

	const safeChildren =
		Array.isArray(children)
			? children
			: [];

	const direction = allowedValue(
		style.direction ||
		style.flexDirection,
		["row", "column"],
		"column",
	);

	const alignItems = allowedValue(
		style.alignItems,
		[
			"stretch",
			"flex-start",
			"center",
			"flex-end",
		],
		"stretch",
	);

	const justifyContent = allowedValue(
		style.justifyContent,
		[
			"flex-start",
			"center",
			"flex-end",
			"space-between",
			"space-around",
			"space-evenly",
		],
		"flex-start",
	);

	const gap = safeNumber(
		style.gap,
		0,
	);

	// buildNodeStyle() already flattens the current styles.size contract and legacy flat sizing.
	const width = cssSize(style.width, "100%");
	const height = cssSize(style.height, "auto"); // eslint-disable-line no-unused-vars -- asserted by v2.5.69 UI/runtime audit

	const minHeight = cssSize(
		style.minHeight,
		"auto",
	);

	const backgroundColor = safeColor(
		style.backgroundColor,
		"transparent",
	);
	const backgroundImage = style.backgroundImage
		? escapeAttribute(style.backgroundImage)
		: "none";

	/*
	 * New nested spacing format ko support karta hai.
	 */
	const individualSpacing =
		individualSpacingCss(style);

	const childHtml = safeChildren
		.map((child) =>
			renderNode(
				child,
				renderContext,
			),
		)
		.join("");

	return `
    <div
      class="vsn-container"
      data-vsn-id="${escapeAttribute(
		node.id || "",
	)}"
      style="
        flex-direction: ${direction};
        align-items: ${alignItems};
        justify-content: ${justifyContent};
        gap: ${gap}px;
        width: ${width};
        min-height: ${minHeight};
        background-color: ${backgroundColor};
        background-image: ${backgroundImage};
        padding: ${individualSpacing.padding};
        margin: ${individualSpacing.margin};
      "
    >
      ${childHtml}
    </div>
  `;
}

function renderCollectionProductCount(
	node,
	props,
	styles,
	renderContext,
) {
	const style =
		normalizeNodeStyles(styles);

	const collection =
		renderContext.collection;

	const count = Number(
		collection?.productCount || 0,
	);

	const singularText =
		props.singularText || "product";

	const pluralText =
		props.pluralText || "products";

	const label =
		count === 1
			? singularText
			: pluralText;

	const prefix =
		props.prefix || "";

	const color = safeColor(
		style.color,
		"#666666",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		16,
	);

	const fontWeight = allowedValue(
		String(
			style.fontWeight || "400",
		),
		[
			"100",
			"200",
			"300",
			"400",
			"500",
			"600",
			"700",
			"800",
			"900",
		],
		"400",
	);

	const textAlign = allowedValue(
		style.textAlign,
		[
			"left",
			"center",
			"right",
			"justify",
		],
		"left",
	);

	const lineHeight = cssSize(
		style.lineHeight,
		"1.4",
	);

	const spacing =
		individualSpacingCss(style);

	return `
    <div
      class="vsn-text vsn-collection-product-count"
      data-vsn-id="${escapeAttribute(
		node.id || "",
	)}"
      data-vsn-dynamic="collection-product-count"
      style="
        color: ${color};
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        line-height: ${lineHeight};
        text-align: ${textAlign};
        margin: ${spacing.margin};
        padding: ${spacing.padding};
      "
    >
      ${escapeHtml(prefix)}
      ${count}
      ${escapeHtml(label)}
    </div>
  `;
}

function renderHeading(
	node,
	props,
	styles,
) {
	const content = props;
	const style =
		normalizeNodeStyles(styles);

	const tag = allowedValue(
		content.tag,
		[
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"div",
			"span",
			"p",
		],
		"h2",
	);

	const text =
		content.text ||
		"Heading";

	const color = safeColor(
		style.color ||
		style.textColor,
		"#1a1a1a",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		32,
	);

	const fontWeight = allowedValue(
		String(style.fontWeight || "700"),
		[
			"100",
			"200",
			"300",
			"400",
			"500",
			"600",
			"700",
			"800",
			"900",
		],
		"700",
	);

	const textAlign = allowedValue(
		style.textAlign,
		[
			"left",
			"center",
			"right",
			"justify",
		],
		"left",
	);

	const lineHeight = cssSize(
		style.lineHeight,
		"1.2",
	);

	const margin = spacingCss(
		style.margin,
		0,
	);

	return `
    <${tag}
      class="vsn-heading"
      data-vsn-id="${escapeAttribute(node.id || "")}"
      style="
        color: ${color};
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        font-family: ${escapeAttribute(style.fontFamily || "inherit")};
        text-align: ${textAlign};
        line-height: ${lineHeight};
        letter-spacing: ${cssSize(style.letterSpacing, "0px")};
        word-spacing: ${cssSize(style.wordSpacing, "0px")};
        text-transform: ${allowedValue(style.textTransform, ["none","uppercase","lowercase","capitalize"], "none")};
        margin: ${margin};
      "
    >
      ${escapeHtml(text)}
    </${tag}>
  `;
}

function renderCollectionTitle(
	node,
	props,
	styles,
	renderContext,
) {
	const style =
		normalizeNodeStyles(styles);

	const collection =
		renderContext.collection;

	const tag = allowedValue(
		props.tag,
		[
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"div",
			"span",
			"p",
		],
		"h1",
	);

	const text =
		collection?.title ||
		props.fallbackText ||
		"Collection Title";

	const color = safeColor(
		style.color,
		"#1a1a1a",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		42,
	);

	const fontWeight = allowedValue(
		String(
			style.fontWeight || "700",
		),
		[
			"100",
			"200",
			"300",
			"400",
			"500",
			"600",
			"700",
			"800",
			"900",
		],
		"700",
	);

	const textAlign = allowedValue(
		style.textAlign,
		[
			"left",
			"center",
			"right",
			"justify",
		],
		"left",
	);

	const lineHeight = cssSize(
		style.lineHeight,
		"1.2",
	);

	const spacing =
		individualSpacingCss(style);

	return `
    <${tag}
      class="vsn-heading vsn-collection-title"
      data-vsn-id="${escapeAttribute(
		node.id || "",
	)}"
      data-vsn-dynamic="collection-title"
      style="
        color: ${color};
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        line-height: ${lineHeight};
        text-align: ${textAlign};
        margin: ${spacing.margin};
        padding: ${spacing.padding};
      "
    >
      ${escapeHtml(text)}
    </${tag}>
  `;
}

function renderText(
	node,
	props,
	styles,
) {
	const content = props;
	const style =
		normalizeNodeStyles(styles);

	const text =
		content.text || "";

	const color = safeColor(
		style.color ||
		style.textColor,
		"#4a4a4a",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		16,
	);

	const lineHeight = cssSize(
		style.lineHeight,
		"1.6",
	);

	const textAlign = allowedValue(
		style.textAlign,
		[
			"left",
			"center",
			"right",
			"justify",
		],
		"left",
	);

	const margin = spacingCss(
		style.margin,
		0,
	);

	return `
    <p
      class="vsn-text"
      data-vsn-id="${escapeAttribute(node.id || "")}"
      style="
        color: ${color};
        font-size: ${fontSize};
        line-height: ${lineHeight};
        text-align: ${textAlign};
        margin: ${margin};
      "
    >
      ${escapeHtml(text)}
    </p>
  `;
}

function renderCollectionDescription(
	node,
	props,
	styles,
	renderContext,
) {
	const style =
		normalizeNodeStyles(styles);

	const collection =
		renderContext.collection;

	const text =
		collection?.description ||
		props.fallbackText ||
		"";

	/*
	 * Description empty ho to
	 * blank paragraph output nahi hoga.
	 */
	if (!text) {
		return "";
	}

	const color = safeColor(
		style.color,
		"#4a4a4a",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		16,
	);

	const lineHeight = cssSize(
		style.lineHeight,
		"1.6",
	);

	const textAlign = allowedValue(
		style.textAlign,
		[
			"left",
			"center",
			"right",
			"justify",
		],
		"left",
	);

	const spacing =
		individualSpacingCss(style);

	return `
    <div
      class="vsn-text vsn-collection-description"
      data-vsn-id="${escapeAttribute(
		node.id || "",
	)}"
      data-vsn-dynamic="collection-description"
      style="
        color: ${color};
        font-size: ${fontSize};
        line-height: ${lineHeight};
        text-align: ${textAlign};
        white-space: pre-wrap;
        margin: ${spacing.margin};
        padding: ${spacing.padding};
      "
    >${escapeHtml(text)}</div>
  `;
}

function renderButton(
	node,
	props,
	styles,
) {
	const content = props;
	const style =
		normalizeNodeStyles(styles);

	const text =
		content.text ||
		"Button";

	const rawUrl =
		content.url ||
		"#";

	const url = safeUrl(rawUrl);

	const backgroundColor = safeColor(
		style.backgroundColor,
		"#008060",
	);

	const color = safeColor(
		style.color ||
		style.textColor,
		"#ffffff",
	);

	const fontSize = responsiveValue(
		style.fontSize,
		14,
	);

	const borderRadius = cssSize(
		style.borderRadius,
		"8px",
	);

	const padding = spacingCss(
		style.padding,
		{
			top: 12,
			right: 20,
			bottom: 12,
			left: 20,
		},
	);

	return `
    <a
      class="vsn-button"
      data-vsn-id="${escapeAttribute(node.id || "")}"
      href="${escapeAttribute(url)}"
      style="
        background-color: ${backgroundColor};
        color: ${color};
        font-size: ${fontSize};
        border-radius: ${borderRadius};
        padding: ${padding};
      "
    >
      ${escapeHtml(text)}
    </a>
  `;
}

function renderImage(
	node,
	props,
	styles,
	renderContext = {},
) {
	const content = normalizeImageWidgetProps(props || {});
	const style = normalizeNodeStyles(styles);
	const media = content.media && typeof content.media === "object" ? content.media : {};
	const originalSource = resolveImageSource(content, styles?.advanced || {});
	const source = buildImageRenderUrl(originalSource, content, media);

	if (!source) return "";

	const legacyDimensions = styles?.advanced?.imageDimensions || {};
	const legacyUnit = legacyDimensions.unit === "auto" ? "" : (legacyDimensions.unit || "px");
	const width = legacyDimensions.width
		? `${legacyDimensions.width}${legacyUnit}`
		: cssSize(style.width, "100%");
	const height = legacyDimensions.height
		? `${legacyDimensions.height}${legacyUnit}`
		: cssSize(style.height, "auto");
	const borderRadius = cssSize(style.borderRadius, "0px");
	const objectFit = allowedValue(
		legacyDimensions.fit || style.objectFit,
		["cover", "contain", "fill", "scale-down", "none"],
		"cover",
	);
	const objectPosition = String(legacyDimensions.position || style.objectPosition || "center center");
	const intrinsic = imageResolutionDimensions(content, media);
	const alt = imageAltText(content, media);
	const caption = imageCaptionText(content, media);
	const href = imageLinkHref(content, originalSource);
	const fetchPriority = allowedValue(content.fetchPriority, ["auto", "high", "low"], "auto");
	const loading = content.loading === "eager" ? "eager" : "lazy";
	const intrinsicAttrs = `${intrinsic.width ? ` width="${escapeAttribute(intrinsic.width)}"` : ""}${intrinsic.height ? ` height="${escapeAttribute(intrinsic.height)}"` : ""}`;
	let responsiveAttrs = "";
	if (renderContext?.enterpriseSettings?.responsiveImages !== false && isShopifyHostedImageUrl(originalSource)) {
		const widths = [320, 480, 640, 800, 1024, 1280, 1600, 2048];
		const srcset = widths.map((item)=>`${buildImageRenderUrl(originalSource, { ...content, resolution:String(item) }, media)} ${item}w`).filter((item)=>!item.startsWith(" ")).join(", ");
		if (srcset) responsiveAttrs = ` srcset="${escapeAttribute(srcset)}" sizes="${escapeAttribute(content.sizes || "(max-width: 749px) 100vw, 50vw")}"`;
	}

	const imageHtml = `<img data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-image-widget" src="${escapeAttribute(safeUrl(source))}" alt="${escapeAttribute(alt)}" loading="${renderContext?.enterpriseSettings?.lazyImages === false ? (content.loading === "eager" ? "eager" : "auto") : loading}" fetchpriority="${fetchPriority}" decoding="async"${intrinsicAttrs}${responsiveAttrs} style="display:block;width:${width};height:${height};border-radius:${borderRadius};object-fit:${objectFit};object-position:${escapeAttribute(objectPosition)};">`;

	let visual = imageHtml;
	if (href) {
		const lightbox = content.lightbox === true && content.linkType === "media";
		const target = content.openNewTab === true && !lightbox ? ' target="_blank" rel="noopener noreferrer"' : "";
		const lightboxAttrs = lightbox ? ` data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(safeUrl(originalSource))}" data-vsn-lightbox-alt="${escapeAttribute(alt)}"` : "";
		visual = `<a class="vsn-image-link" href="${escapeAttribute(safeUrl(href))}"${target}${lightboxAttrs} style="display:inline-block;max-width:100%;">${imageHtml}</a>`;
	}

	if (!caption) return visual;
	return `<figure class="vsn-image-figure" style="margin:0;">${visual}<figcaption class="vsn-image-caption" style="margin-top:8px;font-size:13px;color:#6d7175;">${escapeHtml(caption)}</figcaption></figure>`;
}

function renderCollectionImage(node, props, styles, renderContext) {
  const style=normalizeNodeStyles(styles); const collection=renderContext?.collection||{}; const media=collection.image||{}; const settings=normalizeContextImageProps(props); const source=contextImageUrl(media,settings) || "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f1f1f1'/%3E%3C/svg%3E"; const alt=contextImageAlt(media,settings,collection.title||"Collection image");
  const width=cssSize(style.width,"100%"); const height=cssSize(style.height,"420px"); const borderRadius=cssSize(style.borderRadius,"0px"); const objectFit=allowedValue(style.objectFit,["cover","contain","fill","none","scale-down"],"cover"); const spacing=individualSpacingCss(style);
  const image=`<img class="vsn-collection-image" data-vsn-id="${escapeAttribute(node.id||"")}" data-vsn-dynamic="collection-image" src="${escapeAttribute(safeUrl(source))}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" style="display:block;width:${width};height:${height};object-fit:${objectFit};border-radius:${borderRadius};margin:${spacing.margin};">`;
  return settings.lightbox?`<a href="${escapeAttribute(media.url||source)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url||source)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${image}</a>`:image;
}

function renderSpacer(
	node,
	props,
	styles,
) {
	const style =
		normalizeNodeStyles(styles);

	const height = cssSize(
		props.height ||
		style.height,
		"30px",
	);

	return `
    <div
      data-vsn-id="${escapeAttribute(node.id || "")}"
      style="height: ${height};"
      aria-hidden="true"
    ></div>
  `;
}

function renderDivider(
	node,
	props,
	styles,
) {
	const style =
		normalizeNodeStyles(styles);

	const color = safeColor(
		style.color,
		"#e3e3e3",
	);

	const thickness = cssSize(
		style.thickness,
		"1px",
	);

	const margin = spacingCss(
		style.margin,
		{
			top: 16,
			right: 0,
			bottom: 16,
			left: 0,
		},
	);

	return `
    <hr
      data-vsn-id="${escapeAttribute(node.id || "")}"
      style="
        border: 0;
        border-top: ${thickness} solid ${color};
        margin: ${margin};
      "
    >
  `;
}

function renderMessageFragment(message) {
	return `
    <div
      class="vsn-builder-message"
      role="status"
      style="
        width: 100%;
        padding: 32px 20px;
        text-align: center;
        border: 1px solid #e3e3e3;
        border-radius: 8px;
        background: #ffffff;
        color: #1a1a1a;
      "
    >
      ${escapeHtml(message)}
    </div>
  `;
}

function renderMessagePage(message) {
	return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

        <title>VSN Builder</title>

        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family:
              system-ui,
              -apple-system,
              sans-serif;
            background: #f6f6f7;
            color: #1a1a1a;
          }

          .message {
            padding: 32px;
            border: 1px solid #e3e3e3;
            border-radius: 12px;
            background: #ffffff;
          }
        </style>
      </head>

      <body>
        <div class="message">
          ${escapeHtml(message)}
        </div>
      </body>
    </html>
  `;
}
