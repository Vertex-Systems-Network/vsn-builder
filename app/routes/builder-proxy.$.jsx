import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { createHmac } from "node:crypto";
import { detectSpam } from "../utils/security.server.js";
import { buildNodeStyle } from "../builder/styleEngine.js";
import { buildStyleBundleCss } from "../builder/stylePipeline.js";
import { collectCustomJsGroups, validateCustomJs } from "../builder/customCode.js";
import { FALLBACK_GOOGLE_FONTS } from "../data/font-catalog.js";
import { buildGoogleFontHref, collectFontUsages, mergeFontUsage, SYSTEM_FONT_FAMILIES } from "../utils/font-runtime.js";
import { normalizeImageWidgetProps, resolveImageSource, buildImageRenderUrl, imageResolutionDimensions, imageAltText, imageCaptionText, imageLinkHref, isShopifyHostedImageUrl } from "../builder/imageWidget.js";
import { normalizeGalleryWidgetProps, galleryAspectRatio } from "../builder/galleryWidget.js";
import { normalizeVideoWidgetProps, videoEmbedUrl } from "../builder/videoWidget.js";
import { normalizeSliderProps } from "../builder/sliderWidget.js";
import { isNestedSliderType, normalizeNestedSliderProps } from "../builder/nestedCarouselWidget.js";
import { normalizeStructuredItems } from "../builder/structuredItems.js";
import { applyDynamicBindings, normalizeBindings } from "../builder/dynamicBindings.js";
import { evaluateCommerceConditionRule } from "../builder/commerceConditions.js";
import { normalizeContextImageProps, contextImageUrl, contextImageAlt } from "../builder/contextMediaWidget.js";
import { normalizeGridProps, gridImageRatio } from "../builder/dataGridWidget.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { normalizeQueryDefinition } from "../builder/queryBuilder.js";
import { runShopifyLoopQuery } from "../services/query-engine.server.js";
import { resolveComponentInstance } from "../builder/componentSystem.js";
import { normalizeElementInteractions } from "../builder/interactionSchema.js";
import { CAMPAIGN_TEMPLATE_TYPES, normalizeCampaignSettings, campaignScheduleState, campaignMatchesContext } from "../builder/campaignSystem.js";
import { resolveExperimentRender, recordExperimentEvent } from "../services/experiment-engine.server.js";
import { resolveLocalizedPage } from "../services/localization.server.js";
import { getServerFeatureFlags } from "../services/feature-flags.server.js";
import { loadGoogleMapsApiKey, loadGoogleCaptchaSettings } from "../services/google-platform.server.js";
import { handleStorefrontFormSubmission, loadRenderFormConfigs } from "../services/storefront-form-submission.server.js";
import { renderVsnStorefrontWidget } from "../sdk/runtime.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { parseEnterpriseSettings } from "../services/enterprise-hardening.server.js";
import { trackStorefrontVisitorRequest } from "../services/visitor-analytics.server.js";
import { loadStorefrontWidgetPlatform } from "../services/widget-studio.server.js";
import { applyVisualTemplateOverride } from "../builder/visualTemplate.js";
import { serveGlobalCodeRuntime } from "../services/global-code-runtime.server.js";
import { handleWishlistProxyAction, handleWishlistProxyLoader, proxyWishlistCustomer } from "../services/wishlist-proxy.server.js";
import {
	clampProductPageSize,
	findCollectionProductPageSize,
	findCollectionProductSort,
	getAllProductsSortConfig,
	getCollectionSortConfig,
	isPriceSort,
	normalizeProductSort,
	sortProductsByPrice,
	buildPriceSortPage,
} from "../storefront/productPagination.js";
ensureBuiltinSdkPlugins();
const TEMPLATE_CACHE = new Map();
const TEMPLATE_CACHE_TTL = 15_000;
function cacheGet(key) { const item = TEMPLATE_CACHE.get(key); if (!item) return null; if (Date.now() - item.at > TEMPLATE_CACHE_TTL) { TEMPLATE_CACHE.delete(key); return null; } return item.value; }
function cacheSet(key, value) { if (TEMPLATE_CACHE.size > 250) TEMPLATE_CACHE.clear(); TEMPLATE_CACHE.set(key, { at: Date.now(), value }); return value; }
export async function action({ request }) {
	const { session } = await authenticate.public.appProxy(request);
	if (!session?.shop) return jsonResponse({ ok: false, error: "Invalid storefront request." }, 401);

	try {
		const formData = await request.formData();
		const proxyUrl = new URL(request.url);
		const wishlistAction=await handleWishlistProxyAction({db,session,formData,url:proxyUrl}); if(wishlistAction)return wishlistAction;
		const isFormSubmission = proxyUrl.searchParams.get("formSubmit") === "1" || formData.has("formKey") || formData.has("formType");
		if (getServerFeatureFlags().formsAutomationV2 === true && isFormSubmission && String(formData.get("_vsnAction") || "") !== "experiment-event") return handleStorefrontFormSubmission(request, session, formData);
		if (String(formData.get("_vsnAction") || "") === "experiment-event") {
			const eventType = String(formData.get("eventType") || "").trim();
			if (eventType === "purchase") return jsonResponse({ ok:false, error:"Purchase events are server-attributed." }, 400);
			let metadata = null; try { metadata = JSON.parse(String(formData.get("metadata") || "null")); } catch {}
			const result = await recordExperimentEvent({
				db, shop:session.shop, experimentId:String(formData.get("experimentId") || ""), variantId:String(formData.get("variantId") || ""),
				visitorId:String(formData.get("visitorId") || ""), sessionId:String(formData.get("sessionId") || ""), eventType,
				eventName:String(formData.get("eventName") || ""), value:formData.get("value"), metadata, dedupeKey:String(formData.get("eventId") || "") || null,
			});
			return jsonResponse({ ok:result.success, duplicate:Boolean(result.duplicate), error:result.error || null }, result.success ? 200 : 400);
		}
		const honeypot = String(formData.get("website") || "").trim();
		if (honeypot) return jsonResponse({ ok: true });

		const formType = String(formData.get("formType") || formData.get("formKey") || "contact").trim().slice(0, 80);
		const pageUrl = String(formData.get("pageUrl") || "").trim().slice(0, 1500);
		const productHandle = String(formData.get("productHandle") || "").trim().slice(0, 255);
		const fields = {};
		let customerEmail = "";

		for (const [rawKey, rawValue] of formData.entries()) {
			const key = String(rawKey || "").trim().slice(0, 120);
			if (!key || ["website", "pageUrl", "productHandle", "formType", "formKey"].includes(key)) continue;
			if (typeof rawValue === "string") {
				const value = rawValue.trim().slice(0, 10000);
				if (fields[key] === undefined) fields[key] = value;
				else fields[key] = Array.isArray(fields[key]) ? [...fields[key], value] : [fields[key], value];
				if (!customerEmail && /email/i.test(key) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) customerEmail = value.toLowerCase();
			} else if (rawValue && typeof rawValue === "object") {
				fields[key] = {
					name: String(rawValue.name || "").slice(0, 255),
					type: String(rawValue.type || "application/octet-stream").slice(0, 120),
					size: Number(rawValue.size || 0),
				};
			}
		}

		if (formType === "newsletter") {
			const email = String(fields.email || "").trim();
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ ok: false, error: "Enter a valid email address." }, 200);
		}

		const spamReason = detectSpam(fields);
		const created = await db.builderFormSubmission.create({
			data: {
				shop: session.shop,
				formKey: formType || "contact",
				pageUrl: pageUrl || null,
				productHandle: productHandle || null,
				customerEmail: customerEmail || (typeof fields.email === "string" ? fields.email.slice(0, 254) : null),
				fieldsJson: JSON.stringify(fields),
				isSpam: Boolean(spamReason),
				spamReason: spamReason || null,
			},
		});

		if (!spamReason) {
			const endpoints = await db.builderWebhookEndpoint.findMany({ where: { shop: session.shop, enabled: true } });
			const payload = JSON.stringify({ id: created.id, shop: session.shop, formKey: created.formKey, pageUrl, productHandle, customerEmail: created.customerEmail, fields, createdAt: created.createdAt });
			await Promise.allSettled(endpoints.filter((endpoint) => endpoint.formKey === "*" || endpoint.formKey === created.formKey).map(async (endpoint) => {
				const signature = endpoint.secret ? createHmac("sha256", endpoint.secret).update(payload).digest("hex") : "";
				const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
				try { await fetch(endpoint.url, { method: "POST", headers: { "content-type": "application/json", ...(signature ? { "x-vsn-signature": signature } : {}) }, body: payload, signal: controller.signal }); } finally { clearTimeout(timer); }
			}));
		}

		return jsonResponse({ ok: true, id: created.id });
	} catch (error) {
		console.error("VSN form submission failed:", error);
		return jsonResponse({ ok: false, error: "The form could not be submitted right now." }, 200);
	}
}

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
			let tokens = {}; try { tokens = JSON.parse(shopSetting?.designTokensJson || "{}"); } catch {}
			const campaigns = []; const byId = new Map(pages.map((item)=>[String(item.id),item])); const included = new Set();
			let customFonts = []; try { customFonts = await db.builderCustomFont.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id:true, family:true, weight:true, style:true, mimeType:true } }); } catch {}
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
				let conditions = {}; try { conditions = JSON.parse(rule.conditionsJson || "{}"); } catch {}
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

	return htmlResponse(html, 200);
}

function collectDynamicMetaobjectBindings(elements = []) {
	const out = [];
	const walk = (nodes = []) => {
		for (const node of Array.isArray(nodes) ? nodes : []) {
			const d = node?.dynamicSource;
			if (d?.enabled && d.source === "metaobject.field" && d.key && d.metaobjectId) {
				const signature = `${d.metaobjectType || ""}|${d.metaobjectId}|${d.key}`;
				if (!out.some((item) => item.signature === signature)) out.push({ signature, type: String(d.metaobjectType || ""), idOrHandle: String(d.metaobjectId || ""), key: String(d.key || "") });
			}
			for (const binding of Object.values(normalizeBindings(node?.bindings))) {
				if (binding?.enabled && binding.source === "metaobject.field" && binding.key && binding.metaobjectId) {
					const signature = `${binding.metaobjectType || ""}|${binding.metaobjectId}|${binding.key}`;
					if (!out.some((item) => item.signature === signature)) out.push({ signature, type: String(binding.metaobjectType || ""), idOrHandle: String(binding.metaobjectId || ""), key: String(binding.key || "") });
				}
			}
			walk(node?.children || []);
		}
	};
	walk(elements);
	return out.slice(0, 30);
}

async function loadDynamicMetaobjects({ admin, elements = [] }) {
	const bindings = collectDynamicMetaobjectBindings(elements);
	const values = {};
	for (const binding of bindings) {
		try {
			const isGid = binding.idOrHandle.startsWith("gid://");
			const query = isGid ? `#graphql\nquery VsnMetaobjectById($id: ID!){ metaobject(id:$id){ id handle type fields { key value } } }` : `#graphql\nquery VsnMetaobjectByHandle($handle: MetaobjectHandleInput!){ metaobjectByHandle(handle:$handle){ id handle type fields { key value } } }`;
			const variables = isGid ? { id: binding.idOrHandle } : { handle: { type: binding.type, handle: binding.idOrHandle } };
			if (!isGid && !binding.type) continue;
			const response = await admin.graphql(query, { variables });
			const json = await response.json();
			const object = json.data?.metaobject || json.data?.metaobjectByHandle;
			const field = object?.fields?.find((item) => item.key === binding.key);
			if (field?.value != null) values[binding.signature] = field.value;
		} catch (error) {
			console.warn("VSN dynamic metaobject lookup failed", binding.signature, error?.message || error);
		}
	}
	return values;
}

function collectWidgetGridRequests(elements = []) {
  const requests = [];
  const types = new Set(["product-grid","product-card","collection-grid","product-recommendations","recently-viewed","upsell-products"]);
  const walk = (nodes=[]) => {
    for (const node of Array.isArray(nodes)?nodes:[]) {
      if (types.has(node?.type)) requests.push({ id:String(node.id||""), type:node.type, props:normalizeGridProps(node.type,node.props||{}) });
      walk(node?.children||[]);
    }
  };
  walk(elements);
  return requests.slice(0,40);
}

async function loadWidgetGridData({ admin, elements = [], collectionData = null, searchData = null }) {
  const requests = collectWidgetGridRequests(elements);
  const result = {};
  if (!admin || !requests.length) return result;
  const productRequests = requests.filter((item)=>item.type!=="collection-grid");
  const collectionRequests = requests.filter((item)=>item.type==="collection-grid");
  const productCache = new Map();
  for (const item of productRequests) {
    if (item.type === "recently-viewed" || item.type === "product-recommendations" || item.type === "upsell-products") { result[item.id] = []; continue; }
    if (item.type === "product-grid" && item.props.source === "current-collection" && Array.isArray(collectionData?.products)) { result[item.id] = collectionData.products.slice(0,item.props.limit); continue; }
    if (item.type === "product-grid" && item.props.source === "search-context" && Array.isArray(searchData?.items)) { result[item.id] = searchData.items.filter((entry)=>String(entry?.type||"").toLowerCase()==="product" || entry?.productType || entry?.price).slice(0,item.props.limit); continue; }
    const query = String(item.props.query||"").trim();
    const key = `${query}|${item.props.limit}`;
    if (!productCache.has(key)) {
      try {
        const response = await admin.graphql(`#graphql
          query VsnWidgetProducts($first:Int!,$query:String){
            products(first:$first,query:$query){nodes{
              id title handle vendor productType createdAt
              featuredImage{url altText width height}
              priceRangeV2{minVariantPrice{amount currencyCode}}
              compareAtPriceRange{minVariantCompareAtPrice{amount currencyCode}}
              variants(first:10){nodes{availableForSale}}
            }}
          }`, { variables:{ first:Math.min(50,item.props.limit), query:query||null } });
        const json = await response.json();
        const nodes = Array.isArray(json.data?.products?.nodes) ? json.data.products.nodes.map(mapProductNode) : [];
        productCache.set(key,nodes);
      } catch (error) { console.warn("VSN widget product query failed", error?.message||error); productCache.set(key,[]); }
    }
    let nodes=[...(productCache.get(key)||[])];
    if (item.props.sortBy === "title-asc") nodes.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
    if (item.props.sortBy === "title-desc") nodes.sort((a,b)=>String(b.title||"").localeCompare(String(a.title||"")));
    if (item.props.sortBy === "price-asc" || item.props.sortBy === "price-desc") {
      const amount=(p)=>Number(p?.price?.amount ?? p?.priceRangeV2?.minVariantPrice?.amount ?? 0);
      nodes.sort((a,b)=>item.props.sortBy==="price-asc"?amount(a)-amount(b):amount(b)-amount(a));
    }
    if (item.props.sortBy === "newest") nodes.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    result[item.id]=nodes.slice(0,item.props.limit);
  }
  const collectionCache = new Map();
  for (const item of collectionRequests) {
    const query=String(item.props.query||"").trim(); const key=`${query}|${item.props.limit}`;
    if(!collectionCache.has(key)){
      try{
        const response=await admin.graphql(`#graphql
          query VsnWidgetCollections($first:Int!,$query:String){
            collections(first:$first,query:$query){nodes{id title handle description image{url altText width height} productsCount{count}}}
          }`,{variables:{first:Math.min(50,item.props.limit),query:query||null}});
        const json=await response.json(); collectionCache.set(key,Array.isArray(json.data?.collections?.nodes)?json.data.collections.nodes:[]);
      }catch(error){console.warn("VSN widget collection query failed",error?.message||error);collectionCache.set(key,[]);}
    }
    let nodes=[...(collectionCache.get(key)||[])];
    if(item.props.sortBy==="title-asc")nodes.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
    if(item.props.sortBy==="title-desc")nodes.sort((a,b)=>String(b.title||"").localeCompare(String(a.title||"")));
    result[item.id]=nodes.slice(0,item.props.limit);
  }
  return result;
}

async function getCollectionByHandle({
	admin,
	handle,
	pageSize = 8,
	sortBy = "featured",
}) {
	/*
	 * Admin API available na ho,
	 * to app crash nahi karegi.
	 */
	if (!admin || !handle) {
		return null;
	}

	try {
		const response = await admin.graphql(
			`#graphql
        query GetBuilderCollection(
          $query: String!
          $first: Int!
          $sortKey: ProductCollectionSortKeys!
          $reverse: Boolean!
        ) {
          collections(
            first: 1
            query: $query
          ) {
            nodes {
				id
				title
				handle
				description

				productsCount {
					count
				}

				image {
					url
					altText
					width
					height
				}

				products(
					first: $first
					sortKey: $sortKey
					reverse: $reverse
				) {
					nodes {
					id
					title
					handle
						vendor
						productType

					variants(first: 20) {
						nodes {
							availableForSale
						}
					}
					featuredImage {
						url
						altText
						width
						height
					}

					priceRangeV2 {
						minVariantPrice {
						amount
						currencyCode
						}
					}

					compareAtPriceRange {
						minVariantCompareAtPrice {
						amount
						currencyCode
						}
					}
					}
					
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
          }
        }
      `,
			{
				variables: {
					query: `handle:${handle}`,
					first: clampProductPageSize(
						pageSize,
						8,
					),
					...getCollectionSortConfig(sortBy),
				},
			},
		);

		const result =
			await response.json();

		if (result.errors?.length) {
			console.error(
				"Collection GraphQL errors:",
				result.errors,
			);

			return null;
		}

		const collection =
			result.data?.collections
				?.nodes?.[0];

		if (!collection) {
			return null;
		}

		return {
			id: collection.id,
			title:
				collection.title || "",
			handle:
				collection.handle || handle,
			description:
				collection.description || "",
			productCount:
				Number(
					collection.productsCount?.count || 0,
				),
			products: Array.isArray(
				collection.products?.nodes,
			)
				? collection.products.nodes.map(
					mapProductNode,
				)
				: [],
			pageInfo: {
				hasNextPage:
					collection.products
						?.pageInfo
						?.hasNextPage === true,

				endCursor:
					collection.products
						?.pageInfo
						?.endCursor || null,
			},
			image: collection.image
				? {
					url:
						collection.image.url ||
						"",
					altText:
						collection.image.altText ||
						collection.title ||
						"Collection image",
					width:
						collection.image.width ||
						null,
					height:
						collection.image.height ||
						null,
				}
				: null,
		};
	} catch (error) {
		console.error(
			"Failed to fetch collection:",
			error,
		);

		return null;
	}
}

async function getCollectionProductsPage({
	admin,
	handle,
	afterCursor = null,
	pageSize = 8,
	sortBy = "featured",
}) {
	if (!admin || !handle) {
		return null;
	}

	try {
		const response =
			await admin.graphql(
				`#graphql
					query GetBuilderCollectionProductsPage(
						$query: String!
						$after: String
						$first: Int!
						$sortKey: ProductCollectionSortKeys!
						$reverse: Boolean!
					) {
						collections(
							first: 1
							query: $query
						) {
							nodes {
								products(
									first: $first
									after: $after
									sortKey: $sortKey
									reverse: $reverse
								) {
									nodes {
										id
										title
										handle
						vendor
						productType

										featuredImage {
											url
											altText
											width
											height
										}

										priceRangeV2 {
											minVariantPrice {
												amount
												currencyCode
											}
										}

										compareAtPriceRange {
											minVariantCompareAtPrice {
												amount
												currencyCode
											}
										}

										variants(first: 20) {
											nodes {
												availableForSale
											}
										}
									}

									pageInfo {
										hasNextPage
										endCursor
									}
								}
							}
						}
					}
				`,
				{
					variables: {
						query:
							`handle:${handle}`,

						after:
							afterCursor || null,

						first: clampProductPageSize(
							pageSize,
							8,
						),

						...getCollectionSortConfig(sortBy),
					},
				},
			);

		const result =
			await response.json();

		if (result.errors?.length) {
			console.error(
				"Collection pagination errors:",
				JSON.stringify(
					result.errors,
					null,
					2,
				),
			);

			return null;
		}

		const connection =
			result.data?.collections
				?.nodes?.[0]
				?.products;

		const nodes =
			Array.isArray(connection?.nodes)
				? connection.nodes
				: [];

		return {
			products:
				nodes.map(mapProductNode),

			pageInfo: {
				hasNextPage:
					connection?.pageInfo
						?.hasNextPage === true,

				endCursor:
					connection?.pageInfo
						?.endCursor || null,
			},
		};
	} catch (error) {
		console.error(
			"Collection pagination failed:",
			error?.message || error,
		);

		return null;
	}
}

function mapProductNode(product) {
	const variants =
		Array.isArray(
			product?.variants?.nodes,
		)
			? product.variants.nodes
			: [];

	const availableForSale =
		variants.some(
			(variant) =>
				variant?.availableForSale ===
				true,
		);

	return {
		id:
			product?.id || "",

		title:
			product?.title || "",

		handle:
			product?.handle || "",

		url:
			product?.handle
				? `/products/${product.handle}`
				: "#",

		availableForSale,

		vendor:
			product?.vendor || "",

		productType:
			product?.productType || "",

		createdAt: product?.createdAt || "",

		image:
			product?.featuredImage
				? {
					url:
						product.featuredImage
							.url || "",

					altText:
						product.featuredImage
							.altText ||
						product.title ||
						"Product image",

					width:
						product.featuredImage
							.width || null,

					height:
						product.featuredImage
							.height || null,
				}
				: null,

		price: {
			amount:
				product?.priceRangeV2
					?.minVariantPrice
					?.amount || "0",

			currencyCode:
				product?.priceRangeV2
					?.minVariantPrice
					?.currencyCode ||
				"USD",
		},

		compareAtPrice: {
			amount:
				product
					?.compareAtPriceRange
					?.minVariantCompareAtPrice
					?.amount || "",

			currencyCode:
				product
					?.compareAtPriceRange
					?.minVariantCompareAtPrice
					?.currencyCode || "",
		},
	};
}

async function fetchAllProductsForPriceSort(admin) {
	const products = [];
	let after = null;
	let hasNextPage = true;

	while (hasNextPage) {
		const response = await admin.graphql(
			`#graphql
				query GetAllProductsPriceSnapshot(
					$after: String
				) {
					products(
						first: 250
						after: $after
						sortKey: ID
					) {
						nodes {
							id
							title
							handle
						vendor
						productType

							featuredImage {
								url
								altText
								width
								height
							}

							priceRangeV2 {
								minVariantPrice {
									amount
									currencyCode
								}
							}

							compareAtPriceRange {
								minVariantCompareAtPrice {
									amount
									currencyCode
								}
							}

							variants(first: 20) {
								nodes {
									availableForSale
								}
							}
						}

						pageInfo {
							hasNextPage
							endCursor
						}
					}
				}
			`,
			{
				variables: { after },
			},
		);

		const result = await response.json();

		if (result.errors?.length) {
			console.error(
				"All-products price sorting errors:",
				JSON.stringify(result.errors, null, 2),
			);
			return null;
		}

		const connection = result.data?.products;
		const nodes = Array.isArray(connection?.nodes)
			? connection.nodes
			: [];

		products.push(...nodes.map(mapProductNode));
		hasNextPage = connection?.pageInfo?.hasNextPage === true;
		after = connection?.pageInfo?.endCursor || null;

		if (hasNextPage && !after) {
			break;
		}
	}

	return products;
}

async function getAllProducts({
	admin,
	pageSize = 8,
	sortBy = "featured",
}) {
	if (!admin) {
		return null;
	}

	try {
		if (isPriceSort(sortBy)) {
			const snapshot = await fetchAllProductsForPriceSort(admin);

			if (!snapshot) {
				return null;
			}

			const sorted = sortProductsByPrice(snapshot, sortBy);
			const page = buildPriceSortPage(sorted, pageSize, null);

			return {
				id: null,
				title: "Products",
				handle: "all",
				description: "",
				productCount: sorted.length,
				products: page.products,
				image: null,
				pageInfo: page.pageInfo,
			};
		}

		const sortConfig = getAllProductsSortConfig(sortBy);
		const response = await admin.graphql(
			`#graphql
				query GetBuilderAllProducts(
					$first: Int!
					$sortKey: ProductSortKeys!
					$reverse: Boolean!
				) {
					products(
						first: $first
						sortKey: $sortKey
						reverse: $reverse
					) {
						nodes {
							id
							title
							handle
						vendor
						productType

							featuredImage {
								url
								altText
								width
								height
							}

							priceRangeV2 {
								minVariantPrice {
									amount
									currencyCode
								}
							}

							compareAtPriceRange {
								minVariantCompareAtPrice {
									amount
									currencyCode
								}
							}

							variants(first: 20) {
								nodes {
									availableForSale
								}
							}
						}

						pageInfo {
							hasNextPage
							endCursor
						}
					}

					productsCount(limit: null) {
						count
					}
				}
			`,
			{
				variables: {
					first: clampProductPageSize(pageSize, 8),
					...sortConfig,
				},
			},
		);

		const result = await response.json();

		if (result.errors?.length) {
			console.error(
				"All products GraphQL errors:",
				JSON.stringify(result.errors, null, 2),
			);
			return null;
		}

		const connection = result.data?.products;
		const nodes = Array.isArray(connection?.nodes)
			? connection.nodes
			: [];
		const products = nodes.map(mapProductNode);

		return {
			id: null,
			title: "Products",
			handle: "all",
			description: "",
			productCount: Number(
				result.data?.productsCount?.count ?? products.length,
			),
			products,
			image: null,
			pageInfo: {
				hasNextPage:
					connection?.pageInfo?.hasNextPage === true,
				endCursor:
					connection?.pageInfo?.endCursor || null,
			},
		};
	} catch (error) {
		console.error(
			"Failed to fetch all products:",
			error?.message || error,
		);
		return null;
	}
}

async function getAllProductsPage({
	admin,
	afterCursor = null,
	pageSize = 8,
	sortBy = "featured",
}) {
	if (!admin) {
		return null;
	}

	try {
		if (isPriceSort(sortBy)) {
			const snapshot = await fetchAllProductsForPriceSort(admin);

			if (!snapshot) {
				return null;
			}

			const sorted = sortProductsByPrice(snapshot, sortBy);
			return buildPriceSortPage(
				sorted,
				pageSize,
				afterCursor,
			);
		}

		const sortConfig = getAllProductsSortConfig(sortBy);
		const response = await admin.graphql(
			`#graphql
				query GetBuilderAllProductsPage(
					$after: String
					$first: Int!
					$sortKey: ProductSortKeys!
					$reverse: Boolean!
				) {
					products(
						first: $first
						after: $after
						sortKey: $sortKey
						reverse: $reverse
					) {
						nodes {
							id
							title
							handle
						vendor
						productType

							featuredImage {
								url
								altText
								width
								height
							}

							priceRangeV2 {
								minVariantPrice {
									amount
									currencyCode
								}
							}

							compareAtPriceRange {
								minVariantCompareAtPrice {
									amount
									currencyCode
								}
							}

							variants(first: 20) {
								nodes {
									availableForSale
								}
							}
						}

						pageInfo {
							hasNextPage
							endCursor
						}
					}
				}
			`,
			{
				variables: {
					after: afterCursor || null,
					first: clampProductPageSize(pageSize, 8),
					...sortConfig,
				},
			},
		);

		const result = await response.json();

		if (result.errors?.length) {
			console.error(
				"All-products pagination errors:",
				JSON.stringify(result.errors, null, 2),
			);
			return null;
		}

		const connection = result.data?.products;
		const nodes = Array.isArray(connection?.nodes)
			? connection.nodes
			: [];

		return {
			products: nodes.map(mapProductNode),
			pageInfo: {
				hasNextPage:
					connection?.pageInfo?.hasNextPage === true,
				endCursor:
					connection?.pageInfo?.endCursor || null,
			},
		};
	} catch (error) {
		console.error(
			"All-products pagination failed:",
			error?.message || error,
		);
		return null;
	}
}

async function getProductByHandle({ admin, handle }) {
	try {
		const response = await admin.graphql(
			`#graphql
			query BuilderProductByHandle($handle: String!) {
				productByHandle(handle: $handle) {
					id
					title
					handle
					description
					descriptionHtml
					vendor
					productType
					tags
					featuredImage { url altText width height }
					images(first: 12) { nodes { url altText width height } }
					priceRangeV2 { minVariantPrice { amount currencyCode } }
					compareAtPriceRange { minVariantCompareAtPrice { amount currencyCode } }
					variants(first: 100) {
						nodes {
							id
							title
							sku
							availableForSale
							inventoryQuantity
							price
							compareAtPrice
							image { url altText width height }
							selectedOptions { name value }
						}
					}
					metafields(first: 30) { nodes { namespace key type value } }
				}
			}
			`,
			{ variables: { handle } },
		);
		const result = await response.json();
		const product = result.data?.productByHandle;
		if (!product) return null;
		const variants = (product.variants?.nodes || []).map((variant) => ({
			id: variant.id,
			variantId: String(variant.id || "").split("/").pop(),
			title: variant.title || "Default",
			sku: variant.sku || "",
			availableForSale: variant.availableForSale === true,
			inventoryQuantity: Number.isFinite(Number(variant.inventoryQuantity)) ? Number(variant.inventoryQuantity) : null,
			price: variant.price ?? null,
			compareAtPrice: variant.compareAtPrice ?? null,
			image: variant.image || null,
			selectedOptions: variant.selectedOptions || [],
		}));
		return {
			id: product.id,
			title: product.title || "Product",
			handle: product.handle || handle,
			description: product.description || "",
			descriptionHtml: product.descriptionHtml || "",
			vendor: product.vendor || "",
			productType: product.productType || "",
			tags: product.tags || [],
			featuredImage: product.featuredImage || null,
			images: product.images?.nodes || [],
			metafields: product.metafields?.nodes || [],
			numericId: String(product.id || "").split("/").pop(),
			price: product.priceRangeV2?.minVariantPrice || null,
			compareAtPrice: product.compareAtPriceRange?.minVariantCompareAtPrice || null,
			availableForSale: variants.some((variant) => variant.availableForSale),
			inventoryQuantity: variants.reduce((sum, variant) => sum + (Number.isFinite(variant.inventoryQuantity) ? Math.max(0, variant.inventoryQuantity) : 0), 0),
			variants,
		};
	} catch (error) {
		console.error("Product lookup failed:", error?.message || error);
		return null;
	}
}

async function safeAdminData(admin, query, variables, label) {
	try { const response=await admin.graphql(query,{variables}); const result=await response.json(); if(result.errors?.length){console.error(`VSN ${label} GraphQL errors:`,result.errors);return null;} return result.data||null; } catch(error){ console.error(`VSN ${label} failed:`,error); return null; }
}
async function getSearchData({admin,query}){
	const q=String(query||"").trim(); if(!q)return {query:"",count:0,items:[]};
	const [productData, pageData, articleData] = await Promise.all([
		safeAdminData(admin,`#graphql\nquery SearchProducts($query:String!){products(first:24,query:$query){nodes{id title handle description featuredImage{url altText} priceRangeV2{minVariantPrice{amount currencyCode}}}}}`,{query:q},"search products"),
		safeAdminData(admin,`#graphql\nquery SearchPages($query:String!){pages(first:12,query:$query){nodes{id title handle bodySummary}}}`,{query:q},"search pages"),
		safeAdminData(admin,`#graphql\nquery SearchArticles($query:String!){articles(first:12,query:$query){nodes{id title handle excerpt blog{handle} image{url altText}}}}`,{query:q},"search articles"),
	]);
	const products=(productData?.products?.nodes||[]).map(x=>({type:"Product",title:x.title,excerpt:x.description||"",url:`/products/${x.handle}`,image:x.featuredImage,price:x.priceRangeV2?.minVariantPrice||null}));
	const pages=(pageData?.pages?.nodes||[]).map(x=>({type:"Page",title:x.title,excerpt:x.bodySummary||"",url:`/pages/${x.handle}`,image:null}));
	const articles=(articleData?.articles?.nodes||[]).map(x=>({type:"Article",title:x.title,excerpt:x.excerpt||"",url:`/blogs/${x.blog?.handle||"news"}/${x.handle}`,image:x.image}));
	return {query:q,count:products.length+pages.length+articles.length,items:[...products,...pages,...articles]};
}
async function getBlogData({admin,handle}){
	const data=await safeAdminData(admin,`#graphql\nquery BlogData($handle:String!){blogByHandle(handle:$handle){id title handle articles(first:24,sortKey:PUBLISHED_AT,reverse:true){nodes{id title handle excerpt publishedAt author{name} image{url altText}}}}}`,{handle},"blog data");
	const b=data?.blogByHandle; if(!b)return null; return {id:b.id,title:b.title,handle:b.handle,description:"",articles:(b.articles?.nodes||[]).map(a=>({...a,author:a.author?.name||"",url:`/blogs/${b.handle}/${a.handle}`}))};
}
async function getArticleData({admin,blogHandle,articleHandle}){
	const data=await safeAdminData(admin,`#graphql\nquery ArticleData($blog:String!,$query:String!){blogByHandle(handle:$blog){title handle articles(first:50,query:$query){nodes{id title handle contentHtml excerpt publishedAt tags author{name} image{url altText}}} allArticles:articles(first:50,sortKey:PUBLISHED_AT,reverse:true){nodes{id title handle excerpt publishedAt image{url altText}}}}}`,{blog:blogHandle,query:`handle:${articleHandle}`},"article data");
	const blog=data?.blogByHandle; const a=blog?.articles?.nodes?.[0]; if(!a)return null; const all=blog.allArticles?.nodes||[]; const index=all.findIndex(x=>x.handle===a.handle); const previous=index>=0&&index<all.length-1?all[index+1]:null; const next=index>0?all[index-1]:null; const related=all.filter(x=>x.handle!==a.handle).slice(0,3).map(x=>({...x,url:`/blogs/${blogHandle}/${x.handle}`})); return {...a,author:a.author?.name||"",blogHandle,previous:previous?{title:previous.title,url:`/blogs/${blogHandle}/${previous.handle}`}:null,next:next?{title:next.title,url:`/blogs/${blogHandle}/${next.handle}`}:null,related};
}
function getTemplateSettings(elements = []) {
	const node = (Array.isArray(elements) ? elements : []).find((item) => item?.type === "template-settings");
	return {
		headerEnabled: node?.props?.headerEnabled !== false,
		footerEnabled: node?.props?.footerEnabled !== false,
		headerId: String(node?.props?.headerId || ""),
		footerId: String(node?.props?.footerId || ""),
		seoTitle: String(node?.props?.seoTitle || ""),
		seoDescription: String(node?.props?.seoDescription || ""),
		canonical: String(node?.props?.canonical || ""),
		ogTitle: String(node?.props?.ogTitle || ""),
		ogDescription: String(node?.props?.ogDescription || ""),
		ogImage: String(node?.props?.ogImage || ""),
		schemaEnabled: node?.props?.schemaEnabled !== false,
		sticky: node?.props?.sticky === true,
		transparent: node?.props?.transparent === true,
		mobileMenu: node?.props?.mobileMenu !== false,
		mobileBreakpoint: Math.max(320, Math.min(1200, Number(node?.props?.mobileBreakpoint || 749))),
		fullWidth: node?.props?.fullWidth !== false,
	};
}

async function resolveReusableSections({ database, shop, elements, locale = "", marketKey = "*", localizationEnabled = false }) {
	const list = Array.isArray(elements) ? elements : [];
	let sections = [];
	let libraryItems = [];
	try {
		[sections, libraryItems] = await Promise.all([
			database.builderPage.findMany({ where: { shop, deletedAt: null, status: "published", template: "section" } }),
			database.builderLibraryItem.findMany({ where: { shop, syncMode: "global", deletedAt: null } }),
		]);
	} catch (error) {
		console.error("VSN reusable library lookup failed:", error);
		return list;
	}
	const localizedSections = await Promise.all(sections.map(async (item) => {
		const base = migrateBuilderContent(safeParseJson(item.publishedJson, []));
		if (!localizationEnabled) return [item.id, base];
		const localized = await resolveLocalizedPage(database, { shop, page: item, elements: base, locale, marketKey }).catch(() => ({ elements: base }));
		return [item.id, localized.elements];
	}));
	const map = new Map(localizedSections);
	const componentItems = libraryItems.map((item) => { let content = null; try { content = JSON.parse(item.contentJson || "null"); } catch {} return { ...item, content }; });
	const libraryMap = new Map(componentItems.map((item) => [item.id, item]));
	const resolveNodes = (nodes, stack = new Set()) => (Array.isArray(nodes) ? nodes : []).map((node) => {
		if (!node || typeof node !== "object") return node;
		const libraryId = String(node.meta?.libraryItemId || "");
		if (libraryId && !stack.has(`library:${libraryId}`) && libraryMap.has(libraryId)) {
			const libraryEntry = libraryMap.get(libraryId);
			const fresh = libraryEntry?.content;
			if (fresh && !Array.isArray(fresh) && typeof fresh === "object") {
				const nextStack = new Set(stack); nextStack.add(`library:${libraryId}`);
				return { ...fresh, id: node.id, label: node.label || fresh.label, meta: { ...(fresh.meta || {}), ...(node.meta || {}), libraryItemId: libraryId, librarySync: "global" }, children: resolveNodes(fresh.children || [], nextStack) };
			}
		}
		if (node.type === "component-instance") {
			const componentId = String(node.props?.componentId || "");
			const componentKey = `component:${componentId}`;
			if (!componentId || stack.has(componentKey)) return { ...node, type: "container", children: [], meta: { ...(node.meta || {}), componentId, componentCycleBlocked: stack.has(componentKey) } };
			const resolved = resolveComponentInstance(node, componentItems);
			if (!resolved?.root) return { ...node, type: "container", children: [] };
			const nextStack = new Set(stack); nextStack.add(componentKey);
			return { ...node, type: "container", label: node.label || resolved.definition?.name || "Component", props: {}, children: [resolveNodes([resolved.root], nextStack)[0]].filter(Boolean), meta: { ...(node.meta||{}), componentId, componentVersion: resolved.masterVersion } };
		}
		if (node.type === "global-section") {
			const sectionId = String(node.props?.sectionId || "");
			if (!sectionId || stack.has(sectionId) || !map.has(sectionId)) return { ...node, type: "section", children: [] };
			const nextStack = new Set(stack); nextStack.add(sectionId);
			const sectionElements = renderableElements(map.get(sectionId));
			return { ...node, type: "section", label: node.label || "Reusable Section", children: resolveNodes(sectionElements, nextStack) };
		}
		return { ...node, children: resolveNodes(node.children || [], stack) };
	});
	return resolveNodes(list);
}

async function getGlobalSection(database, shop, template, requestedId = null, { locale = "", marketKey = "*", localizationEnabled = false } = {}) {
	let page = null;
	if (requestedId) {
		page = await database.builderPage.findFirst({ where: { id: requestedId, shop, deletedAt: null, status: "published", template } });
	}
	if (!page) {
		page = await database.builderPage.findFirst({ where: { shop, deletedAt: null, status: "published", template, isDefault: true }, orderBy: { publishedAt: "desc" } });
	}
	if (!page?.publishedJson) return null;
	const baseElements = migrateBuilderContent(safeParseJson(page.publishedJson, []));
	const localized = localizationEnabled
		? await resolveLocalizedPage(database, { shop, page, elements: baseElements, locale, marketKey }).catch(() => ({ elements: baseElements, seo: {}, direction: "ltr" }))
		: { elements: baseElements, seo: {}, direction: "ltr" };
	return { id: page.id, title: page.title, elements: localized.elements, settings: { ...getTemplateSettings(localized.elements), ...(localized.seo || {}) }, localization: { locale, marketKey, direction: localized.direction || "ltr" } };
}

function htmlResponse(html, status = 200) {
	return new Response(html, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": status === 200 ? "public, max-age=15, stale-while-revalidate=30" : "no-store",
			"X-Content-Type-Options": "nosniff",
			"Vary": "Accept-Encoding",
		},
	});
}

function javascriptResponse(source, status = 200) {
	return new Response(String(source || ""), {
		status,
		headers: {
			"Content-Type": "application/javascript; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function toCssSize(value, fallback = "0px") {
	if (value === null || value === undefined || value === "") {
		return fallback;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return fallback;
		return /^-?\d+(?:\.\d+)?$/.test(trimmed)
			? `${trimmed}px`
			: trimmed;
	}

	if (typeof value === "object") {
		const candidate =
			value.desktop ??
			value.value ??
			value.tablet ??
			value.mobile;

		if (candidate !== undefined && candidate !== null && candidate !== "") {
			const unit = value.unit || "px";
			return typeof candidate === "number"
				? `${candidate}${unit}`
				: toCssSize(candidate, fallback);
		}
	}

	return fallback;
}

function getNodeSpacing(styles = {}) {
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

function jsonResponse(
	data,
	status = 200,
) {
	return new Response(
		JSON.stringify(data),
		{
			status,
			headers: {
				"Content-Type":
					"application/json; charset=utf-8",

				"Cache-Control":
					"no-store",
				"X-Content-Type-Options": "nosniff",
			},
		},
	);
}

function safeParseJson(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function getGlobalStyles(elements) {
	const node = (Array.isArray(elements) ? elements : []).find(
		(item) => item?.type === "global-styles",
	);
	return {
		primaryColor: node?.props?.primaryColor || "#008060",
		secondaryColor: node?.props?.secondaryColor || "#6d7175",
		accentColor: node?.props?.accentColor || node?.props?.primaryColor || "#008060",
		textColor: node?.props?.textColor || "#1a1a1a",
		backgroundColor: node?.props?.backgroundColor || "#ffffff",
		surfaceColor: node?.props?.surfaceColor || "#ffffff",
		mutedSurfaceColor: node?.props?.mutedSurfaceColor || "#f6f6f7",
		borderColor: node?.props?.borderColor || "#e3e3e3",
		fontFamily: node?.props?.fontFamily || "Inter, system-ui, sans-serif",
		headingFontFamily: node?.props?.headingFontFamily || "inherit",
		headingScale: Math.max(1, Math.min(2, Number(node?.props?.headingScale || 1.25))),
		buttonBackground: node?.props?.buttonBackground || "#1a1a1a",
		buttonTextColor: node?.props?.buttonTextColor || "#ffffff",
		buttonRadius: toCssSize(node?.props?.buttonRadius, "8px"),
		formBackground: node?.props?.formBackground || "#ffffff",
		formTextColor: node?.props?.formTextColor || "#202223",
		formBorderColor: node?.props?.formBorderColor || "#c9cccf",
		formRadius: toCssSize(node?.props?.formRadius, "8px"),
		radiusSm: toCssSize(node?.props?.radiusSm, "6px"),
		radiusMd: toCssSize(node?.props?.radiusMd, "12px"),
		radiusLg: toCssSize(node?.props?.radiusLg, "20px"),
		spacingBase: Math.max(1, Number(node?.props?.spacingBase || 4)),
		shadowSm: node?.props?.shadowSm || "0 1px 2px rgba(0,0,0,.08)",
		shadowMd: node?.props?.shadowMd || "0 8px 24px rgba(0,0,0,.12)",
		shadowLg: node?.props?.shadowLg || "0 20px 50px rgba(0,0,0,.16)",
		containerMaxWidth: toCssSize(node?.props?.containerMaxWidth, "1200px"),
		mobileBreakpoint: Math.max(320, Number(node?.props?.mobileBreakpoint || 749)),
		tabletBreakpoint: Math.max(500, Number(node?.props?.tabletBreakpoint || 989)),
	};
}

function mergeShopDesignTokens(globals, tokens = {}) {
	const out = { ...globals };
	const keys = ["primaryColor","secondaryColor","accentColor","textColor","backgroundColor","surfaceColor","mutedSurfaceColor","borderColor","fontFamily","headingFontFamily","buttonBackground","buttonTextColor","buttonRadius","formBackground","formTextColor","formBorderColor","formRadius","radiusSm","radiusMd","radiusLg","shadowSm","shadowMd","shadowLg","containerMaxWidth"];
	for (const key of keys) if (tokens[key] !== undefined && tokens[key] !== null && String(tokens[key]).trim() !== "") out[key] = tokens[key];
	if (tokens.containerMd) out.containerMaxWidth = tokens.containerMd;
	if (tokens.spacingBase) out.spacingBase = Math.max(1, Number(tokens.spacingBase) || out.spacingBase || 4);
	if (tokens.headingScale) out.headingScale = Math.max(1, Math.min(2, Number(tokens.headingScale) || out.headingScale || 1.25));
	return out;
}

function renderableElements(elements) {
	return (Array.isArray(elements) ? elements : []).filter(
		(item) => !["global-styles", "template-settings"].includes(item?.type),
	);
}

function buildCustomJsBundle(groups = []) {
	const entries = collectCustomJsGroups(groups);
	const valid = [];
	const invalid = [];
	for (const entry of entries) {
		const check = validateCustomJs(entry.code);
		if (check.valid) valid.push(entry);
		else invalid.push({ id: entry.id, message: check.error });
	}
	const lines = [
		"(function(){",
		"var __vsnScript=document.currentScript;",
		"var __vsnRoot=(__vsnScript&&__vsnScript.parentElement)||document;",
		"function __vsnFind(id){var roots=[__vsnRoot,document];for(var r=0;r<roots.length;r++){var list=roots[r]&&roots[r].querySelectorAll?roots[r].querySelectorAll('[data-vsn-id]'):[];for(var i=0;i<list.length;i++){if(list[i].getAttribute('data-vsn-id')===id)return list[i];}}return null;}",
	];
	for (const entry of valid) {
		lines.push(`try{var element=__vsnFind(${JSON.stringify(entry.id)});if(element){(function(element,document,window){"use strict";\n${entry.code}\n}).call(element,element,document,window);element.setAttribute('data-vsn-js-ready','1');}}catch(error){console.error('VSN custom JS failed for ${String(entry.id).replace(/['\\]/g, "")}:',error);}`);
	}
	for (const entry of invalid) lines.push(`console.warn(${JSON.stringify(`VSN custom JS skipped for ${entry.id}: ${entry.message}`)});`);
	lines.push("})();");
	return lines.join("\n");
}

function safeJsonForHtml(value) {
	return JSON.stringify(value || {}).replace(/</g, "\\u003c");
}

function buildSeoPayload({ page = null, title = "", settings = {}, product = null, article = null }) {
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

function buildSchemaMarkup({ product = null, article = null }) {
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

function vsnFontRuntime({ elements = [], globals = {}, customFonts = [] } = {}) {
	const usages = collectFontUsages({ elements, globals });
	if (globals.fontFamily) mergeFontUsage(usages, globals.fontFamily, { weights: [400,500,600,700], styles: ["normal"] });
	if (globals.headingFontFamily && globals.headingFontFamily !== "inherit") mergeFontUsage(usages, globals.headingFontFamily, { weights: [400,500,600,700,800], styles: ["normal"] });

	const customByFamily = new Map();
	for (const font of customFonts || []) {
		const key = String(font.family || "").toLowerCase();
		if (!customByFamily.has(key)) customByFamily.set(key, []);
		customByFamily.get(key).push(font);
	}

	const css = [];
	const googleUsages = new Map();
	for (const [key, usage] of usages) {
		const customVariants = customByFamily.get(key) || [];
		if (customVariants.length) {
			for (const custom of customVariants) {
				const mime = String(custom.mimeType || "");
				const format = mime.includes("woff2") ? "woff2" : mime.includes("woff") ? "woff" : (mime.includes("otf") || mime.includes("opentype")) ? "opentype" : "truetype";
				css.push(`@font-face{font-family:${JSON.stringify(custom.family)};src:url('/apps/vsn-builder/font/${encodeURIComponent(custom.id)}') format('${format}');font-style:${custom.style || "normal"};font-weight:${custom.weight || 400};font-display:swap;}`);
			}
			continue;
		}
		if (!SYSTEM_FONT_FAMILIES.has(key)) googleUsages.set(key, usage);
	}

	return {
		css: css.join("\n"),
		googleUrl: buildGoogleFontHref(googleUsages, FALLBACK_GOOGLE_FONTS),
	};
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

function formatMoney(
	amount,
	currencyCode = "USD",
) {
	const numericAmount =
		Number(amount || 0);

	try {
		return new Intl.NumberFormat(
			"en",
			{
				style: "currency",
				currency:
					currencyCode || "USD",
			},
		).format(numericAmount);
	} catch {
		return `${numericAmount.toFixed(
			2,
		)} ${currencyCode}`;
	}
}

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

function sanitizeRichHtml(value) {
	return String(value || "")
		.replace(/<\/?(?:script|style|iframe|object|embed|form)[^>]*>/gi, "")
		.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href="#"');
}
function contentTypography(styles={}, fallback={}) { return productTypographyStyle(styles, fallback); }
function parseNavigationItems(value) {
	return String(value || "Home|/").split(/\r?\n/).map((line) => {
		const [label, url] = line.split("|");
		return { label: String(label || "").trim(), url: String(url || "#").trim() || "#" };
	}).filter((item) => item.label);
}

function parseRows(value, fields = 2) {
  return String(value || "").split(/\r?\n/).map((line) => line.split("|").map((part) => String(part || "").trim()).slice(0, fields)).filter((row) => row.some(Boolean));
}

const NESTED_STOREFRONT_CONTRACT_TYPES = ["carousel", "slides", "testimonials-carousel"];
const PHASE10_SERVER_WIDGET_TYPES = new Set(["breadcrumbs","icon-list","icon-box","image-box","accordion","toggle","social-icons","map","progress-bar","counter","pricing-table","timeline","data-table","menu-anchor","form-builder","product-media","inventory-status","collection-filters","collection-sorting","collection-pagination","cart-drawer","countdown","video","slider","product-grid","product-card","collection-grid","html","liquid"]);

function parseFormFields(value) {
  return String(value || "").split(/\r?\n/).map((line, index) => {
    const [type="text", name=`field_${index+1}`, label="Field", placeholder="", required="", options="", step="1"] = line.split("|").map((part)=>String(part||"").trim());
    return { type:type.toLowerCase(), name:name.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80), label, placeholder, required:/^(required|true|1|yes)$/i.test(required), options:options.split(",").map((x)=>x.trim()).filter(Boolean), step:Math.max(1, Number(step)||1) };
  }).filter((field)=>field.type && field.name);
}

function renderFormBuilder(node, props, styles, renderContext = {}) {
  const formKey=String(props.formKey||"custom").trim()||"custom";
  const formSettings=renderContext?.formConfigs?.[formKey]||{};
  const captchaMode=formSettings.captchaMode||props.captchaMode||"none";
  const turnstileSiteKey=formSettings.turnstileSiteKey||props.turnstileSiteKey||"";
  const hcaptchaSiteKey=formSettings.hcaptchaSiteKey||props.hcaptchaSiteKey||"";
  const captchaV2=renderContext?.googleCaptcha?.v2||{}; const captchaV3=renderContext?.googleCaptcha?.v3||{};
  const recaptchaV2SiteKey=captchaV2.enabled!==false&&captchaV2.siteKeyConfigured?captchaV2.siteKey:"";
  const recaptchaV3SiteKey=captchaV3.enabled!==false&&captchaV3.siteKeyConfigured?captchaV3.siteKey:"";
  const recaptchaV3Threshold=Math.max(0,Math.min(1,Number(formSettings.recaptchaV3Threshold??props.recaptchaV3Threshold??captchaV3.threshold??0.5)));
  const recaptchaV3Action=String(formSettings.recaptchaV3Action||props.recaptchaV3Action||captchaV3.action||"form_submit").replace(/[^A-Za-z0-9_/]/g,"").slice(0,80)||"form_submit";
  const fields=parseFormFields(props.fieldsText);
  const maxStep=Math.max(1,...fields.map((field)=>field.step));
  const multi=props.multiStep===true && maxStep>1;
  const customer=renderContext?.customer||{}; const product=renderContext?.product||{};
  const fieldHtml=fields.map((field,index)=>{
    const id=`vsn-${escapeAttribute(node.id||"form")}-${index}`;
    const required=field.required?" required":"";
    let prefill=""; if(props.prefillCustomer!==false){if(field.name==="email"&&customer.email)prefill=customer.email;else if(["name","full_name","customer_name"].includes(field.name)&&customer.name)prefill=customer.name;} if(props.prefillProduct!==false){if(["product","product_title"].includes(field.name)&&product.title)prefill=product.title;else if(["product_handle","productHandle"].includes(field.name)&&product.handle)prefill=product.handle;}
    const common=`id="${id}" name="${escapeAttribute(field.name)}"${required}${prefill?` value="${escapeAttribute(prefill)}"`:""}`;
    let control="";
    if(field.type==="textarea") control=`<textarea ${common} placeholder="${escapeAttribute(field.placeholder)}" style="min-height:110px;padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;"></textarea>`;
    else if(field.type==="select") control=`<select ${common} style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">${field.options.map((option)=>`<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join("")}</select>`;
    else if(field.type==="radio") control=`<div style="display:flex;gap:12px;flex-wrap:wrap;">${field.options.map((option,i)=>`<label style="display:flex;gap:6px;align-items:center;"><input type="radio" name="${escapeAttribute(field.name)}" value="${escapeAttribute(option)}"${field.required&&i===0?" required":""}> ${escapeHtml(option)}</label>`).join("")}</div>`;
    else if(field.type==="checkbox") control=`<div style="display:grid;gap:6px;">${(field.options.length?field.options:[field.label]).map((option)=>`<label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" name="${escapeAttribute(field.name)}" value="${escapeAttribute(option)}"> ${escapeHtml(option)}</label>`).join("")}</div>`;
    else if(field.type==="consent") control=`<label style="display:flex;gap:8px;align-items:flex-start;"><input type="checkbox" name="${escapeAttribute(field.name)}" value="yes"${required}> <span>${escapeHtml(field.label)}</span></label>`;
    else if(field.type==="rating") control=`<input ${common} type="number" min="1" max="5" step="1" placeholder="${escapeAttribute(field.placeholder||"1–5")}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`;
    else if(field.type==="file") control=`<input ${common} type="file" ${props.fileMultiple!==false?"multiple":""} accept="${escapeAttribute(props.fileAccept||"image/*,.pdf")}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`;
    else if(field.type==="hidden") return `<input type="hidden" name="${escapeAttribute(field.name)}" value="${escapeAttribute(field.placeholder)}" data-vsn-form-step="${field.step}">`;
    else { const allowed=["text","email","tel","number","date","time","datetime-local","url"]; const type=allowed.includes(field.type)?field.type:"text"; control=`<input ${common} type="${type}" placeholder="${escapeAttribute(field.placeholder)}" style="padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;width:100%;box-sizing:border-box;">`; }
    const label=props.showLabels===false||field.type==="consent"?"":`<label for="${id}" style="font-size:13px;font-weight:600;">${escapeHtml(field.label)}${field.required?" *":""}</label>`;
    return `<div class="vsn-form-field" data-vsn-form-step="${field.step}" style="display:${multi&&field.step!==1?"none":"grid"};gap:6px;">${label}${control}</div>`;
  }).join("");
  const gap=toCssSize(styles?.spacing?.gap,"12px");
  return `<form class="vsn-builder-form vsn-form-builder" data-vsn-id="${escapeAttribute(node.id||"")}" data-vsn-form-type="${escapeAttribute(formKey)}" data-vsn-captcha-mode="${escapeAttribute(captchaMode)}" data-vsn-recaptcha-v3-sitekey="${escapeAttribute(captchaMode==="recaptcha-v3"?recaptchaV3SiteKey:"")}" data-vsn-recaptcha-v3-action="${escapeAttribute(recaptchaV3Action)}" data-vsn-recaptcha-v3-threshold="${escapeAttribute(recaptchaV3Threshold)}" data-vsn-success="${escapeAttribute(props.successText||"Thanks. Your submission has been received.")}" data-vsn-error="${escapeAttribute(props.errorText||"Please check the form and try again.")}" data-vsn-multi-step="${multi?"1":"0"}" data-vsn-max-step="${maxStep}" data-vsn-current-step="1" data-vsn-conditional="${escapeAttribute(encodeURIComponent(props.conditionalRulesText||""))}" data-vsn-validation="${escapeAttribute(encodeURIComponent(props.validationRulesText||""))}" data-vsn-calculations="${escapeAttribute(encodeURIComponent(props.calculationsText||""))}" data-vsn-prefill-query="${props.prefillQuery!==false?"1":"0"}" data-vsn-success-action="${escapeAttribute(props.successAction||"message")}" data-vsn-redirect="${escapeAttribute(props.redirectUrl||"")}" data-vsn-event="${escapeAttribute(props.customEventName||"vsn:form-success")}" data-vsn-coupon="${escapeAttribute(props.couponCode||"")}" style="display:grid;gap:${gap};max-width:${toCssSize(styles?.size?.maxWidth,"680px")};">
    ${props.heading?`<h3 style="margin:0;">${escapeHtml(props.heading)}</h3>`:""}
    <input type="hidden" name="formType" value="${escapeAttribute(formKey)}">
    ${props.prefillProduct!==false&&product.handle?`<input type="hidden" name="productHandle" value="${escapeAttribute(product.handle)}">`:""}
    <input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;">
    ${fieldHtml}
    ${captchaMode==="turnstile"&&turnstileSiteKey?`<div class="cf-turnstile" data-sitekey="${escapeAttribute(turnstileSiteKey)}"></div>`:""}
    ${captchaMode==="hcaptcha"&&hcaptchaSiteKey?`<div class="h-captcha" data-sitekey="${escapeAttribute(hcaptchaSiteKey)}"></div>`:""}
    ${captchaMode==="recaptcha-v2"&&recaptchaV2SiteKey?`<div class="vsn-g-recaptcha" data-sitekey="${escapeAttribute(recaptchaV2SiteKey)}"></div>`:""}
    ${captchaMode==="recaptcha-v3"&&recaptchaV3SiteKey?`<div class="vsn-g-recaptcha-v3" data-sitekey="${escapeAttribute(recaptchaV3SiteKey)}" data-action="${escapeAttribute(recaptchaV3Action)}"></div>`:""}
    ${captchaMode==="recaptcha-v2"&&!recaptchaV2SiteKey?`<div class="vsn-form-captcha-error" role="alert">Google reCAPTCHA v2 is not configured.</div>`:""}
    ${captchaMode==="recaptcha-v3"&&!recaptchaV3SiteKey?`<div class="vsn-form-captcha-error" role="alert">Google reCAPTCHA v3 is not configured.</div>`:""}
    <div class="vsn-form-actions" style="display:flex;gap:8px;align-items:center;">
      ${multi?`<button type="button" class="vsn-form-prev" style="display:none;padding:10px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;">${escapeHtml(props.previousText||"Back")}</button><button type="button" class="vsn-form-next" style="padding:10px 14px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:600;">${escapeHtml(props.nextText||"Next")}</button>`:""}
      <button type="submit" class="vsn-form-submit" style="${multi?"display:none;":""}padding:10px 14px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:600;">${escapeHtml(props.submitText||"Submit")}</button>
    </div>
    <div class="vsn-form-status" role="status" aria-live="polite" style="min-height:1.25em;font-size:13px;"></div>
  </form>`;
}

function renderPhase10Widget(node, props, styles, renderContext) {
  const id=escapeAttribute(node.id||""); const type=node.type; const gap=toCssSize(styles?.spacing?.gap||styles?.grid?.gap,"12px"); const product=renderContext?.product||{};
  if(type==="form-builder") return renderFormBuilder(node,props,styles,renderContext);
  if(type==="breadcrumbs") { const rows=normalizeStructuredItems("breadcrumbs",props).filter((_,i)=>props.showHome!==false||i>0); return `<nav data-vsn-id="${id}" aria-label="Breadcrumb" style="display:flex;gap:${gap};flex-wrap:wrap;">${rows.map((item,i)=>`${i?`<span>${escapeHtml(props.separator||"/")}</span>`:""}<a href="${escapeAttribute(item.url||"#")}" style="color:inherit;text-decoration:none;">${escapeHtml(item.label||"")}</a>`).join("")}</nav>`; }
  if(type==="icon-list") { const rows=normalizeStructuredItems("icon-list",props); return `<ul data-vsn-id="${id}" style="display:grid;gap:${gap};list-style:none;padding:0;margin:0;">${rows.map((item)=>`<li style="display:flex;gap:8px;align-items:center;"><span>${escapeHtml(item.icon||"•")}</span>${item.url?`<a href="${escapeAttribute(item.url)}" style="color:inherit;">${escapeHtml(item.label||"")}</a>`:escapeHtml(item.label||"")}</li>`).join("")}</ul>`; }
  if(type==="icon-box") return `<a data-vsn-id="${id}" href="${escapeAttribute(props.url||"#")}" style="display:block;color:inherit;text-decoration:none;border:1px solid ${escapeAttribute(styles?.border?.color||"#e5e5e5")};border-radius:${toCssSize(styles?.border?.radius,"12px")};padding:${toCssSize(styles?.spacing?.paddingTop,"20px")};"><div style="font-size:30px;">${escapeHtml(props.icon||"★")}</div><strong style="display:block;margin-top:8px;">${escapeHtml(props.heading||"")}</strong><div style="margin-top:6px;color:#666;">${escapeHtml(props.text||"")}</div></a>`;
  if(type==="image-box") { const media=props.media&&typeof props.media==="object"?props.media:{}; const src=props.src?buildImageRenderUrl(props.src,props,media):""; return `<a data-vsn-id="${id}" class="vsn-image-box vsn-content-item" href="${escapeAttribute(props.url||"#")}" style="display:block;color:inherit;text-decoration:none;">${src?`<img class="vsn-content-media" src="${escapeAttribute(src)}" alt="${escapeAttribute(props.alt||props.heading||"")}" loading="${escapeAttribute(props.loading||"lazy")}" fetchpriority="${escapeAttribute(props.fetchPriority||"auto")}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:${toCssSize(styles?.border?.radius,"12px")};">`:`<div class="vsn-content-media" style="aspect-ratio:4/3;background:#f2f2f2;border-radius:12px;"></div>`}<strong class="vsn-content-title" style="display:block;margin-top:10px;">${escapeHtml(props.heading||"")}</strong><div class="vsn-content-body" style="color:#666;">${escapeHtml(props.text||"")}</div></a>`; }
  if(type==="accordion"||type==="toggle") { const rows=type==="toggle"?[{title:props.title||"Toggle",content:props.content||""}]:normalizeStructuredItems("accordion",props); return `<div data-vsn-id="${id}" style="display:grid;gap:${gap};">${rows.map((item,i)=>`<details ${((type==="toggle"&&props.open)||(type==="accordion"&&props.firstOpen!==false&&i===0))?"open":""} style="border:1px solid #e5e5e5;border-radius:10px;padding:12px;"><summary style="cursor:pointer;font-weight:600;">${escapeHtml(item.title||"")}</summary><div style="padding-top:8px;line-height:1.6;">${escapeHtml(item.content||"")}</div></details>`).join("")}</div>`; }
  
  if(type==="social-icons"){const rows=normalizeStructuredItems("social-icons",props);return `<div data-vsn-id="${id}" style="display:flex;gap:${gap};flex-wrap:wrap;">${rows.map((item)=>`<a href="${escapeAttribute(item.url||"#")}" ${props.openNew===false?"":'target="_blank" rel="noopener noreferrer"'} title="${escapeAttribute(item.label||"")}" style="width:38px;height:38px;border:1px solid #ddd;border-radius:999px;display:grid;place-items:center;text-decoration:none;color:inherit;">${escapeHtml(item.icon||String(item.label||"").slice(0,2))}</a>`).join("")}</div>`;}
  if(type==="map"){const q=encodeURIComponent(props.query||"Dubai, UAE");const zoom=Math.max(1,Math.min(20,Number(props.zoom||14)));const key=String(renderContext?.googleMapsApiKey||"").trim();if(!key)return `<div data-vsn-id="${id}" class="vsn-map-unconfigured" role="note" style="width:100%;height:${toCssSize(props.height,"360px")};display:grid;place-items:center;padding:24px;border:1px dashed #c9cccf;border-radius:12px;background:#f6f6f7;color:#6d7175;text-align:center;">Google Maps API key is not configured in VSN Builder Settings.</div>`;const src=`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&zoom=${zoom}`;return `<iframe data-vsn-id="${id}" title="Google Map" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="${escapeAttribute(src)}" style="width:100%;height:${toCssSize(props.height,"360px")};border:0;border-radius:12px;"></iframe>`;}
  if(type==="progress-bar"){const v=Math.max(0,Math.min(100,Number(props.value)||0));return `<div data-vsn-id="${id}"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>${escapeHtml(props.label||"Progress")}</span>${props.showValue===false?"":`<span>${v}%</span>`}</div><div style="height:9px;background:#eee;border-radius:999px;overflow:hidden;"><span style="display:block;width:${v}%;height:100%;background:var(--vsn-primary,#008060);"></span></div></div>`;}
  if(type==="counter") return `<div data-vsn-id="${id}" class="vsn-counter" data-vsn-start="${Number(props.start||0)}" data-vsn-end="${Number(props.end||100)}" data-vsn-duration="${Math.max(100,Number(props.duration||1200))}" data-vsn-prefix="${escapeAttribute(props.prefix||"")}" data-vsn-suffix="${escapeAttribute(props.suffix||"")}" style="${contentTypography(styles,{fontSize:"42px",fontWeight:"700"})}">${escapeHtml(`${props.prefix||""}${props.end??100}${props.suffix||""}`)}</div>`;
  if(type==="pricing-table") return `<div data-vsn-id="${id}" style="border:${props.featured?"2px solid var(--vsn-primary,#008060)":"1px solid #e5e5e5"};border-radius:14px;padding:22px;"><h3>${escapeHtml(props.title||"Plan")}</h3><div style="font-size:34px;font-weight:700;">${escapeHtml(props.price||"")} <span style="font-size:14px;font-weight:400;color:#666;">${escapeHtml(props.period||"")}</span></div><ul>${String(props.featuresText||"").split(/\r?\n/).filter(Boolean).map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><a href="${escapeAttribute(props.buttonUrl||"#")}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">${escapeHtml(props.buttonText||"Choose plan")}</a></div>`;
  if(type==="timeline"){const rows=normalizeStructuredItems("timeline",props);return `<div data-vsn-id="${id}" style="display:grid;gap:${gap};">${rows.map((item)=>`<div style="display:grid;grid-template-columns:90px 1fr;gap:14px;border-left:2px solid #ddd;padding-left:14px;"><strong>${escapeHtml(item.eyebrow||"")}</strong><div><b>${escapeHtml(item.title||"")}</b><div style="color:#666;">${escapeHtml(item.description||"")}</div></div></div>`).join("")}</div>`;}
  if(type==="data-table"){const headers=String(props.headersText||"").split("|").map((x)=>x.trim());const rows=parseRows(props.rowsText,Math.max(1,headers.length));return `<div data-vsn-id="${id}" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${headers.map((h)=>`<th style="text-align:left;padding:10px;border-bottom:1px solid #ddd;">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr ${props.striped&&i%2?`style="background:#fafafa;"`:""}>${headers.map((_,j)=>`<td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(row[j]||"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
  if(type==="menu-anchor") return `<span data-vsn-id="${id}" id="${escapeAttribute(String(props.anchorId||"section-anchor").replace(/[^a-zA-Z0-9_-]/g,"-"))}" aria-hidden="true"></span>`;
  if(type==="product-media") return renderProductGallery(node,props,styles,renderContext);
  if(type==="inventory-status") return renderProductAvailability(node,props,styles,renderContext);
  if(type==="collection-filters") return `<div data-vsn-id="${id}" class="vsn-product-filters vsn-standalone-filters" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;"><strong style="width:100%;">${escapeHtml(props.label||"Filters")}</strong>${props.showAvailability===false?"":`<label>Availability <select data-vsn-filter="availability"><option value="all">All</option><option value="in-stock">In stock</option><option value="out-of-stock">Out of stock</option></select></label>`}${props.showPrice===false?"":`<label>Min price <input data-vsn-filter="min-price" type="number" min="0" step="0.01" style="width:110px;"></label><label>Max price <input data-vsn-filter="max-price" type="number" min="0" step="0.01" style="width:110px;"></label>`}${props.showVendor===false?"":`<label>Vendor <select data-vsn-filter="vendor"><option value="">All vendors</option></select></label>`}${props.showProductType===false?"":`<label>Product type <select data-vsn-filter="product-type"><option value="">All types</option></select></label>`}<button type="button" data-vsn-filter-clear>${escapeHtml(props.clearText||"Clear")}</button></div>`;
  if(type==="collection-sorting") { const selected=props.defaultSort||"featured"; const option=(value,label)=>`<option value="${value}" ${selected===value?"selected":""}>${label}</option>`; return `<label data-vsn-id="${id}">${escapeHtml(props.label||"Sort by")} <select class="vsn-standalone-sort">${option("featured","Featured")}${option("price-ascending","Price: low to high")}${option("price-descending","Price: high to low")}${option("title-ascending","A–Z")}${option("title-descending","Z–A")}</select></label>`; }
  if(type==="collection-pagination") return props.mode==="pages"?`<nav data-vsn-id="${id}" class="vsn-standalone-pagination" aria-label="Pagination" style="display:flex;gap:8px;"><button type="button" class="vsn-collection-page-prev">${escapeHtml(props.previousText||"Previous")}</button><button type="button" class="vsn-collection-page-next">${escapeHtml(props.nextText||"Next")}</button></nav>`:`<div data-vsn-id="${id}" class="vsn-standalone-pagination"><button type="button" class="vsn-collection-load-more">${escapeHtml(props.buttonText||"Load more")}</button></div>`;
  if(type==="cart-drawer") return `<div data-vsn-id="${id}" class="vsn-cart-widget" style="border:1px solid #eee;border-radius:12px;padding:18px;"><strong>${escapeHtml(props.heading||"Your cart")}</strong><div class="vsn-cart-widget-body" style="padding:14px 0;color:#666;">${escapeHtml(props.emptyText||"Your cart is empty")}</div><div style="display:flex;gap:8px;"><a href="/cart" class="vsn-cart-trigger" style="text-decoration:none;">${escapeHtml(props.viewCartText||"View cart")}</a><a href="/checkout" class="vsn-cart-checkout" style="text-decoration:none;">${escapeHtml(props.checkoutText||"Checkout")}</a></div></div>`;
  if(type==="countdown") return `<div data-vsn-id="${id}" class="vsn-countdown" data-vsn-end="${escapeAttribute(props.endDate||props.date||"")}" data-vsn-expired-text="${escapeAttribute(props.expiredText||"Offer ended")}" style="display:flex;gap:8px;">${props.showDays===false?"":"<span data-vsn-countdown-days>00d</span>"}${props.showHours===false?"":"<span data-vsn-countdown-hours>00h</span>"}${props.showMinutes===false?"":"<span data-vsn-countdown-minutes>00m</span>"}${props.showSeconds===false?"":"<span data-vsn-countdown-seconds>00s</span>"}</div>`;
  if(type==="video") {
    const video=normalizeVideoWidgetProps(props);
    if(!video.url)return `<div data-vsn-id="${id}" style="aspect-ratio:16/9;background:#111;color:#fff;display:grid;place-items:center;border-radius:12px;">Choose or paste a video</div>`;
    const poster=video.posterEnabled?String(video.poster?.url||video.poster?.previewUrl||""):"";
    const embed=videoEmbedUrl(video,video.autoplay);
    const clickEmbed=videoEmbedUrl(video,true);
    const playIconMarkup = video.playIcon?.source === "svg-file" && video.playIcon?.url
      ? `<img src="${escapeAttribute(video.playIcon.url)}" alt="" style="width:46%;height:46%;object-fit:contain;">`
      : video.playIcon?.glyph
        ? escapeHtml(video.playIcon.glyph)
        : renderContentIconSvg(video.playIcon?.name || video.playIcon?.polarisType || "play");
    const play=video.showPlayIcon?`<button type="button" class="vsn-video-play" aria-label="Play video" style="position:absolute;inset:0;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;"><span style="width:${video.playIconSize}px;height:${video.playIconSize}px;border-radius:999px;display:grid;place-items:center;background:rgba(0,0,0,.68);color:#fff;font-size:${Math.round(video.playIconSize*.42)}px;">${playIconMarkup}</span></button>`:"";
    if(["youtube","vimeo","dailymotion"].includes(video.provider)) {
      const clickToPlay=!video.autoplay&&video.showPlayIcon;
      const iframe=(embed||clickEmbed)?`<iframe class="vsn-video-frame" title="Video" ${video.lazyLoad?'loading="lazy"':''} ${clickToPlay?'data-vsn-video-src':'src'}="${escapeAttribute(clickToPlay?clickEmbed:embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0;display:${clickToPlay?'none':'block'};"></iframe>`:"";
      return `<div data-vsn-id="${id}" class="vsn-video-widget" data-vsn-video-provider="${escapeAttribute(video.provider)}" data-vsn-video-start="${video.startTime}" data-vsn-video-end="${video.endTime}" data-vsn-video-volume="${video.defaultVolume}" style="position:relative;width:100%;aspect-ratio:16/9;background:#111;border-radius:12px;overflow:hidden;">${poster&&clickToPlay?`<img class="vsn-video-poster" src="${escapeAttribute(poster)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`:""}${iframe}${clickToPlay?play:""}</div>`;
    }
    return `<div data-vsn-id="${id}" class="vsn-video-widget" data-vsn-video-provider="direct" data-vsn-video-start="${video.startTime}" data-vsn-video-end="${video.endTime}" data-vsn-video-volume="${video.defaultVolume}" style="position:relative;width:100%;aspect-ratio:16/9;background:#111;border-radius:12px;overflow:hidden;"><video class="vsn-video-element" src="${escapeAttribute(video.url)}" ${poster?`poster="${escapeAttribute(poster)}"`:""} ${video.autoplay?'autoplay':''} ${video.muted?'muted':''} ${video.loop?'loop':''} ${video.controls?'controls':''} ${video.playsInline?'playsinline':''} preload="${escapeAttribute(video.preload)}" style="width:100%;height:100%;object-fit:cover;display:block;"></video>${!video.autoplay&&video.showPlayIcon?play:""}</div>`;
  }
  if(type==="slider" || isNestedSliderType(type)) {
    const slider=isNestedSliderType(type)?normalizeNestedSliderProps(type,props):normalizeSliderProps(props);
    const slides=Array.isArray(node.children)?node.children:[];
    const renderSlide=(slide)=>slide?.type==="container"&&(slide?.props?.__sliderSlide||slide?.props?.__nestedSliderItem)?(slide.children||[]).map((child)=>renderNode(child,renderContext)).join(""):renderNode(slide,renderContext);
    const slideHtml=slides.map((slide,index)=>`<div class="vsn-slider-slide" data-vsn-slide-index="${index}" style="min-width:0;">${renderSlide(slide)}</div>`).join("");
    const dots=slider.pagination==="dots"?`<div class="vsn-slider-dots">${slides.map((_,index)=>`<button type="button" data-vsn-slider-dot="${index}" aria-label="Go to slide ${index+1}"></button>`).join("")}</div>`:"";
    const fraction=slider.pagination==="fraction"?`<div class="vsn-slider-fraction"><span data-vsn-slider-current>1</span> / ${slides.length}</div>`:"";
    const progress=slider.pagination==="progress"?`<div class="vsn-slider-progress"><span data-vsn-slider-progress-bar></span></div>`:"";
    return `<div data-vsn-id="${id}" class="vsn-slider" data-vsn-slider="1" data-vsn-slider-index="0" data-vsn-slider-direction="${slider.direction}" data-vsn-slider-effect="${slider.effect}" data-vsn-slider-centered="${slider.centered?'1':'0'}" data-vsn-slider-auto-height="${slider.autoHeight?'1':'0'}" data-vsn-slider-equal-height="${slider.equalHeight?'1':'0'}" data-vsn-slider-desktop="${slider.slidesDesktop}" data-vsn-slider-tablet="${slider.slidesTablet}" data-vsn-slider-mobile="${slider.slidesMobile}" data-vsn-slider-gap="${slider.gap}" data-vsn-slider-speed="${slider.speed}" data-vsn-slider-autoplay="${slider.autoplay?'1':'0'}" data-vsn-slider-delay="${slider.autoplayDelay}" data-vsn-slider-loop="${slider.loop?'1':'0'}" data-vsn-slider-rewind="${slider.rewind?'1':'0'}" data-vsn-slider-pause-hover="${slider.pauseOnHover?'1':'0'}" data-vsn-slider-pause-interaction="${slider.pauseOnInteraction?'1':'0'}" data-vsn-slider-stop-last="${slider.stopOnLastSlide?'1':'0'}" data-vsn-slider-keyboard="${slider.keyboard?'1':'0'}" data-vsn-slider-swipe="${slider.swipe?'1':'0'}" style="position:relative;overflow:hidden;padding-left:${slider.edgePadding}px;padding-right:${slider.edgePadding}px;--vsn-slider-gap:${slider.gap}px;--vsn-slider-speed:${slider.speed}ms;--vsn-slider-desktop:${slider.slidesDesktop};--vsn-slider-tablet:${slider.slidesTablet};--vsn-slider-mobile:${slider.slidesMobile};"><div class="vsn-slider-viewport" style="overflow:hidden;"><div class="vsn-slider-track">${slideHtml}</div></div>${slider.navigation&&slides.length>1?`<button type="button" class="vsn-slider-prev" aria-label="Previous slide">${escapeHtml(slider.previousIcon)}</button><button type="button" class="vsn-slider-next" aria-label="Next slide">${escapeHtml(slider.nextIcon)}</button>`:""}${dots}${fraction}${progress}</div>`;
  }
  if(type==="product-grid"||type==="product-card"||type==="collection-grid") {
    const grid=normalizeGridProps(type,props); const cols=type==="product-card"?1:grid.columnsDesktop; const queried=renderContext?.widgetQueries?.[node.id]||[];
    if(type==="collection-grid"){
      const items=queried.slice(0,grid.limit); if(!items.length)return `<div data-vsn-id="${id}" class="vsn-grid-empty">${escapeHtml(grid.emptyText)}</div>`;
      return `<style>@media(max-width:749px){[data-vsn-id="${id}"].vsn-data-grid{grid-template-columns:repeat(${grid.columnsMobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"].vsn-data-grid{grid-template-columns:repeat(${grid.columnsTablet},minmax(0,1fr))!important}}</style><div data-vsn-id="${id}" class="vsn-data-grid vsn-collection-grid" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${grid.gap}px;">${items.map((item)=>`<a href="/collections/${escapeAttribute(item.handle||"")}" style="color:inherit;text-decoration:none;border:1px solid #eee;border-radius:10px;padding:10px;">${grid.showImage&&item.image?.url?`<img src="${escapeAttribute(item.image.url)}" alt="${escapeAttribute(item.image.altText||item.title||"")}" loading="lazy" style="width:100%;aspect-ratio:${gridImageRatio(grid.imageRatio)};object-fit:cover;border-radius:8px;">`:""}${grid.showTitle?`<strong style="display:block;margin-top:8px;">${escapeHtml(item.title)}</strong>`:""}${grid.showCount?`<span style="font-size:12px;color:#666;">${escapeHtml(String(item.productsCount?.count??0))} products</span>`:""}</a>`).join("")}</div>`;
    }
    const items=(type==="product-card"?(queried.slice(0,1)):queried.slice(0,grid.limit)); if(!items.length)return `<div data-vsn-id="${id}" class="vsn-grid-empty">${escapeHtml(grid.emptyText)}</div>`;
    return `<style>@media(max-width:749px){[data-vsn-id="${id}"].vsn-data-grid{grid-template-columns:repeat(${grid.columnsMobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"].vsn-data-grid{grid-template-columns:repeat(${grid.columnsTablet},minmax(0,1fr))!important}}</style><div data-vsn-id="${id}" class="vsn-data-grid vsn-product-grid" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${grid.gap}px;">${items.map((item)=>`<a href="/products/${escapeAttribute(item.handle||"")}" style="color:inherit;text-decoration:none;border:1px solid #eee;border-radius:10px;padding:10px;">${grid.showImage&&item.image?.url?`<img src="${escapeAttribute(item.image.url)}" alt="${escapeAttribute(item.image.altText||item.title||"")}" loading="lazy" style="width:100%;aspect-ratio:${gridImageRatio(grid.imageRatio)};object-fit:cover;border-radius:8px;">`:""}${grid.showVendor&&item.vendor?`<span style="display:block;margin-top:7px;font-size:11px;color:#666;">${escapeHtml(item.vendor)}</span>`:""}${grid.showTitle?`<strong style="display:block;margin-top:8px;">${escapeHtml(item.title)}</strong>`:""}${grid.showPrice&&item.price?`<span style="display:block;font-size:13px;">${escapeHtml(formatMoney(item.price.amount,item.price.currencyCode))}</span>`:""}</a>`).join("")}</div>`;
  }
  if(type==="html" && props.mode==="theme-section") { const sectionId=escapeAttribute(String(props.themeSectionId||"")); return `<div data-vsn-id="${id}" class="vsn-theme-section-bridge" data-vsn-theme-section-id="${sectionId}"><span class="vsn-builder-loading">Loading Shopify theme section…</span></div>`; }
  if(type==="html") return `<div data-vsn-id="${id}" class="vsn-code-surface vsn-html-output">${sanitizeRichHtml(props.code||props.html||props.content||"")}</div>`;
  if(type==="liquid") return `<pre data-vsn-id="${id}" class="vsn-code-surface vsn-liquid-output" style="white-space:pre-wrap;background:#f6f6f7;padding:12px;border-radius:8px;">${escapeHtml(props.code||props.liquid||props.content||"{{ product.title }}")}</pre>`;
  return "";
}

function renderExtendedWidget(node, props, styles, renderContext) {
  const id = escapeAttribute(node.id || "");
  const type = node.type;
  const typography = contentTypography(styles, { fontSize: "14px", color: "#1a1a1a" });
  const gap = toCssSize(styles?.grid?.gap || styles?.spacing?.gap, "16px");
  const product = renderContext?.product || {};

  if (type === "faq") {
    const rows = normalizeStructuredItems("faq", props);
    return `<div data-vsn-id="${id}" class="vsn-faq" style="display:grid;gap:${gap};">${rows.map((item)=>`<details style="border:1px solid #e5e5e5;border-radius:10px;padding:14px 16px;"><summary style="cursor:pointer;font-weight:600;">${escapeHtml(item.question||"")}</summary><div style="padding-top:10px;color:#555;line-height:1.6;">${escapeHtml(item.answer||"")}</div></details>`).join("")}</div>`;
  }
  if (type === "testimonials") {
    const rows = normalizeStructuredItems("testimonials", props); const cols=Math.max(1,Math.min(4,Number(props.columns||3)));
    return `<div data-vsn-id="${id}" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap};">${rows.map((item)=>`<blockquote style="margin:0;border:1px solid #e5e5e5;border-radius:12px;padding:18px;"><p style="margin:0 0 12px;line-height:1.6;">“${escapeHtml(item.quote||"")}”</p><footer style="font-size:13px;color:#666;">${escapeHtml(item.name||"")}${item.role?` · ${escapeHtml(item.role)}`:""}</footer></blockquote>`).join("")}</div>`;
  }
  if (type === "logo-cloud") {
    const items = normalizeStructuredItems("logo-cloud", props);
    return `<div data-vsn-id="${id}" class="vsn-logo-cloud" style="display:flex;gap:${gap};align-items:center;justify-content:center;flex-wrap:wrap;${typography}">${items.map((item)=>item.imageUrl?`<a class="vsn-logo-item vsn-content-item" href="${escapeAttribute(item.url||"#")}" style="display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border:1px solid #ececec;border-radius:12px;"><img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.label||"")}" loading="lazy" style="max-width:120px;max-height:52px;object-fit:contain;"></a>`:`<a class="vsn-logo-item vsn-content-item" href="${escapeAttribute(item.url||"#")}" style="padding:12px 18px;border:1px solid #ececec;border-radius:999px;font-weight:600;color:inherit;text-decoration:none;">${escapeHtml(item.label||"")}</a>`).join("")}</div>`;
  }
  if (type === "stats") {
    const rows=normalizeStructuredItems("stats",props); const cols=Math.max(1,Math.min(6,Number(props.columns||4)));
    return `<div data-vsn-id="${id}" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap};">${rows.map((item)=>`<div style="text-align:center;padding:18px;border:1px solid #eee;border-radius:12px;"><strong style="display:block;font-size:30px;">${escapeHtml(item.value)}</strong><span style="font-size:13px;color:#666;">${escapeHtml(item.label)}</span></div>`).join("")}</div>`;
  }
  if (type === "team-grid") {
    const rows=normalizeStructuredItems("team-grid",props); const cols=Math.max(1,Math.min(4,Number(props.columns||3)));
    return `<div data-vsn-id="${id}" class="vsn-team-grid" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap};">${rows.map((item)=>`<div class="vsn-team-card vsn-content-item" style="padding:18px;border:1px solid #eee;border-radius:12px;">${item.imageUrl?`<img class="vsn-content-media" src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.name||"")}" loading="lazy" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;margin-bottom:12px;">`:`<div class="vsn-content-media" style="aspect-ratio:1/1;background:#f2f2f2;border-radius:10px;margin-bottom:12px;"></div>`}<strong class="vsn-content-title">${escapeHtml(item.name||"")}</strong><div class="vsn-content-meta" style="font-size:13px;color:#666;margin-top:4px;">${escapeHtml(item.role||"")}</div></div>`).join("")}</div>`;
  }
  if (type === "gallery-grid") {
    const gallery=normalizeGalleryWidgetProps(props); const ratio=galleryAspectRatio(gallery.imageRatio,gallery.customRatioWidth,gallery.customRatioHeight);
    const item=(media,index)=>{const img=`<img class="vsn-gallery-item vsn-content-media" src="${escapeAttribute(media.url)}" alt="${escapeAttribute(media.alt||"")}" loading="lazy" style="width:100%;${ratio!=="auto"?`aspect-ratio:${ratio};`:""}object-fit:${escapeAttribute(gallery.objectFit)};object-position:${escapeAttribute(gallery.objectPosition)};border-radius:${toCssSize(styles?.image?.borderRadius,"10px")};display:block;">`;let body=img;if(gallery.clickAction==="lightbox")body=`<a href="${escapeAttribute(media.url)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url)}" data-vsn-lightbox-alt="${escapeAttribute(media.alt||"")}">${img}</a>`;else if(gallery.clickAction==="link"&&media.linkUrl)body=`<a href="${escapeAttribute(media.linkUrl)}" ${gallery.openLinksNewTab?'target="_blank" rel="noopener noreferrer"':''}>${img}</a>`;return `<figure class="vsn-gallery-item-wrap vsn-content-item" style="margin:0;min-width:0;">${body}${gallery.showCaptions&&media.caption?`<figcaption style="font-size:12px;margin-top:6px;color:#666;">${escapeHtml(media.caption)}</figcaption>`:""}</figure>`;};
    const common=`--vsn-gallery-cols-desktop:${gallery.columnsDesktop};--vsn-gallery-cols-tablet:${gallery.columnsTablet};--vsn-gallery-cols-mobile:${gallery.columnsMobile};--vsn-gallery-gap:${gallery.gap}px;--vsn-gallery-row-gap:${gallery.rowGap}px;`;
    if(gallery.layout==="masonry")return `<div data-vsn-id="${id}" class="vsn-gallery-grid is-masonry" style="${common}column-count:var(--vsn-gallery-cols-desktop);column-gap:var(--vsn-gallery-gap);">${gallery.galleryItems.map((media,index)=>`<div style="break-inside:avoid;margin-bottom:var(--vsn-gallery-row-gap);">${item(media,index)}</div>`).join("")}</div>`;
    if(gallery.layout==="justified")return `<div data-vsn-id="${id}" class="vsn-gallery-grid is-justified" style="${common}display:flex;flex-wrap:wrap;gap:var(--vsn-gallery-row-gap) var(--vsn-gallery-gap);">${gallery.galleryItems.map((media,index)=>`<div style="flex:1 1 calc(${100/gallery.columnsDesktop}% - var(--vsn-gallery-gap));min-width:120px;">${item(media,index)}</div>`).join("")}</div>`;
    return `<div data-vsn-id="${id}" class="vsn-gallery-grid" style="${common}display:grid;grid-template-columns:repeat(var(--vsn-gallery-cols-desktop),minmax(0,1fr));column-gap:var(--vsn-gallery-gap);row-gap:var(--vsn-gallery-row-gap);">${gallery.galleryItems.map(item).join("")}</div>`;
  }
  if (type === "marquee") {
    const speed=Math.max(8,Math.min(90,Number(props.speed||24))); const text=escapeHtml(props.text||"");
    return `<div data-vsn-id="${id}" class="vsn-marquee" style="overflow:hidden;white-space:nowrap;background:${escapeAttribute(styles?.background?.color||"#111")};color:${escapeAttribute(styles?.typography?.color||"#fff")};padding:${toCssSize(styles?.spacing?.paddingTop,"10px")} 0;"><div class="vsn-marquee-track" style="display:inline-block;min-width:200%;animation:vsnMarquee ${speed}s linear infinite;">${text} ${text} ${text}</div></div>`;
  }
  if (type === "tabs" || type === "product-tabs") {
    let rows = type === "tabs" ? normalizeStructuredItems("tabs",props).map((item)=>[item.label,item.content]) : [[props.descriptionLabel||"Description", product.description||"Product description"],[props.shippingLabel||"Shipping",props.shippingText||"Shipping information"],[props.returnsLabel||"Returns",props.returnsText||"Return policy"]];
    return `<div data-vsn-id="${id}" class="vsn-tabs" data-vsn-tabs><div style="display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #eee;">${rows.map(([label],i)=>`<button type="button" data-vsn-tab="${i}" class="vsn-tab-button${i===0?' is-active':''}" style="border:0;background:transparent;padding:10px 12px;cursor:pointer;font-weight:600;">${escapeHtml(label)}</button>`).join("")}</div>${rows.map(([,body],i)=>`<div data-vsn-tab-panel="${i}" style="padding:16px 0;${i?'display:none;':''}">${type==='product-tabs' && i===0 && product.descriptionHtml ? sanitizeRichHtml(product.descriptionHtml) : escapeHtml(body)}</div>`).join("")}</div>`;
  }
  if (type === "size-guide") return `<details data-vsn-id="${id}" style="border:1px solid #e5e5e5;border-radius:10px;padding:12px 14px;"><summary style="cursor:pointer;font-weight:600;">${escapeHtml(props.buttonText||"Size guide")}</summary><h4>${escapeHtml(props.heading||"Size guide")}</h4><div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(props.content||"")}</div></details>`;
  if (type === "shipping-info") return `<div data-vsn-id="${id}" style="${typography}"><strong>${escapeHtml(props.heading||"Shipping")}</strong><div style="margin-top:4px;">${escapeHtml(props.text||"")}</div></div>`;
  if (type === "stock-progress") { const max=Math.max(1,Number(props.max||10)); const current=Math.max(0,Math.min(max,Number(props.fallbackStock||5))); return `<div data-vsn-id="${id}" class="vsn-stock-progress"><div style="font-size:13px;font-weight:600;margin-bottom:7px;">${escapeHtml(props.label||"Hurry, low stock")}</div><div style="height:7px;background:#eee;border-radius:999px;overflow:hidden;"><span style="display:block;height:100%;width:${Math.round((current/max)*100)}%;background:var(--vsn-primary,#008060);"></span></div></div>`; }
  if (type === "trust-badges") { const rows=normalizeStructuredItems("trust-badges",props); const cols=Math.max(1,Math.min(4,Number(props.columns||3))); return `<div data-vsn-id="${id}" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap};">${rows.map((item)=>`<div style="padding:12px;border:1px solid #eee;border-radius:10px;text-align:center;"><div style="font-size:20px;">${escapeHtml(item.icon||"")}</div><div style="font-size:12px;font-weight:600;margin-top:5px;">${escapeHtml(item.label||"")}</div></div>`).join("")}</div>`; }
  if (type === "related-collections") { const rows=normalizeStructuredItems("related-collections",props); const cols=Math.max(1,Math.min(4,Number(props.columnsDesktop||props.columns||3))); return `<section data-vsn-id="${id}"><h2>${escapeHtml(props.heading||"Shop related collections")}</h2><div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap};">${rows.map((item)=>`<a href="${escapeAttribute(item.url||'#')}" style="padding:18px;border:1px solid #eee;border-radius:12px;text-decoration:none;color:inherit;font-weight:600;">${item.imageUrl?`<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.label||'')}" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;margin-bottom:8px;">`:""}${escapeHtml(item.label||"")}</a>`).join("")}</div></section>`; }
  if (type === "upsell-products") { const grid=normalizeGridProps(type,props); return `<section data-vsn-id="${id}" class="vsn-product-recommendations vsn-upsell-products" data-vsn-product-id="${escapeAttribute(product.numericId||String(product.id||"").split("/").pop()||"")}" data-vsn-limit="${grid.limit}" data-vsn-columns-desktop="${grid.columnsDesktop}" data-vsn-columns-tablet="${grid.columnsTablet}" data-vsn-columns-mobile="${grid.columnsMobile}" data-vsn-gap="${grid.gap}" data-vsn-show-image="${grid.showImage?"1":"0"}" data-vsn-show-title="${grid.showTitle?"1":"0"}" data-vsn-show-price="${grid.showPrice?"1":"0"}" data-vsn-image-ratio="${escapeAttribute(gridImageRatio(grid.imageRatio))}" data-vsn-recommendation-intent="complementary"><h3>${escapeHtml(props.heading||"Complete your order")}</h3><div class="vsn-product-recommendations-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;"><div style="color:#777;font-size:14px;">Loading…</div></div></section>`; }
  if (type === "recently-viewed") { const grid=normalizeGridProps(type,props); return `<section data-vsn-id="${id}" class="vsn-recently-viewed" data-vsn-limit="${grid.limit}" data-vsn-current-handle="${escapeAttribute(product.handle||"")}" data-vsn-columns-desktop="${grid.columnsDesktop}" data-vsn-columns-tablet="${grid.columnsTablet}" data-vsn-columns-mobile="${grid.columnsMobile}" data-vsn-gap="${grid.gap}" data-vsn-show-image="${grid.showImage?"1":"0"}" data-vsn-show-title="${grid.showTitle?"1":"0"}" data-vsn-show-price="${grid.showPrice?"1":"0"}" data-vsn-image-ratio="${escapeAttribute(gridImageRatio(grid.imageRatio))}"><h3>${escapeHtml(props.heading||"Recently viewed")}</h3><div class="vsn-recently-viewed-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;"></div></section>`; }
  if (type === "sticky-add-to-cart") { const first=product.variants?.[0]; const price=product.price?formatMoney(product.price.amount,product.price.currencyCode):""; return `<div data-vsn-id="${id}" class="vsn-sticky-cart" style="position:sticky;bottom:0;z-index:35;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;background:${escapeAttribute(styles?.background?.color||"#fff")};border-top:1px solid ${escapeAttribute(styles?.border?.color||"#e5e5e5")};box-shadow:0 -8px 30px rgba(0,0,0,.08);"><div><strong>${escapeHtml(product.title||"Product")}</strong>${props.showPrice===false?'':`<div style="font-size:13px;color:#666;">${escapeHtml(price)}</div>`}</div><button type="button" class="vsn-product-add-to-cart" data-vsn-default-variant-id="${escapeAttribute(first?.variantId||'')}" data-vsn-ready-text="${escapeAttribute(props.text||'Add to cart')}" style="border:0;border-radius:8px;padding:11px 18px;background:var(--vsn-button-bg,#111);color:var(--vsn-button-color,#fff);font-weight:600;">${escapeHtml(props.text||"Add to cart")}</button></div>`; }
  if (type === "announcement-bar") { const body=escapeHtml(props.text||""); return `<div data-vsn-id="${id}" class="vsn-announcement-bar" data-vsn-dismissible="${props.dismissible?"1":"0"}" style="position:relative;text-align:center;background:${escapeAttribute(styles?.background?.color||'#111')};color:${escapeAttribute(styles?.typography?.color||'#fff')};padding:${toCssSize(styles?.spacing?.paddingTop,'9px')} ${props.dismissible?'42px':'16px'};font-size:${toCssSize(styles?.typography?.fontSize,'13px')};font-weight:${escapeAttribute(styles?.typography?.fontWeight||'600')};">${props.url?`<a href="${escapeAttribute(props.url)}" style="color:inherit;text-decoration:none;">${body}</a>`:body}${props.dismissible?'<button type="button" class="vsn-announcement-dismiss" aria-label="Dismiss announcement" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;">×</button>':''}</div>`; }
  if (type === "mega-menu") { const rows=normalizeStructuredItems("mega-menu",props); return `<div data-vsn-id="${id}" class="vsn-mega-menu" style="position:relative;${typography}"><button type="button" class="vsn-mega-trigger" aria-expanded="false" style="border:0;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;">${escapeHtml(props.label||"Shop")} ▾</button><div class="vsn-mega-panel" style="display:none;position:absolute;top:100%;left:0;min-width:320px;padding:18px;background:#fff;color:#111;border:1px solid #eee;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.12);z-index:70;">${rows.map((item)=>`<a href="${escapeAttribute(item.url||'#')}" style="display:block;padding:8px 4px;color:inherit;text-decoration:none;">${escapeHtml(item.label||"")}</a>`).join("")}${props.featuredTitle?`<a href="${escapeAttribute(props.featuredUrl||'#')}" style="display:block;margin-top:10px;padding-top:12px;border-top:1px solid #eee;font-weight:700;color:inherit;text-decoration:none;">${escapeHtml(props.featuredTitle)}</a>`:''}</div></div>`; }
  if (type === "header-search") return `<form data-vsn-id="${id}" action="/search" method="get" role="search" style="display:flex;gap:6px;"><input name="q" type="search" placeholder="${escapeAttribute(props.placeholder||'Search products')}" style="min-width:160px;padding:8px 10px;border:1px solid #ddd;border-radius:8px;"><button type="submit" style="padding:8px 11px;border:1px solid #ddd;border-radius:8px;background:#fff;">${escapeHtml(props.buttonLabel||'Search')}</button></form>`;
  if (type === "cart-icon") return `<button data-vsn-id="${id}" type="button" class="vsn-cart-trigger" style="border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;${typography}">${escapeHtml(props.label||'Cart')}${props.showCount===false?'':` (<span class="vsn-cart-count">0</span>)`}</button>`;
  if (type === "account-link") return `<a data-vsn-id="${id}" class="vsn-customer-link vsn-account-link" href="${escapeAttribute(props.url||'/account')}" style="color:inherit;text-decoration:none;${typography}">${escapeHtml(props.label||'Account')}</a>`;
  if (type === "customer-name") { const customer=renderContext?.customer||{}; return `<span data-vsn-id="${id}" class="vsn-customer-name" style="${typography}"><span class="vsn-customer-prefix">${escapeHtml(props.prefix||"Hello, ")}</span><span class="vsn-customer-name-value">${escapeHtml(customer.loggedIn?(customer.name||customer.email||"Customer"):(props.loggedOutText||"Guest"))}</span></span>`; }
  if (["customer-login","customer-logout","customer-orders-link","customer-addresses-link"].includes(type)) { const customer=renderContext?.customer||{}; if(props.hideWhenLoggedIn&&customer.loggedIn)return ""; if(props.hideWhenLoggedOut&&!customer.loggedIn)return ""; return `<a data-vsn-id="${id}" class="vsn-customer-link" href="${escapeAttribute(props.url||'/account')}" style="color:inherit;text-decoration:none;${typography}">${escapeHtml(props.label||"Account")}</a>`; }
  if (type === "localization-switcher") {
    const countries=parseRows(props.countriesText,2); const langs=parseRows(props.languagesText,2);
    return `<form data-vsn-id="${id}" class="vsn-localization-form" action="/localization" method="post" accept-charset="UTF-8" style="display:flex;gap:${toCssSize(styles?.spacing?.gap,'8px')};align-items:center;flex-wrap:wrap;${typography}"><input type="hidden" name="return_to" value=""><input type="hidden" name="form_type" value="localization">${props.showCountry===false?'':`<label>${escapeHtml(props.countryLabel||'Country')} <select name="country_code" style="padding:7px;border:1px solid #ddd;border-radius:8px;">${countries.map(([code,label])=>`<option value="${escapeAttribute(code)}">${escapeHtml(label||code)}</option>`).join('')}</select></label>`}${props.showLanguage===false?'':`<label>${escapeHtml(props.languageLabel||'Language')} <select name="language_code" style="padding:7px;border:1px solid #ddd;border-radius:8px;">${langs.map(([code,label])=>`<option value="${escapeAttribute(code)}">${escapeHtml(label||code)}</option>`).join('')}</select></label>`}<button type="submit" style="padding:7px 10px;border:1px solid #ddd;border-radius:8px;background:#fff;">Apply</button></form>`;
  }
  return "";
}

function renderNavigationMenu(node, props, styles) {
	const items = normalizeStructuredItems("navigation-menu", props).map((item)=>({label:item.label||"",url:item.url||"#"}));
	const align = props.alignment === "left" ? "flex-start" : props.alignment === "center" ? "center" : "flex-end";
	const gap = toCssSize(styles?.spacing?.gap, "22px");
	const typography = contentTypography(styles, { fontSize: "14px", fontWeight: "600", color: "#1a1a1a" });
	return `<nav class="vsn-nav" data-vsn-id="${escapeAttribute(node.id || "")}" data-vsn-mobile="${props.mobileMenu !== false ? "1" : "0"}" style="${typography}">
		<button type="button" class="vsn-nav-toggle" aria-expanded="false" style="display:none;border:1px solid currentColor;background:transparent;color:inherit;padding:8px 12px;border-radius:8px;">${escapeHtml(props.mobileLabel || "Menu")}</button>
		<div class="vsn-nav-links" style="display:flex;justify-content:${align};align-items:center;gap:${gap};flex-wrap:wrap;">
			${items.map((item) => `<a href="${escapeAttribute(item.url)}" style="color:inherit;text-decoration:none;">${escapeHtml(item.label)}</a>`).join("")}
		</div>
	</nav>`;
}

function renderFormWidget(node, props, styles, type, ctx) {
	const newsletter = type === "newsletter-form";
	const inquiry = type === "product-inquiry-form";
	const formType = newsletter ? "newsletter" : inquiry ? "product-inquiry" : "contact";
	const gap = toCssSize(styles?.spacing?.gap, "12px");
	const heading = props.heading || (newsletter ? "Join our newsletter" : inquiry ? "Product inquiry" : "Contact us");
	const submit = props.submitText || (newsletter ? "Subscribe" : "Send message");
	const success = props.successText || (newsletter ? "Thanks for subscribing." : "Thanks. Your message has been received.");
	const error = props.errorText || "Please check the form and try again.";
	return `<form class="vsn-builder-form" data-vsn-id="${escapeAttribute(node.id || "")}" data-vsn-form-type="${formType}" data-vsn-success="${escapeAttribute(success)}" data-vsn-error="${escapeAttribute(error)}" style="display:grid;gap:${gap};max-width:${toCssSize(styles?.size?.maxWidth, "640px")};">
		${heading ? `<h3 style="margin:0;">${escapeHtml(heading)}</h3>` : ""}
		<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;">
		${newsletter ? "" : `<label>Name<input required name="name" type="text" autocomplete="name" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>`}
		<label>${newsletter ? "Email" : "Email"}<input required name="email" type="email" autocomplete="email" placeholder="${escapeAttribute(props.placeholder || "Email address")}" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>
		${!newsletter && props.showPhone !== false ? `<label>Phone<input name="phone" type="tel" autocomplete="tel" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;"></label>` : ""}
		${newsletter ? "" : `<label>Message<textarea required name="message" rows="5" style="display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d9d9d9;border-radius:8px;resize:vertical;"></textarea></label>`}
		<input type="hidden" name="formType" value="${formType}">
		<input type="hidden" name="productHandle" value="${escapeAttribute(ctx?.product?.handle || "")}">
		<button type="submit" style="justify-self:start;padding:11px 18px;border:0;border-radius:8px;background:var(--vsn-button-bg,#1a1a1a);color:var(--vsn-button-color,#fff);font-weight:600;cursor:pointer;">${escapeHtml(submit)}</button>
		<div class="vsn-form-status" role="status" aria-live="polite" style="min-height:1.25em;font-size:13px;"></div>
	</form>`;
}

function renderSearchQueryTitle(node, props, styles, ctx){ const q=ctx?.search?.query||""; const Tag=["h1","h2","h3"].includes(props.tag)?props.tag:"h1"; return `<${Tag} data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-search-query-title" style="${contentTypography(styles,{fontSize:"38px",fontWeight:"700"})}"><span class="vsn-search-query-prefix">${escapeHtml(props.prefix||"Search results for")}</span>${q?` <span class="vsn-search-query-value">“${escapeHtml(q)}”</span>`:""}</${Tag}>`; }
function renderSearchResultCount(node, props, styles, ctx){ const count=Number(ctx?.search?.count||0); return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-search-result-count" style="${contentTypography(styles,{fontSize:"15px",color:"#666"})}"><span class="vsn-search-count-value">${count}</span><span class="vsn-search-count-label">${escapeHtml(count===1?(props.singularText||"result"):(props.pluralText||"results"))}</span></div>`; }
function renderSearchResultsGrid(node, props, styles, ctx) {
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
function renderBlogTitle(node,props,styles,ctx){ const b=ctx?.blog||{}; return `<h1 data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"42px",fontWeight:"700"})}">${escapeHtml(b.title||props.fallbackText||"Blog")}</h1>`; }
function renderBlogDescription(node,props,styles,ctx){ const b=ctx?.blog||{}; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"16px",color:"#4a4a4a",lineHeight:"1.6"})}">${escapeHtml(b.description||props.fallbackText||"")}</div>`; }
function articleCard(item, blogHandle = "", props = {}, styles = {}) {
	const url = item.url || `/blogs/${blogHandle}/${item.handle || ""}`;
	const card = styles?.card || {};
	const image = props.showImage !== false && item.image?.url ? `<img src="${escapeAttribute(item.image.url)}" alt="${escapeAttribute(item.image.altText || item.title || "")}" loading="lazy" style="width:100%;aspect-ratio:${escapeAttribute(gridImageRatio(props.imageRatio || "landscape"))};object-fit:${escapeAttribute(props.imageFit || "cover")};border-radius:${toCssSize(styles?.image?.borderRadius,"8px")};">` : "";
	const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }) : "";
	return `<article class="vsn-article-card" style="background:${escapeAttribute(card.backgroundColor || "transparent")};border:${toCssSize(card.borderWidth,"0px")} solid ${escapeAttribute(card.borderColor || "transparent")};border-radius:${toCssSize(card.borderRadius,"12px")};padding:${toCssSize(card.padding,"0px")};overflow:hidden;"><a href="${escapeAttribute(url)}" style="color:inherit;text-decoration:none;">${image}${props.showTitle === false ? "" : `<h3 class="vsn-article-card-title" style="margin:12px 0 6px;">${escapeHtml(item.title || "")}</h3>`}<div class="vsn-article-card-meta">${props.showDate === false || !date ? "" : `<div class="vsn-article-card-date" style="font-size:12px;color:#777;margin-bottom:5px;">${escapeHtml(date)}</div>`}${props.showAuthor === true && item.author ? `<div class="vsn-article-card-author" style="font-size:12px;color:#777;margin-bottom:5px;">${escapeHtml(item.author)}</div>` : ""}</div>${props.showExcerpt === false ? "" : `<p class="vsn-article-card-excerpt" style="margin:0;color:#666;">${escapeHtml(item.excerpt || "")}</p>`}</a></article>`;
}
function renderBlogArticleGrid(node, props, styles, ctx) {
	const b = ctx?.blog || {};
	const items = b.articles || [];
	const grid=normalizeGridProps("blog-article-grid",props);
	const desktop=grid.columnsDesktop, tablet=grid.columnsTablet, mobile=grid.columnsMobile;
	const id = escapeAttribute(node.id || "");
	const cards = items.slice(0, grid.limit).map((item) => articleCard(item, b.handle, props, styles)).join("");
	return `<style>@media(max-width:749px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${mobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"]{grid-template-columns:repeat(${tablet},minmax(0,1fr))!important}}</style><div data-vsn-id="${id}" class="vsn-blog-article-grid" style="display:grid;grid-template-columns:repeat(${desktop},minmax(0,1fr));gap:${`${grid.gap}px`};">${cards || escapeHtml(grid.emptyText)}</div>`;
}
function renderArticleTitle(node,props,styles,ctx){ const a=ctx?.article||{}; return `<h1 data-vsn-id="${escapeAttribute(node.id||"")}" style="${contentTypography(styles,{fontSize:"46px",fontWeight:"700"})}">${escapeHtml(a.title||props.fallbackText||"Article title")}</h1>`; }
function renderArticleImage(node,props,styles,ctx){ const a=ctx?.article||{}; const media=a.image||{}; const settings=normalizeContextImageProps(props); const src=contextImageUrl(media,settings); if(!src)return ""; const alt=contextImageAlt(media,settings,a.title||"Article image"); const image=`<img loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" data-vsn-id="${escapeAttribute(node.id||"")}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" style="width:${toCssSize(styles?.size?.width,"100%")};height:${toCssSize(styles?.size?.height,"520px")};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${toCssSize(styles?.border?.radius,"12px")};">`; return settings.lightbox?`<a href="${escapeAttribute(media.url||src)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url||src)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${image}</a>`:image; }
function renderArticleContent(node,props,styles,ctx){ const a=ctx?.article||{}; const html=a.contentHtml?sanitizeRichHtml(a.contentHtml):escapeHtml(a.content||props.fallbackText||"").replaceAll("\n","<br>"); return `<article data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-content" style="${contentTypography(styles,{fontSize:"17px",color:"#333",lineHeight:"1.75"})}">${html}</article>`; }
function renderArticleAuthor(node,props,styles,ctx){ const a=ctx?.article||{}; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-author" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${escapeHtml(props.prefix||"By ")}${escapeHtml(a.author||"Author")}</div>`; }

function renderContentIconSvg(name = "star") {
	const icon = String(name || "star").toLowerCase();
	const paths = {
		star: '<path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8z"/>',
		heart: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.4a5.5 5.5 0 0 0-.1-7.8z"/>',
		check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		play: '<path d="M8 5v14l11-7z"/>',
		"arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
		cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.9a2 2 0 0 0 2-1.6L21 8H7"/>',
		user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
		info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
		warning: '<path d="M10.3 3.6L2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
	};
	const body = paths[icon] || paths.star;
	return `<svg class="vsn-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

function renderIconWidget(node, props, styles) {
	const label = String(props.label || props.alt || "").trim();
	return `<span data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-icon-widget"${label ? ` role="img" aria-label="${escapeAttribute(label)}"` : ' aria-hidden="true"'} style="display:inline-flex;align-items:center;justify-content:center;">${renderContentIconSvg(props.name || "star")}</span>`;
}
function renderArticleDate(node,props,styles,ctx){ const a=ctx?.article||{}; let date=""; if(a.publishedAt){const d=new Date(a.publishedAt); date=props.format==="iso"?d.toISOString().slice(0,10):d.toLocaleDateString("en-US",props.format==="short"?{year:"numeric",month:"numeric",day:"numeric"}:props.format==="medium"?{year:"numeric",month:"short",day:"numeric"}:{year:"numeric",month:"long",day:"numeric"});} return `<time data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-date" datetime="${escapeAttribute(a.publishedAt||"")}" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${escapeHtml(date)}</time>`; }
function renderArticleTags(node,props,styles,ctx){ const tags=ctx?.article?.tags||[]; const prefix=props.prefix?`<span class="vsn-article-tags-prefix">${escapeHtml(props.prefix)}</span>`:""; return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-meta vsn-article-tags" style="${contentTypography(styles,{fontSize:"14px",color:"#666"})}">${prefix}${tags.map((tag)=>`<span class="vsn-article-tag">${escapeHtml(tag)}</span>`).join(escapeHtml(props.separator||" · "))}</div>`; }
function renderArticleNavigation(node,props,styles,ctx){ const a=ctx?.article||{}; const prev=a.previous?`<a class="vsn-article-nav-prev" href="${escapeAttribute(a.previous.url)}">← ${escapeHtml(props.previousText||a.previous.title||"Previous article")}</a>`:"<span></span>"; const next=a.next?`<a class="vsn-article-nav-next" href="${escapeAttribute(a.next.url)}">${escapeHtml(props.nextText||a.next.title||"Next article")} →</a>`:"<span></span>"; return `<nav data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-article-navigation" style="display:flex;justify-content:space-between;gap:20px;${getNodeSpacing(styles).margin?`margin:${getNodeSpacing(styles).margin};`:""}">${prev}${next}</nav>`; }
function renderRelatedArticles(node,props,styles,ctx){ const a=ctx?.article||{}; const items=a.related||[]; const grid=normalizeGridProps("related-articles",props); const id=escapeAttribute(node.id||""); return `<section data-vsn-id="${id}" class="vsn-related-articles" style="margin:${getNodeSpacing(styles).margin};"><h2 class="vsn-related-articles-heading">${escapeHtml(props.heading||"Related articles")}</h2><style>@media(max-width:749px){[data-vsn-id="${id}"] .vsn-related-articles-grid{grid-template-columns:repeat(${grid.columnsMobile},minmax(0,1fr))!important}}@media(min-width:750px) and (max-width:989px){[data-vsn-id="${id}"] .vsn-related-articles-grid{grid-template-columns:repeat(${grid.columnsTablet},minmax(0,1fr))!important}}</style><div class="vsn-related-articles-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;">${items.slice(0,grid.limit).map(i=>articleCard(i,a.blogHandle,{...props,...grid},styles)).join("")||escapeHtml(grid.emptyText)}</div></section>`; }

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

	const existingSettings =
		node.settings &&
			typeof node.settings === "object"
			? node.settings
			: {};

	const settings = {
		...existingSettings,
		...props,

		content: {
			...(
				existingSettings.content &&
					typeof existingSettings.content ===
					"object"
					? existingSettings.content
					: {}
			),
			...props,
		},

		style: {
			...(
				existingSettings.style &&
					typeof existingSettings.style ===
					"object"
					? existingSettings.style
					: {}
			),
			...styles,
		},
	};

	const children = Array.isArray(
		node.children,
	)
		? node.children
		: [];

	if (type === "slider" || isNestedSliderType(type)) return renderPhase10Widget(node, props, styles, renderContext);
	if (PHASE10_SERVER_WIDGET_TYPES.has(type)) return renderPhase10Widget(node, props, styles, renderContext);

	switch (type) {
		case "loop":
			return renderLoop(node, props, styles, renderContext);

		case "columns":
			return renderColumns(node, props, styles, children, renderContext);

		case "container":
		case "section":
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

function readPath(source, path) {
	if (!source || !path) return undefined;
	return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], source);
}

function applyDynamicSource(node, renderContext) {
	const dynamic = node?.dynamicSource;
	if (!dynamic?.enabled || !dynamic.source) return node;
	let value;
	if (dynamic.source === "query.search") {
		value = dynamic.fallback || "";
	} else if (dynamic.source === "product.price") {
		const money = renderContext?.product?.price;
		value = money ? formatMoney(money.amount, money.currencyCode) : undefined;
	} else if (dynamic.source === "product.metafield") {
		const namespace = String(dynamic.namespace || "custom");
		const key = String(dynamic.key || "");
		const metafields = renderContext?.product?.metafields?.nodes || renderContext?.product?.metafields || [];
		value = metafields.find((item) => item.namespace === namespace && item.key === key)?.value;
	} else if (dynamic.source === "metaobject.field") {
		const signature = `${dynamic.metaobjectType || ""}|${dynamic.metaobjectId || ""}|${dynamic.key || ""}`;
		value = renderContext?.dynamicMetaobjects?.[signature];
	} else {
		value = readPath(renderContext, dynamic.source);
	}
	if (value == null || value === "") value = dynamic.fallback;
	if (value == null || value === "") return node;
	const target = dynamic.target || "text";
	const props = { ...(node.props || {}) };
	if (target === "src") props.src = String(value);
	else if (target === "url") props.url = String(value);
	else {
		if (["button","announcement-bar"].includes(node.type)) props.text = String(value);
		else if (node.type === "image") props.alt = props.alt || String(value);
		else props.text = String(value);
	}
	return { ...node, props };
}

function conditionRuleMatches(rule = {}, ctx = {}) {
	const name = rule.rule || "always";
	const product = ctx?.product || {};
	const collection = ctx?.collection || {};
	const customer = ctx?.customer || {};
	const value = String(rule.value || "").toLowerCase();
	if (name === "always") return true;
	if (name === "logged-in") return customer.loggedIn === true;
	if (name === "logged-out") return customer.loggedIn !== true;
	const commerceMatch = evaluateCommerceConditionRule(name, rule, ctx); if (commerceMatch !== null) return commerceMatch;
	if (name === "date-after") return !rule.value || Date.now() >= new Date(rule.value).getTime();
	if (name === "date-before") return !rule.value || Date.now() <= new Date(rule.value).getTime();
	// Device, query, market and language are browser-dependent and are finalized by the theme renderer.
	return true;
}

function serverConditionMatches(node, ctx) {
	const c = node?.conditions;
	if (!c?.enabled) return true;
	if (Array.isArray(c.groups) && c.groups.length) {
		const groupResults = c.groups.map((group) => {
			const results = (group.rules || []).map((rule) => conditionRuleMatches(rule, ctx));
			return String(group.operator || "AND").toUpperCase() === "OR" ? results.some(Boolean) : results.every(Boolean);
		});
		return String(c.operator || "AND").toUpperCase() === "OR" ? groupResults.some(Boolean) : groupResults.every(Boolean);
	}
	return conditionRuleMatches(c, ctx);
}

function injectNodeBehavior(html, node) {
	if (!html || typeof html !== "string") return html;
	const c = node?.conditions || {};
	const i = normalizeElementInteractions(node?.interactions || {});
	const d = node?.dynamicSource || {};
	const attrs = [`data-vsn-node-type="${escapeAttribute(node?.type || "unknown")}"`];
	if (node?.meta?.componentId) attrs.push(`data-vsn-component-id="${escapeAttribute(node.meta.componentId)}"`);
	if (node?.meta?.__vsnComponentSlotName) attrs.push(`data-vsn-component-slot="${escapeAttribute(node.meta.__vsnComponentSlotName)}"`);
	if (c.enabled) {
		attrs.push(`data-vsn-condition-rule="${escapeAttribute(c.rule || "always")}"`);
		attrs.push(`data-vsn-condition-key="${escapeAttribute(c.key || "")}"`);
		attrs.push(`data-vsn-condition-value="${escapeAttribute(c.value || "")}"`);
		if (Array.isArray(c.groups) && c.groups.length) attrs.push(`data-vsn-conditions="${escapeAttribute(JSON.stringify({ operator: c.operator || "AND", groups: c.groups }))}"`);
	}
	if (i.entrance && i.entrance !== "none") attrs.push(`data-vsn-entrance="${escapeAttribute(i.entrance)}"`);
	if (i.hover && i.hover !== "none") attrs.push(`data-vsn-hover="${escapeAttribute(i.hover)}"`);
	const styleExit = node?.styles?.effects?.exitAnimation;
	if (styleExit && !["default", "none"].includes(styleExit)) attrs.push(`data-vsn-exit="${escapeAttribute(styleExit)}"`);
	if (i.sticky) {
		const stickyBoundary = ["parent", "column", "section", "page", "custom"].includes(String(i.stickyBoundary || "parent")) ? String(i.stickyBoundary || "parent") : "parent";
		attrs.push('data-vsn-sticky-element="1"');
		attrs.push(`data-vsn-sticky-boundary="${escapeAttribute(stickyBoundary)}"`);
		attrs.push(`data-vsn-sticky-offset="${escapeAttribute(Number.isFinite(Number(i.stickyOffset)) ? Math.max(0, Math.min(1000, Number(i.stickyOffset))) : 12)}"`);
		attrs.push(`data-vsn-sticky-end-offset="${escapeAttribute(Number.isFinite(Number(i.stickyEndOffset)) ? Math.max(0, Math.min(1000, Number(i.stickyEndOffset))) : 0)}"`);
		attrs.push(`data-vsn-sticky-z-index="${escapeAttribute(Number.isFinite(Number(i.stickyZIndex)) ? Math.max(-1, Math.min(2147483000, Number(i.stickyZIndex))) : 20)}"`);
		attrs.push(`data-vsn-sticky-desktop="${i.stickyDesktop === false ? "0" : "1"}"`);
		attrs.push(`data-vsn-sticky-tablet="${i.stickyTablet === false ? "0" : "1"}"`);
		attrs.push(`data-vsn-sticky-mobile="${i.stickyMobile === false ? "0" : "1"}"`);
		if (stickyBoundary === "custom" && typeof i.stickyCustomTarget === "string" && i.stickyCustomTarget.trim()) attrs.push(`data-vsn-sticky-target="${escapeAttribute(i.stickyCustomTarget.trim().slice(0, 256))}"`);
	}
	if (i.parallax) attrs.push('data-vsn-parallax="1"');
	if (Array.isArray(i.timelines) && i.timelines.length) attrs.push(`data-vsn-motion="${escapeAttribute(JSON.stringify({ schemaVersion:i.schemaVersion || 3, timelines:i.timelines }))}"`);
	if (d.enabled && d.source === "query.search") {
		attrs.push(`data-vsn-dynamic-query="${escapeAttribute(d.key || "")}"`);
		attrs.push(`data-vsn-dynamic-target="${escapeAttribute(d.target || "text")}"`);
		attrs.push(`data-vsn-dynamic-fallback="${escapeAttribute(d.fallback || "")}"`);
	}
	if (!attrs.length) return html;
	return html.replace(/^\s*<([a-zA-Z][\w:-]*)\b/, (match) => `${match} ${attrs.join(" ")}`);
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

function productTypographyStyle(styles = {}, defaults = {}) {
	const typography = styles.typography || styles || {};
	return `
		color: ${escapeAttribute(typography.color || defaults.color || "#1a1a1a")};
		font-size: ${toCssSize(typography.fontSize, defaults.fontSize || "16px")};
		font-weight: ${escapeAttribute(typography.fontWeight || defaults.fontWeight || "400")};
		line-height: ${escapeAttribute(typography.lineHeight || defaults.lineHeight || "1.4")};
		text-align: ${escapeAttribute(typography.textAlign || "left")};
	`;
}

function renderProductTitle(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const tag = ["h1","h2","h3","h4","h5","h6"].includes(String(props.tag || "h1")) ? String(props.tag || "h1") : "h1";
	return `<${tag} data-vsn-id="${escapeAttribute(node.id || "")}" style="margin:0;${productTypographyStyle(styles,{fontSize:"42px",fontWeight:"700"})}">${escapeHtml(product.title || props.fallbackText || "Product Title")}</${tag}>`;
}

function renderProductImage(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const media=product.featuredImage||product.images?.[0]||{}; const settings=normalizeContextImageProps(props); const source=contextImageUrl(media,settings) || "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f1f1f1'/%3E%3C/svg%3E"; const alt=contextImageAlt(media,settings,product.title||"Product image");
  const width=toCssSize(styles?.size?.width||styles.width,"100%"); const height=toCssSize(styles?.size?.height||styles.height,"auto"); const radius=toCssSize(styles?.border?.radius||styles.borderRadius,"0px");
  const image=`<img data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-product-main-image" src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" style="display:block;width:${width};height:${height};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${radius};">`;
  return settings.lightbox?`<a href="${escapeAttribute(media.url||source)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(media.url||source)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${image}</a>`:image;
}

function renderProductGallery(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const images=(Array.isArray(product.images)?product.images:[]); const all=images.length?images:(product.featuredImage?[product.featuredImage]:[]); const first=product.featuredImage||all[0]||{}; const settings=normalizeContextImageProps(props); const source=contextImageUrl(first,settings)||first.url||""; const alt=contextImageAlt(first,settings,product.title||"Product image");
  const width=toCssSize(styles?.size?.width||styles.width,"100%"); const height=toCssSize(styles?.size?.height||styles.height,"560px"); const radius=toCssSize(styles?.border?.radius||styles.borderRadius,"12px"); const thumbSize=Math.max(44,Math.min(140,Number(props.thumbnailSize||76))); const thumbGap=Math.max(0,Math.min(40,Number(props.thumbnailGap||10)));
  const thumbSettings={...settings,resolution:props.thumbnailResolution||"320",customWidth:"",customHeight:"",lightbox:false};
  const thumbs=props.showThumbnails===false?"":all.map((image,index)=>{const thumb=contextImageUrl(image,thumbSettings)||image.url||""; const target=contextImageUrl(image,settings)||image.url||""; return `<button type="button" class="vsn-product-gallery-thumb${index===0?" is-active":""}" data-vsn-gallery-src="${escapeAttribute(target)}" data-vsn-gallery-original="${escapeAttribute(image.url||target)}" data-vsn-gallery-alt="${escapeAttribute(contextImageAlt(image,settings,product.title||"Product image"))}" style="width:${thumbSize}px;height:${thumbSize}px;border:1px solid #d9d9d9;border-radius:8px;padding:0;overflow:hidden;background:#fff;cursor:pointer;"><img src="${escapeAttribute(thumb)}" alt="${escapeAttribute(image.altText||"")}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></button>`}).join("");
  const main=`<img class="vsn-product-gallery-main vsn-product-main-image" src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(settings.loading)}" fetchpriority="${escapeAttribute(settings.fetchPriority)}" style="display:block;width:100%;height:${height};object-fit:${escapeAttribute(styles.objectFit||"cover")};border-radius:${radius};">`;
  const visual=settings.lightbox?`<a class="vsn-product-gallery-lightbox" href="${escapeAttribute(first.url||source)}" data-vsn-lightbox="1" data-vsn-lightbox-src="${escapeAttribute(first.url||source)}" data-vsn-lightbox-alt="${escapeAttribute(alt)}">${main}</a>`:main;
  const pos=["top","bottom","left","right"].includes(props.thumbnailPosition)?props.thumbnailPosition:"bottom"; const side=pos==="left"||pos==="right"; const thumbHtml=`<div class="vsn-product-gallery-thumbs" style="display:${props.showThumbnails===false?"none":"flex"};${side?"flex-direction:column;":""}gap:${thumbGap}px;flex-wrap:wrap;">${thumbs}</div>`;
  return `<div data-vsn-id="${escapeAttribute(node.id||"")}" class="vsn-product-gallery is-thumbs-${escapeAttribute(pos)}" style="width:${width};display:${side?"grid":"block"};${side?`grid-template-columns:${pos==="left"?`${thumbSize}px 1fr`:`1fr ${thumbSize}px`};gap:${thumbGap}px;`:""}">${pos==="top"||pos==="left"?thumbHtml:""}${visual}${pos==="bottom"||pos==="right"?thumbHtml:""}</div>`;
}

function renderProductPrice(node, props, styles, renderContext, compare = false) {
	const product = renderContext?.product || {};
	const money = compare ? product.compareAtPrice : product.price;
	if (compare && !money) return "";
	const value = money ? formatMoney(money.amount, money.currencyCode) : (compare ? "" : "—");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="${compare ? "vsn-product-compare-price" : "vsn-product-price"}" data-vsn-prefix="${escapeAttribute(props.prefix || "")}" style="${productTypographyStyle(styles,{fontSize:compare?"18px":"24px",fontWeight:compare?"400":"700",color:compare?"#777777":"#1a1a1a"})}${compare ? "text-decoration:line-through;" : ""}">${escapeHtml(props.prefix || "")}${escapeHtml(value)}</div>`;
}

function renderProductDescription(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const content = product.descriptionHtml || escapeHtml(product.description || props.fallbackText || "Product description").replaceAll("\n","<br>");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-description" style="${productTypographyStyle(styles,{fontSize:"16px",color:"#4a4a4a",lineHeight:"1.6"})}">${content}</div>`;
}

function renderProductMeta(node, props, styles, renderContext, field) {
	const product = renderContext?.product || {};
	const value = field === "sku" ? (product.variants?.[0]?.sku || "—") : (product.vendor || "");
	const prefix = props.prefix ?? (field === "sku" ? "SKU: " : "Vendor: ");
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="${field === "sku" ? "vsn-product-sku" : "vsn-product-vendor"}" data-vsn-prefix="${escapeAttribute(prefix)}" style="${productTypographyStyle(styles,{fontSize:"14px",color:"#666666"})}">${escapeHtml(prefix)}<span class="vsn-product-meta-value">${escapeHtml(value)}</span></div>`;
}

function renderProductAvailability(node, props, styles, renderContext) {
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

function renderProductVariantSelector(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const variants = product.variants || [];
	const currency = product.price?.currencyCode || "USD";
	const options = variants.map((variant) => `<option value="${escapeAttribute(variant.variantId || "")}" data-price="${escapeAttribute(variant.price ?? "")}" data-compare-price="${escapeAttribute(variant.compareAtPrice ?? "")}" data-currency="${escapeAttribute(currency)}" data-sku="${escapeAttribute(variant.sku || "")}" data-available="${variant.availableForSale ? "1" : "0"}" data-image="${escapeAttribute(variant.image?.url || "")}" ${(props.disableSoldOut !== false && !variant.availableForSale) ? "disabled" : ""}>${escapeHtml(variant.title || "Default")}${variant.availableForSale ? "" : " — Sold out"}</option>`).join("");
	const radius = toCssSize(styles?.border?.radius || props.borderRadius, "8px");
	return `<label data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-variant-wrap" style="display:grid;gap:${toCssSize(props.gap,"6px")};">${props.showLabel===false?"":`<span>${escapeHtml(props.label || "Variant")}</span>`}<select class="vsn-product-variant-selector" style="min-height:${toCssSize(props.height,"44px")};border:1px solid ${escapeAttribute(props.borderColor || "#d9d9d9")};border-radius:${radius};padding:8px 10px;background:${escapeAttribute(props.backgroundColor || "#fff")};color:${escapeAttribute(props.textColor || "#1a1a1a")};">${options || '<option value="">Default</option>'}</select></label>`;
}

function renderProductQuantity(node, props, styles) {
	const min=Math.max(1,Number(props.min||1)); const max=Math.max(min,Number(props.max||99)); const step=Math.max(1,Number(props.step||1)); return `<label data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-quantity-wrap" style="display:grid;gap:6px;">${props.showLabel===false?"":`<span>${escapeHtml(props.label || "Quantity")}</span>`}<input class="vsn-product-quantity" type="number" min="${escapeAttribute(min)}" max="${escapeAttribute(max)}" step="${escapeAttribute(step)}" value="${escapeAttribute(min)}" style="width:${toCssSize(props.width,"110px")};min-height:${toCssSize(props.height,"44px")};border:1px solid ${escapeAttribute(props.borderColor || "#d9d9d9")};border-radius:${toCssSize(props.borderRadius,"8px")};padding:8px 10px;"></label>`;
}

function renderProductAction(node, props, styles, renderContext, buyNow = false) {
	const product = renderContext?.product || {};
	const firstAvailable = (product.variants || []).find((variant) => variant.availableForSale) || product.variants?.[0];
	const typography = styles.typography || {};
	const background = styles.background?.color || styles.backgroundColor || (buyNow ? "#008060" : "#1a1a1a");
	const radius = toCssSize(styles.border?.radius || styles.borderRadius, "8px");
	const spacing = styles.spacing || {};
	const padding = `${toCssSize(spacing.paddingTop,"14px")} ${toCssSize(spacing.paddingRight,"22px")} ${toCssSize(spacing.paddingBottom,"14px")} ${toCssSize(spacing.paddingLeft,"22px")}`;
	return `<button type="button" data-vsn-id="${escapeAttribute(node.id || "")}" class="${buyNow ? "vsn-product-buy-now" : "vsn-product-add-to-cart"}" data-vsn-default-variant-id="${escapeAttribute(firstAvailable?.variantId || "")}" data-vsn-ready-text="${escapeAttribute(props.text || (buyNow ? "Buy Now" : "Add to Cart"))}" ${product.availableForSale ? "" : "disabled"} style="display:inline-flex;width:${props.fullWidth ? "100%" : "auto"};align-items:center;justify-content:center;border:${toCssSize(props.borderWidth,"0px")} solid ${escapeAttribute(props.borderColor || "transparent")};border-radius:${radius};background:${escapeAttribute(background)};color:${escapeAttribute(typography.color || "#ffffff")};font-size:${toCssSize(typography.fontSize,"16px")};font-weight:${escapeAttribute(typography.fontWeight || "600")};padding:${padding};cursor:${product.availableForSale ? "pointer" : "not-allowed"};opacity:${product.availableForSale ? "1" : ".55"};">${escapeHtml(props.text || (buyNow ? "Buy Now" : "Add to Cart"))}</button>`;
}

function renderProductMetafield(node, props, styles, renderContext) {
	const product = renderContext?.product || {};
	const namespace = String(props.namespace || "custom");
	const key = String(props.key || "");
	const field = (product.metafields || []).find((item) => item.namespace === namespace && item.key === key);
	const value = field?.value ?? props.emptyText ?? "";
	if (!value && !props.label) return "";
	return `<div data-vsn-id="${escapeAttribute(node.id || "")}" class="vsn-product-metafield" style="${productTypographyStyle(styles,{fontSize:"14px",color:"#4a4a4a"})}">${props.label ? `<strong>${escapeHtml(props.label)}</strong> ` : ""}${escapeHtml(value)}</div>`;
}

function renderProductRecommendations(node, props, styles, renderContext) {
  const product=renderContext?.product||{}; const id=product.numericId||String(product.id||"").split("/").pop(); const grid=normalizeGridProps("product-recommendations",props); const spacing=getNodeSpacing(styles); const nodeId=escapeAttribute(node.id||"");
  return `<section data-vsn-id="${nodeId}" class="vsn-product-recommendations" data-vsn-product-id="${escapeAttribute(id)}" data-vsn-limit="${grid.limit}" data-vsn-columns-desktop="${grid.columnsDesktop}" data-vsn-columns-tablet="${grid.columnsTablet}" data-vsn-columns-mobile="${grid.columnsMobile}" data-vsn-gap="${grid.gap}" data-vsn-show-image="${grid.showImage?"1":"0"}" data-vsn-show-title="${grid.showTitle?"1":"0"}" data-vsn-show-price="${grid.showPrice?"1":"0"}" data-vsn-image-ratio="${escapeAttribute(gridImageRatio(grid.imageRatio))}" data-vsn-recommendation-intent="related" style="margin:${spacing.margin};padding:${spacing.padding};"><h2 style="margin:0 0 18px;font-size:24px;">${escapeHtml(props.heading||"You may also like")}</h2><div class="vsn-product-recommendations-grid" style="display:grid;grid-template-columns:repeat(${grid.columnsDesktop},minmax(0,1fr));gap:${grid.gap}px;"><div style="color:#777;font-size:14px;">Loading recommendations…</div></div></section>`;
}

function renderColumns(node, props, styles, children, renderContext) {
	const columns = Math.max(1, Math.min(6, Number(props.columns || styles.columns || children.length || 2)));
	const gap = toCssSize(styles.gap || styles.grid?.gap, "24px");
	const spacing = getNodeSpacing(styles);
	const content = children.map((child, index) => `<div class="vsn-column-cell" data-vsn-column-cell="1" data-vsn-column-index="${index}" style="min-width:0;align-self:stretch;">${renderNode(child, renderContext)}</div>`).join("");
	return `<div class="vsn-columns" data-vsn-id="${escapeAttribute(node.id || "")}" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gap};width:100%;margin:${spacing.margin};padding:${spacing.padding};">${content}</div>`;
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
	const height = cssSize(style.height, "auto");

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

function responsiveValue(
	value,
	fallback,
) {
	if (
		value &&
		typeof value === "object"
	) {
		const desktop =
			value.desktop ??
			value.value ??
			fallback;

		const unit =
			allowedUnit(value.unit) || "px";

		return `${safeNumber(
			desktop,
			fallback,
		)}${unit}`;
	}

	if (typeof value === "number") {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const text = value.trim();
		if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|vi|vb|svw|svh|svi|svb|lvw|lvh|lvi|lvb|dvw|dvh|dvi|dvb|ch|ex|cap|ic|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i.test(text)) return text;
	}

	return `${fallback}px`;
}

function cssSize(value, fallback) {
	if (
		typeof value === "number"
	) {
		return `${value}px`;
	}

	if (typeof value === "string") {
		const text = value.trim();
		if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return `${text}px`;
		if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|vi|vb|svw|svh|svi|svb|lvw|lvh|lvi|lvb|dvw|dvh|dvi|dvb|ch|ex|cap|ic|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|q|in|pt|pc)$/i.test(text)) return text;
		if (/^(?:auto|none|min-content|max-content|fit-content|content)$/i.test(text)) return text;
		if (/^(?:calc|min|max|clamp|var)\([^;{}]+\)$/i.test(text)) return text;
	}

	if (
		value &&
		typeof value === "object"
	) {
		const number =
			value.desktop ??
			value.value;

		const unit =
			allowedUnit(value.unit) ||
			"px";

		if (
			typeof number === "number"
		) {
			return `${number}${unit}`;
		}
	}

	return fallback;
}

function individualSpacingCss(
	style = {},
) {
	const marginTop = cssSize(
		style.marginTop,
		"0px",
	);

	const marginRight = cssSize(
		style.marginRight,
		"0px",
	);

	const marginBottom = cssSize(
		style.marginBottom,
		"0px",
	);

	const marginLeft = cssSize(
		style.marginLeft,
		"0px",
	);

	const paddingTop = cssSize(
		style.paddingTop,
		"0px",
	);

	const paddingRight = cssSize(
		style.paddingRight,
		"0px",
	);

	const paddingBottom = cssSize(
		style.paddingBottom,
		"0px",
	);

	const paddingLeft = cssSize(
		style.paddingLeft,
		"0px",
	);

	return {
		margin:
			`${marginTop} ` +
			`${marginRight} ` +
			`${marginBottom} ` +
			`${marginLeft}`,

		padding:
			`${paddingTop} ` +
			`${paddingRight} ` +
			`${paddingBottom} ` +
			`${paddingLeft}`,
	};
}

function spacingCss(
	value,
	fallback,
) {
	const fallbackValue =
		typeof fallback === "object"
			? fallback
			: {
				top: fallback,
				right: fallback,
				bottom: fallback,
				left: fallback,
			};

	const spacing =
		value &&
			typeof value === "object"
			? value.desktop || value
			: {};

	const unit =
		allowedUnit(
			spacing.unit ||
			value?.unit,
		) || "px";

	const top = safeNumber(
		spacing.top,
		fallbackValue.top,
	);

	const right = safeNumber(
		spacing.right,
		fallbackValue.right,
	);

	const bottom = safeNumber(
		spacing.bottom,
		fallbackValue.bottom,
	);

	const left = safeNumber(
		spacing.left,
		fallbackValue.left,
	);

	return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
}

function safeNumber(value, fallback) {
	const number = Number(value);

	return Number.isFinite(number)
		? number
		: fallback;
}

function allowedUnit(value) {
	const allowed = new Set([
		"px",
		"em",
		"rem",
		"%",
		"vw",
		"vh",
	]);

	return allowed.has(value)
		? value
		: null;
}

function allowedValue(
	value,
	allowed,
	fallback,
) {
	return allowed.includes(value)
		? value
		: fallback;
}

function safeColor(value, fallback) {
	if (
		typeof value !== "string"
	) {
		return fallback;
	}

	const color = value.trim();

	if (
		/^#[0-9a-f]{3,8}$/i.test(color) ||
		/^rgba?\([0-9.,%\s]+\)$/i.test(
			color,
		) ||
		/^hsla?\([0-9.,%\s]+\)$/i.test(
			color,
		) ||
		color === "transparent"
	) {
		return color;
	}

	return fallback;
}

function safeUrl(value) {
	if (
		typeof value !== "string" ||
		!value.trim()
	) {
		return "#";
	}

	const url = value.trim();

	if (
		url.startsWith("/") ||
		url.startsWith("#") ||
		url.startsWith("mailto:") ||
		url.startsWith("tel:")
	) {
		return url;
	}

	try {
		const parsed = new URL(url);

		if (
			parsed.protocol === "https:" ||
			parsed.protocol === "http:"
		) {
			return url;
		}
	} catch {
		return "#";
	}

	return "#";
}

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
	return escapeHtml(value);
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
