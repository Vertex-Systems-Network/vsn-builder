import { useEffect, useRef } from "react";
import {
	isRouteErrorResponse,
	useFetcher,
	useLoaderData,
	useRouteError,
	useSearchParams,
} from "react-router";
import PageEditor from "../components/editor/PageEditor";
import PolarisIcon from "../components/ui/PolarisIcon";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, getBuilderRole, getRoleActionAccess } from "../utils/builder-permissions.js";
import { canAccessBuilderAction, getBuilderRoleAccess } from "../utils/builder-permissions.server.js";
import { finishObservation, startObservation } from "../utils/observability.server";
import { safeAdminGraphql } from "../utils/admin-graphql.server.js";
import { getWidgetDefinitions, loadWidgetSettings } from "../services/widget-settings.server";
import { serializeLibraryItem } from "../services/library-presets.server";
import { loadEditorTemplateBrowser, loadMerchantLibrary } from "../services/template-browser.server.js";
import { getCustomFontCatalog } from "../services/font-registry.server.js";
import { rebuildThemeAssets, trashTemplateThemeAssets } from "../services/theme-assets.server.js";
import { loadPageLocalization, resolveLocalizedPage, savePageTranslation, syncShopifyPageTranslation } from "../services/localization.server.js";
import { FALLBACK_GOOGLE_FONTS, SYSTEM_FONTS } from "../data/font-catalog.js";
import { FontRegistryProvider } from "../components/editor/fonts/FontRegistryContext";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { getBuilderRuntimeEntitlements } from "../services/builder-runtime-entitlements.server.js";
import { deriveTemplateMetadata, syncTemplateAssignmentRule } from "../services/template-management.server.js";
import { runShopifyLoopQuery } from "../services/query-engine.server.js";
import { normalizeQueryDefinition, querySummary } from "../builder/queryBuilder.js";
import { prepareVsnSdkNodesForSave } from "../sdk/runtime.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";
import { loadCustomWidgets, loadWidgetTemplateMap } from "../services/widget-studio.server.js";
import { registerVisualWidgetDefinitions, visualWidgetCss } from "../sdk/visualWidgets.js";
import {
	COLLABORATION_ROLES,
	acquirePageLock,
	canCollaborate,
	collaborationActorKey,
	createReviewLink,
	extractMentions,
	getBlockingPageLock,
	getCollaborationRole,
	getCollaborationSnapshot,
	releasePageLock,
	setCollaborationRole,
	touchPresence,
} from "../services/collaboration.server.js";
import {
	createShopifyPage,
	getShopifyPage,
	setShopifyPagePublished,
	updateShopifyPage,
} from "../services/shopify-pages.server";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";

ensureBuiltinSdkPlugins();

function safeParseJson(value, fallback = []) {
	try {
		const parsed = JSON.parse(value || "[]");

		return Array.isArray(parsed)
			? parsed
			: fallback;
	} catch {
		return fallback;
	}
}

function safeParseObject(value, fallback = {}) {
	try { const parsed = JSON.parse(String(value || "{}")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}

function parseContent(value) {
	let parsed;

	try {
		parsed = JSON.parse(
			String(value || "[]"),
		);
	} catch {
		throw new Error(
			"Invalid page content.",
		);
	}

	if (!Array.isArray(parsed)) {
		throw new Error(
			"Page content must be an array.",
		);
	}

	return migrateBuilderContent(parsed);
}

function collectComponentUsageFromPages(rows = []) {
	const usage = {};
	const walk = (nodes, page) => {
		for (const node of Array.isArray(nodes) ? nodes : []) {
			if (node?.type === "component-instance" && node?.props?.componentId) {
				const id = String(node.props.componentId);
				const entry = usage[id] || { count: 0, pageIds: new Set(), titles: [] };
				entry.count += 1;
				if (!entry.pageIds.has(page.id)) { entry.pageIds.add(page.id); entry.titles.push(page.title || page.handle || "Page"); }
				usage[id] = entry;
			}
			walk(node?.children || [], page);
		}
	};
	for (const page of rows || []) { let content = []; try { content = migrateBuilderContent(safeParseJson(page.contentJson, [])); } catch {} walk(content, page); }
	return Object.fromEntries(Object.entries(usage).map(([id, entry]) => [id, { count: entry.count, pages: entry.pageIds.size, titles: entry.titles.slice(0, 20) }]));
}

export async function loader({
	request,
	params,
}) {
	const { admin, session } =
		await authenticate.admin(request);
	if (!(await canAccessBuilderAction(db, session, "pages", "view"))) throw new Response("Your role does not have permission to view the visual editor.", { status: 403 });

	const builderRole = getBuilderRole(session);
	const roleAccess = await getBuilderRoleAccess(db, session.shop);
	const pagePermissions = getRoleActionAccess(roleAccess, builderRole).pages || {};
	const observation = startObservation(request, "/app/builder/:id", session.shop);
	void finishObservation(observation, { status: 200 });

	const url = new URL(request.url);

	const previewCollectionHandle =
		String(
			url.searchParams.get("collection") || "",
		)
			.trim()
			.toLowerCase();

	const previewProductHandle =
		String(
			url.searchParams.get("product") || "",
		)
			.trim()
			.toLowerCase();

	const previewBlogHandle = String(url.searchParams.get("blog") || "").trim().toLowerCase();
	const previewArticleHandle = String(url.searchParams.get("article") || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
	const previewSearchQuery = String(url.searchParams.get("query") || "shirt").trim();

	const pageId = String(
		params.id || "",
	);

	if (!pageId) {
		throw new Response(
			"Page ID is required.",
			{
				status: 400,
			},
		);
	}

	const page =
		await db.builderPage.findFirst({
			where: { id: pageId, shop: session.shop, deletedAt: null },
		});

	if (!page) {
		throw new Response(
			"Builder page not found.",
			{
				status: 404,
			},
		);
	}

	let previewBlog = null;
	if (page.template === "blog") {
		let handle = previewBlogHandle || page.resourceHandle || "";
		if (!handle) {
			const firstBlog = await safeAdminGraphql(admin, `#graphql\nquery FirstPreviewBlog { blogs(first:1, sortKey:TITLE){ nodes{ handle } } }`, {}, "first blog preview");
			handle = firstBlog?.blogs?.nodes?.[0]?.handle || "";
		}
		if (handle) {
			const data = await safeAdminGraphql(admin, `#graphql\nquery PreviewBlog($handle:String!){ blogByHandle(handle:$handle){ id title handle articles(first:12, sortKey:PUBLISHED_AT, reverse:true){ nodes{ id title handle excerpt publishedAt author{ name } image{ url altText } } } } }`, { handle }, "blog preview");
			previewBlog = data?.blogByHandle || null;
		}
	}

	let previewArticle = null;
	if (page.template === "article") {
		let resource = previewArticleHandle || page.resourceHandle || "";
		if (!resource) {
			const firstArticle = await safeAdminGraphql(admin, `#graphql\nquery FirstPreviewArticle { blogs(first:1, sortKey:TITLE){ nodes{ handle articles(first:1, sortKey:PUBLISHED_AT, reverse:true){ nodes{ handle } } } } }`, {}, "first article preview");
			const blogNode = firstArticle?.blogs?.nodes?.[0];
			const articleNode = blogNode?.articles?.nodes?.[0];
			if (blogNode?.handle && articleNode?.handle) resource = `${blogNode.handle}/${articleNode.handle}`;
		}
		const [blogHandle, articleHandle] = resource.split("/");
		if (blogHandle && articleHandle) {
			const data = await safeAdminGraphql(admin, `#graphql\nquery PreviewArticle($blog:String!,$query:String!){ blogByHandle(handle:$blog){ title handle articles(first:20, query:$query){ nodes{ id title handle contentHtml excerpt publishedAt tags author{ name } image{ url altText } } } } }`, { blog: blogHandle, query: `handle:${articleHandle}` }, "article preview");
			previewArticle = data?.blogByHandle?.articles?.nodes?.[0] || null;
			if (previewArticle) previewArticle.blogHandle = blogHandle;
		}
	}

	let previewSearch = null;
	if (page.template === "search") {
		const query = previewSearchQuery || "shirt";
		const data = await safeAdminGraphql(admin, `#graphql\nquery PreviewSearch($query:String!){ products(first:12, query:$query){ nodes{ id title handle featuredImage{url altText} priceRangeV2{minVariantPrice{amount currencyCode}} } } }`, { query }, "search preview");
		previewSearch = { query, products: data?.products?.nodes || [] };
	}

	let previewCollection = null;
	try {
	
		if (
			page.template === "collection" &&
			previewCollectionHandle
		) {
			const response =
				await admin.graphql(
					`
				#graphql
				query PreviewCollection(
					$handle: String!
				) {
					collectionByHandle(
						handle: $handle
					) {
						id
						title
						handle
						description
	
						image {
							url
							altText
						}
	
						productsCount {
							count
						}
	
						products(first: 24) {
							nodes {
								id
								title
								handle
								createdAt
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
						}
					}
				}
				`,
					{
						variables: {
							handle:
								previewCollectionHandle,
						},
					},
				);
	
			const result =
				await response.json();
	
			previewCollection =
				result.data?.collectionByHandle ||
				null;
		}
	} catch (error) {
		console.error("VSN loader collection preview failed:", error);
		previewCollection = null;
	}

	let previewProduct = null;
	try {
	
		if (page.template === "product" && previewProductHandle) {
			const response = await admin.graphql(
				`#graphql
				query BuilderPreviewProduct($handle: String!) {
					productByHandle(handle: $handle) {
						id
						title
						handle
						description
						descriptionHtml
						vendor
						productType
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
				{ variables: { handle: previewProductHandle } },
			);
			const result = await response.json();
			previewProduct = result.data?.productByHandle || null;
		}
	} catch (error) {
		console.error("VSN loader product preview failed:", error);
		previewProduct = null;
	}

	let collections = [];
	try {
	
		if (page.template === "collection") {
			const response =
				await admin.graphql(`
				#graphql
				query BuilderPreviewCollections {
					collections(
						first: 100
						sortKey: TITLE
					) {
						nodes {
							id
							title
							handle
	
							image {
								url
								altText
							}
	
							productsCount {
								count
							}
						}
					}
				}
			`);
	
			const result =
				await response.json();
	
			collections =
				result.data?.collections?.nodes || [];
		}
	} catch (error) {
		console.error("VSN loader collections list failed:", error);
		collections = [];
	}

	let products = [];
	try {
	
		if (page.template === "product") {
			const response = await admin.graphql(`
				#graphql
				query BuilderPreviewProducts {
					products(first: 100, sortKey: TITLE) {
						nodes { id title handle }
					}
				}
			`);
			const result = await response.json();
			products = result.data?.products?.nodes || [];
		}
	} catch (error) {
		console.error("VSN loader products list failed:", error);
		products = [];
	}

	let headers = [];
	let footers = [];
	let reusableSections = [];
	try {
		const globalPages = await db.builderPage.findMany({
			where: {
				shop: session.shop,
				deletedAt: null,
				template: { in: ["header", "footer", "section"] },
			},
			orderBy: { updatedAt: "desc" },
		});
		const normalizeBuilderAsset = (item) => ({
			id: item.id,
			title: item.title,
			status: item.status,
			isDefault: item.isDefault,
			content: migrateBuilderContent(safeParseJson(item.contentJson, [])),
			publishedContent: item.publishedJson ? migrateBuilderContent(safeParseJson(item.publishedJson, [])) : [],
		});
		headers = globalPages.filter((item) => item.template === "header").map(normalizeBuilderAsset);
		footers = globalPages.filter((item) => item.template === "footer").map(normalizeBuilderAsset);
		reusableSections = globalPages.filter((item) => item.template === "section").map(normalizeBuilderAsset);
	} catch (error) {
		console.error("VSN reusable/global template list failed:", error);
	}

	const runtimeEntitlements = await getBuilderRuntimeEntitlements(db, session.shop);
	const builderSetting = await db.builderShopSetting.findUnique({ where: { shop: session.shop } });
	let designTokens = {};
	try { designTokens = JSON.parse(builderSetting?.designTokensJson || "{}"); } catch { designTokens = {}; }

	let enabledWidgetIds = getWidgetDefinitions().map((widget) => widget.id);
	try {
		const widgetSettings = await loadWidgetSettings(admin);
		enabledWidgetIds = widgetSettings.widgets.filter((widget) => widget.enabled).map((widget) => widget.id);
	} catch (error) {
		console.error("VSN editor widget settings lookup failed:", error);
	}

	const customWidgets = await loadCustomWidgets(db, session.shop).catch((error)=>{ console.error("VSN custom widget load failed:",error); return []; });
	registerVisualWidgetDefinitions(customWidgets);
	enabledWidgetIds = [...new Set([...enabledWidgetIds, ...customWidgets.map((row)=>row.type)])];
	const widgetTemplates = await loadWidgetTemplateMap(db, session.shop).catch(()=>({}));
	const widgetPlatform = { customWidgets, templates:widgetTemplates, customCss:visualWidgetCss(customWidgets) };

	let fontCatalog = { custom: [], google: FALLBACK_GOOGLE_FONTS, system: SYSTEM_FONTS };
	try { fontCatalog.custom = await getCustomFontCatalog(db, session.shop); } catch (error) { console.error("VSN custom font catalog load failed:", error); }

	const serverRevisions = await db.builderRevision.findMany({
		where: { shop: session.shop, pageId: page.id },
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	let libraryItems = [];
	try { libraryItems = await loadMerchantLibrary(db, session.shop); } catch (error) { console.error("VSN builder library lookup failed:", error); }

	let componentUsage = {};
	try {
		if (libraryItems.some((item) => item.kind === "component")) {
			const usagePages = await db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null }, select: { id: true, title: true, handle: true, contentJson: true } });
			componentUsage = collectComponentUsageFromPages(usagePages);
		}
	} catch (error) { console.error("VSN component dependency graph lookup failed:", error); }

	let collaboration = { presence: [], comments: [], reviewLinks: [], lock: null, branches: [], activity: [], workflowStatus: page.workflowStatus || "draft" };
	let collaborationActor = null;
	if (runtimeEntitlements.collaborationEnabled) {
		try {
			const role = await getCollaborationRole(db, session);
			await touchPresence(db, { session, pageId: page.id, role });
			const snapshot = await getCollaborationSnapshot(db, { shop: session.shop, pageId: page.id });
			const origin = new URL(request.url).origin;
			collaboration = {
				...snapshot,
				workflowStatus: page.workflowStatus || "draft",
				comments: snapshot.comments.map((item) => ({ ...item, mentions: safeParseJson(item.mentionsJson, []) })),
				reviewLinks: snapshot.reviewLinks.map((item) => ({ ...item, url: `${origin}/review/${item.token}` })),
				activity: snapshot.activity.map((item) => ({ ...item, summary: (() => { try { const parsed = JSON.parse(item.details || "{}"); return parsed.summary || parsed.label || parsed.name || ""; } catch { return ""; } })() })),
			};
			collaborationActor = {
				key: collaborationActorKey(session),
				name: builderActor(session),
				role,
				roleLabel: COLLABORATION_ROLES.find((item) => item.key === role)?.label || role,
				permissions: {
					edit: canCollaborate(role, "edit"),
					save: canCollaborate(role, "save"),
					lock: canCollaborate(role, "lock"),
					requestReview: canCollaborate(role, "request_review"),
					approve: canCollaborate(role, "approve"),
					publish: canCollaborate(role, "publish"),
					reviewLink: canCollaborate(role, "review_link"),
					branch: canCollaborate(role, "branch"),
					labelRevision: canCollaborate(role, "label_revision"),
					assignRole: canCollaborate(role, "assign_role"),
				},
			};
		} catch (error) { console.error("VSN collaboration loader failed:", error); }
	}

	let localization = { enabled: false, config: { baseLocale: "en", locales: [], markets: [], catalogErrors: [] }, translations: [], pageVersion: Number(page.version || 1) };
	let editorPageContent = migrateBuilderContent(safeParseJson(page.contentJson, []));
	if (runtimeEntitlements.localizationEnabled) {
		try {
			localization = await loadPageLocalization(db, { shop: session.shop, page, admin });
			const previewLocale = String(url.searchParams.get("language") || "").trim();
			const previewMarketKey = String(url.searchParams.get("market") || "*").trim() || "*";
			if (url.searchParams.get("preview") === "true" && (previewLocale || previewMarketKey !== "*")) {
				const localizedPreview = await resolveLocalizedPage(db, { shop: session.shop, page, elements: editorPageContent, locale: previewLocale, marketKey: previewMarketKey });
				editorPageContent = localizedPreview.elements;
				localization = { ...localization, preview: { enabled: true, locale: localizedPreview.locale || previewLocale, marketKey: previewMarketKey, overrides: localizedPreview.overrides || {}, seo: localizedPreview.seo || {}, direction: localizedPreview.direction || "ltr" } };
			}
		} catch (error) { console.warn("VSN localization loader warning:", error instanceof Error ? error.message : error); }
	}

	return {
		builderRole,
		pagePermissions,
		designTokens,
		serverRevisions,
		page: {
			...page,
			content: editorPageContent,
		},
		featureFlags: runtimeEntitlements.featureFlags,
		entitlements: { collaboration: runtimeEntitlements.collaboration, localization: runtimeEntitlements.localization },
		collaboration,
		collaborationActor,
		localization,

		collections,
		products,
		headers,
		footers,
		reusableSections,
		libraryItems,
		componentUsage,

		previewCollection,
		previewProduct,
		previewBlog,
		previewArticle,
		previewSearch,
		shop: session.shop,
		enabledWidgetIds,
		widgetPlatform,
		fontCatalog,
	};
}

export async function action({
	request,
	params,
}) {
  assertTrustedMutationRequest(request);
	const { admin, session } =
		await authenticate.admin(request);
	if (!(await canAccessBuilderAction(db, session, "pages", "view"))) throw new Response("Your role does not have permission to view the visual editor.", { status: 403 });

	const builderRole = getBuilderRole(session);
	const builderActorName = builderActor(session);
	const rebuildPublishedAssets = async () => {
		try {
			return await rebuildThemeAssets({ admin, session, db });
		} catch (error) {
			console.warn("VSN theme asset rebuild warning:", error);
			return { success: false, error: error instanceof Error ? error.message : "Frontend asset rebuild failed." };
		}
	};

	const pageId = String(
		params.id || "",
	);

	if (!pageId) {
		return Response.json(
			{
				success: false,
				error:
					"Page ID is required.",
			},
			{
				status: 400,
			},
		);
	}

	const page = await db.builderPage.findFirst({
		where: { id: pageId, shop: session.shop, deletedAt: null },
	});
	if (!page) return Response.json({ success:false, error:"Builder page not found." }, { status:404 });

	const formData =
		await request.formData();

	const intent = String(
		formData.get("intent") ||
		"save",
	);

	const runtimeEntitlements = await getBuilderRuntimeEntitlements(db, session.shop);
	const collaborationRole = runtimeEntitlements.collaborationEnabled ? await getCollaborationRole(db, session) : null;
	const collaborationAudit = async (action, details = null) => db.builderAuditLog.create({ data: { shop: session.shop, pageId, actor: builderActorName, role: collaborationRole || builderRole, action, details: details ? JSON.stringify(details) : null } });
	const collaborationResponse = async (extra = {}) => {
		const currentPage = await db.builderPage.findFirst({ where: { id: pageId, shop: session.shop, deletedAt: null }, select: { workflowStatus: true } });
		const snapshot = await getCollaborationSnapshot(db, { shop: session.shop, pageId });
		const origin = new URL(request.url).origin;
		return Response.json({
			success: true,
			intent,
			collaboration: {
				...snapshot,
				workflowStatus: currentPage?.workflowStatus || "draft",
				comments: snapshot.comments.map((item) => ({ ...item, mentions: safeParseJson(item.mentionsJson, []) })),
				reviewLinks: snapshot.reviewLinks.map((item) => ({ ...item, url: `${origin}/review/${item.token}` })),
				activity: snapshot.activity.map((item) => ({ ...item, summary: (() => { try { const parsed = JSON.parse(item.details || "{}"); return parsed.summary || parsed.label || parsed.name || ""; } catch { return ""; } })() })),
			},
			...extra,
		});
	};

	if (intent.startsWith("localization-")) {
		if (!runtimeEntitlements.localizationEnabled) return Response.json({ success:false, intent, error: runtimeEntitlements.localization.allowed ? "Localization & Shopify Markets is disabled by the Phase 11 feature flag." : runtimeEntitlements.localization.message, code: runtimeEntitlements.localization.allowed ? "VSN_FEATURE_DISABLED" : runtimeEntitlements.localization.code, entitlement: runtimeEntitlements.localization }, { status: runtimeEntitlements.localization.allowed ? 404 : 403 });
		if (!(await canAccessBuilderAction(db, session, "pages", "edit"))) return Response.json({ success:false, intent, error:"Your role cannot edit localization." }, { status:403 });
		if (intent === "localization-catalog-refresh") {
			const localization = await loadPageLocalization(db, { shop: session.shop, page, admin });
			return Response.json({ success:true, intent, localization });
		}
		if (intent === "localization-save") {
			try {
				const translation = await savePageTranslation(db, { shop:session.shop, page, locale:String(formData.get("locale")||""), marketKey:String(formData.get("marketKey")||"*"), overrides:safeParseObject(formData.get("overrides"),{}), seo:safeParseObject(formData.get("seo"),{}), status:String(formData.get("status")||"draft") });
				await db.builderAuditLog.create({ data:{ shop:session.shop, pageId, actor:builderActorName, role:builderRole, action:"localization.saved", details:JSON.stringify({ locale:translation.locale, marketKey:translation.marketKey, status:translation.status, summary:`${translation.locale} · ${translation.marketKey}` }) } });
				return Response.json({ success:true, intent, translation });
			} catch (error) { return Response.json({ success:false, intent, error:error instanceof Error?error.message:"Localization could not be saved." }, { status:400 }); }
		}
		if (intent === "localization-native-sync") {
			const translationId = String(formData.get("translationId")||"");
			const row = await db.builderPageTranslation.findFirst({ where:{ id:translationId, shop:session.shop, pageId } });
			if (!row) return Response.json({ success:false, intent, error:"Translation record not found." }, { status:404 });
			const translation = { id:row.id, locale:row.locale, marketKey:row.marketKey, seo:safeParseObject(row.seoJson,{}) };
			const config = await db.builderLocalizationConfig.findUnique({ where:{ shop:session.shop } });
			let market = null; try { const parsed = JSON.parse(config?.marketsJson || "[]"); market = Array.isArray(parsed) ? parsed.find((item)=>String(item?.handle||item?.key||item?.id||"")===translation.marketKey) || null : null; } catch {}
			try {
				const sync = await syncShopifyPageTranslation({ admin, db, shop:session.shop, page, translation, market });
				return Response.json({ success:true, intent, translationId, nativeSyncedAt:new Date().toISOString(), sync });
			} catch (error) { return Response.json({ success:false, intent, error:error instanceof Error?error.message:"Shopify translation sync failed." }, { status:400 }); }
		}
	}

	if (intent.startsWith("collab-") || ["comment-create","comment-resolve","workflow-review","workflow-approve","workflow-draft","lock-acquire","lock-release","review-link-create","review-link-revoke","branch-create","branch-apply","role-assign","revision-label"].includes(intent)) {
		if (!runtimeEntitlements.collaborationEnabled) return Response.json({ success: false, intent, error: runtimeEntitlements.collaboration.allowed ? "Collaboration & Review is disabled by the Phase 10 feature flag." : runtimeEntitlements.collaboration.message, code: runtimeEntitlements.collaboration.allowed ? "VSN_FEATURE_DISABLED" : runtimeEntitlements.collaboration.code, entitlement: runtimeEntitlements.collaboration }, { status: runtimeEntitlements.collaboration.allowed ? 404 : 403 });
		const collabPage = page;

		if (intent === "collab-heartbeat") {
			await touchPresence(db, { session, pageId, role: collaborationRole, selectedElementId: String(formData.get("selectedElementId") || "").trim() || null });
			return collaborationResponse();
		}

		if (intent === "comment-create") {
			if (!canCollaborate(collaborationRole, "comment")) return Response.json({ success:false, intent, error:"Your collaboration role cannot comment." }, {status:403});
			const body = String(formData.get("body") || "").trim().slice(0, 5000);
			if (!body) return Response.json({ success:false, intent, error:"Comment cannot be empty." }, {status:400});
			const mentions = extractMentions(body);
			const elementId = String(formData.get("elementId") || "").trim() || null;
			await db.builderComment.create({ data: { shop:session.shop, pageId, elementId, authorKey:collaborationActorKey(session), authorName:builderActorName, authorRole:collaborationRole, body, mentionsJson:JSON.stringify(mentions) } });
			await collaborationAudit("comment.created", { summary: elementId ? "Element feedback added" : "Page feedback added", mentions });
			return collaborationResponse();
		}

		if (intent === "comment-resolve") {
			if (!canCollaborate(collaborationRole, "resolve_comment")) return Response.json({ success:false, intent, error:"Your collaboration role cannot resolve comments." }, {status:403});
			const commentId = String(formData.get("commentId") || "");
			const comment = await db.builderComment.findFirst({ where:{ id:commentId, shop:session.shop, pageId } });
			if (!comment) return Response.json({success:false,intent,error:"Comment not found."},{status:404});
			await db.builderComment.update({ where:{id:comment.id}, data:{resolvedAt:new Date(), resolvedBy:builderActorName} });
			await collaborationAudit("comment.resolved", { summary: comment.body.slice(0, 100) });
			return collaborationResponse();
		}

		if (["workflow-review","workflow-approve","workflow-draft"].includes(intent)) {
			const next = intent === "workflow-review" ? "review" : intent === "workflow-approve" ? "approved" : "draft";
			const required = intent === "workflow-approve" ? "approve" : "request_review";
			if (!canCollaborate(collaborationRole, required)) return Response.json({success:false,intent,error:`Your ${collaborationRole} role cannot perform this workflow action.`},{status:403});
			await db.builderPage.update({ where:{id:pageId}, data:{workflowStatus:next} });
			const actionName = next === "review" ? "workflow.review_requested" : next === "approved" ? "workflow.approved" : "workflow.returned_to_draft";
			await collaborationAudit(actionName, { summary: `Workflow changed to ${next}` });
			return collaborationResponse({ workflowStatus: next });
		}

		if (intent === "lock-acquire") {
			if (!canCollaborate(collaborationRole, "lock")) return Response.json({success:false,intent,error:"Your role cannot lock pages."},{status:403});
			const result = await acquirePageLock(db, { session, pageId, role:collaborationRole });
			if (!result.ok) return Response.json({success:false,intent,error:result.error,lock:result.lock},{status:423});
			await collaborationAudit("page.locked", { summary: "Page lock acquired" });
			return collaborationResponse();
		}

		if (intent === "lock-release") {
			const result = await releasePageLock(db, { session, pageId, force:canCollaborate(collaborationRole,"assign_role") });
			if (!result.ok) return Response.json({success:false,intent,error:result.error},{status:403});
			await collaborationAudit("page.unlocked", { summary: "Page lock released" });
			return collaborationResponse();
		}

		if (intent === "review-link-create") {
			if (!canCollaborate(collaborationRole, "review_link")) return Response.json({success:false,intent,error:"Your role cannot create review links."},{status:403});
			const created = await createReviewLink(db, { request, session, pageId, label:String(formData.get("label")||"Review"), days:Math.max(1,Number(formData.get("days")||7)) });
			await collaborationAudit("review_link.created", { summary: created.label || "Review link" });
			return collaborationResponse({ createdReviewLink: created });
		}

		if (intent === "review-link-revoke") {
			if (!canCollaborate(collaborationRole, "review_link")) return Response.json({success:false,intent,error:"Your role cannot revoke review links."},{status:403});
			const reviewLinkId = String(formData.get("reviewLinkId") || "");
			await db.builderReviewLink.updateMany({ where:{id:reviewLinkId,shop:session.shop,pageId}, data:{revokedAt:new Date()} });
			await collaborationAudit("review_link.revoked", { summary: "Review link revoked" });
			return collaborationResponse();
		}

		if (intent === "branch-create") {
			if (!canCollaborate(collaborationRole, "branch")) return Response.json({success:false,intent,error:"Your role cannot create branches."},{status:403});
			const name = String(formData.get("name") || "").trim().slice(0,80);
			if (!name) return Response.json({success:false,intent,error:"Branch name is required."},{status:400});
			const latestRevision = await db.builderRevision.findFirst({where:{shop:session.shop,pageId},orderBy:{createdAt:"desc"},select:{id:true}});
			try { await db.builderBranch.create({data:{shop:session.shop,pageId,name,contentJson:collabPage.contentJson||"[]",baseRevisionId:latestRevision?.id||null,createdBy:builderActorName}}); }
			catch { return Response.json({success:false,intent,error:"A branch with this name already exists."},{status:409}); }
			await collaborationAudit("branch.created", { name, summary: name });
			return collaborationResponse();
		}

		if (intent === "branch-apply") {
			if (!canCollaborate(collaborationRole, "branch")) return Response.json({success:false,intent,error:"Your role cannot apply branches."},{status:403});
			const branchId = String(formData.get("branchId")||"");
			const branch = await db.builderBranch.findFirst({where:{id:branchId,shop:session.shop,pageId}});
			if (!branch) return Response.json({success:false,intent,error:"Branch not found."},{status:404});
			const blockingLock = await getBlockingPageLock(db,{session,pageId});
			if (blockingLock) return Response.json({success:false,intent,error:`Page is locked by ${blockingLock.ownerName}.`},{status:423});
			const updated = await db.builderPage.update({where:{id:pageId},data:{contentJson:branch.contentJson,version:{increment:1},workflowStatus:"draft"}});
			await db.$transaction([db.builderRevision.create({data:{shop:session.shop,pageId,title:`Branch: ${branch.name}`,contentJson:branch.contentJson,kind:"branch",label:branch.name,parentRevisionId:branch.baseRevisionId,createdBy:builderActorName}}),db.builderAuditLog.create({data:{shop:session.shop,pageId,actor:builderActorName,role:collaborationRole,action:"branch.applied",details:JSON.stringify({name:branch.name,summary:branch.name})}})]);
			return collaborationResponse({ reloadEditor:true, version:updated.version });
		}

		if (intent === "role-assign") {
			if (!canCollaborate(collaborationRole, "assign_role")) return Response.json({success:false,intent,error:"Only a Publisher can assign collaboration roles."},{status:403});
			const actorKey = String(formData.get("actorKey")||"").trim().toLowerCase();
			const role = String(formData.get("role")||"");
			if (!actorKey) return Response.json({success:false,intent,error:"Actor is required."},{status:400});
			await setCollaborationRole(db,{shop:session.shop,actorKey,role});
			await db.builderPresence.updateMany({where:{shop:session.shop,pageId,actorKey},data:{collaborationRole:role}});
			await collaborationAudit("collaboration.role_assigned",{summary:`${actorKey} → ${role}`});
			return collaborationResponse();
		}

		if (intent === "revision-label") {
			if (!canCollaborate(collaborationRole, "label_revision")) return Response.json({success:false,intent,error:"Your role cannot label revisions."},{status:403});
			const revisionId=String(formData.get("revisionId")||""); const label=String(formData.get("label")||"").trim().slice(0,80);
			await db.builderRevision.updateMany({where:{id:revisionId,shop:session.shop,pageId},data:{label:label||null}});
			await collaborationAudit("revision.labeled",{label,summary:label||"Label cleared"});
			return collaborationResponse({ revisionId, label });
		}
	}

	if (intent === "library-list" || intent === "library-browser") {
		const browser = await loadEditorTemplateBrowser(db, session.shop);
		return Response.json(intent === "library-list" ? { success:true, intent, items:browser.items } : { success:true, intent, ...browser });
	}

	if (intent === "save-template") {
		if (!(await canAccessBuilderAction(db, session, "pages", "edit"))) return Response.json({ success:false, error:"Your role cannot save templates." }, {status:403});
		const title = String(formData.get("title") || "Saved template").trim().slice(0,120) || "Saved template";
		let templateContent; try { templateContent = parseContent(formData.get("content")); } catch(error) { return Response.json({success:false,error:error instanceof Error?error.message:"Invalid template content."},{status:400}); }
		const item = await db.builderLibraryItem.create({ data: { shop: session.shop, title, kind: "page", category: "Page Templates", templateType: page.template || "page", syncMode: "local", contentJson: JSON.stringify(templateContent), source:"local", createdBy: builderActorName } });
		return Response.json({ success:true, intent, item: serializeLibraryItem(item), message:"Template saved successfully." });
	}

	if (intent === "delete-page") {
		if (!(await canAccessBuilderAction(db, session, "pages", "delete"))) return Response.json({ success:false, error:"Your role cannot move templates to Trash." }, {status:403});
		const existing = await db.builderPage.findFirst({ where:{ id:pageId, shop:session.shop, deletedAt:null } });
		if (!existing) return Response.json({success:false,error:"Builder page not found or already trashed."},{status:404});
		const warnings = [];
		try {
			if (existing.shopifyPageId) {
				try { await setShopifyPagePublished({ admin, shopifyPageId: existing.shopifyPageId, isPublished:false }); }
				catch (error) { warnings.push(`Shopify page could not be hidden: ${error instanceof Error ? error.message : "unknown error"}`); }
			}
			await db.builderPage.update({ where:{id:pageId}, data:{deletedAt:new Date()} });
			const assetResult = await trashTemplateThemeAssets({ admin, session, pageId, fallbackFiles: [] });
			await db.builderPage.update({ where:{id:pageId}, data:{trashedAssetsJson:JSON.stringify(assetResult.files || [])} });
			if (!assetResult.success && assetResult.error) warnings.push(`Generated asset cleanup: ${assetResult.error}`);
			await db.builderAuditLog.create({data:{shop:session.shop,pageId,actor:builderActorName,role:builderRole,action:"template.trashed",details:JSON.stringify({assets:assetResult.files||[],warnings})}}).catch(()=>{});
			return Response.json({success:true,intent,message:warnings.length?"Template moved to Trash with warnings.":"Template moved to Trash. Generated CSS/JS removed.",warnings});
		} catch (error) {
			console.error("VSN editor trash error:", error);
			return Response.json({ success:false, intent, error:error instanceof Error ? error.message : "Could not move template to Trash." }, {status:500});
		}
	}

	if (["save", "publish"].includes(intent)) {
		const resourceAction = intent === "publish" ? "publish" : "edit";
		if (!(await canAccessBuilderAction(db, session, "pages", resourceAction))) {
			return Response.json({ success: false, error: `Your VSN role cannot ${intent} templates.` }, { status: 403 });
		}
		if (runtimeEntitlements.collaborationEnabled) {
			const collaborationPermission = intent === "publish" ? "publish" : "save";
			if (!canCollaborate(collaborationRole, collaborationPermission)) {
				return Response.json({ success: false, error: `Your ${collaborationRole} collaboration role cannot ${intent} templates.` }, { status: 403 });
			}
		}
	}

	if (intent === "query-preview") {
		let definition;
		try { definition = normalizeQueryDefinition(JSON.parse(String(formData.get("query") || "{}"))); }
		catch { return Response.json({ success:false, intent, error:"Invalid Loop query definition." }, {status:400}); }
		const result = await runShopifyLoopQuery({ admin, definition, context: {
			productHandle: String(formData.get("productHandle") || "").trim(),
			collectionHandle: String(formData.get("collectionHandle") || "").trim(),
		} });
		return Response.json({ ...result, intent, summary: querySummary(definition) }, { status: result.success ? 200 : 200 });
	}

	if (intent === "preview-collection") {
		const handle = String(
			formData.get("handle") || "",
		)
			.trim()
			.toLowerCase();

		if (!handle) {
			return Response.json(
				{
					success: false,
					error:
						"Collection handle is required.",
				},
				{
					status: 400,
				},
			);
		}

		try {
			const response =
				await admin.graphql(
					`
				#graphql
				query BuilderPreviewCollection(
					$handle: String!
				) {
					collectionByHandle(
						handle: $handle
					) {
						id
						title
						handle
						description

						image {
							url
							altText
						}

						productsCount {
							count
						}

						products(first: 24) {
							nodes {
								id
								title
								handle
								createdAt
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
						}
					}
				}
				`,
					{
						variables: {
							handle,
						},
					},
				);

			const result =
				await response.json();

			const collection =
				result.data
					?.collectionByHandle;

			if (!collection) {
				return Response.json(
					{
						success: false,
						error:
							"Collection not found.",
					},
					{
						status: 404,
					},
				);
			}

			return Response.json({
				success: true,
				intent:
					"preview-collection",
				collection,
			});
		} catch (error) {
			console.error(
				"VSN preview collection error:",
				error,
			);

			return Response.json(
				{
					success: false,
					error:
						"Could not load collection preview.",
				},
				{
					status: 500,
				},
			);
		}
	}

	if (intent === "preview-product") {
		const handle = String(formData.get("handle") || "").trim().toLowerCase();
		if (!handle) {
			return Response.json({ success: false, error: "Product handle is required." }, { status: 400 });
		}

		try {
			const response = await admin.graphql(
				`#graphql
				query BuilderPreviewProductAction($handle: String!) {
					productByHandle(handle: $handle) {
						id title handle description descriptionHtml vendor productType
						featuredImage { url altText width height }
						images(first: 12) { nodes { url altText width height } }
						priceRangeV2 { minVariantPrice { amount currencyCode } }
						compareAtPriceRange { minVariantCompareAtPrice { amount currencyCode } }
						variants(first: 100) {
							nodes { id title sku availableForSale price compareAtPrice image { url altText width height } selectedOptions { name value } }
						}
						metafields(first: 30) { nodes { namespace key type value } }
					}
				}
				`,
				{ variables: { handle } },
			);
			const result = await response.json();
			const product = result.data?.productByHandle;
			if (!product) return Response.json({ success: false, error: "Product not found." }, { status: 404 });
			return Response.json({ success: true, intent: "preview-product", product });
		} catch (error) {
			console.error("VSN preview product error:", error);
			return Response.json({ success: false, error: "Could not load product preview." }, { status: 500 });
		}
	}

	const title =
		String(
			formData.get("title") ||
			"Untitled page",
		).trim() || "Untitled page";

	let content;

	try {
		content = parseContent(
			formData.get("content"),
		);
	} catch (error) {
		return Response.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Invalid page content.",
			},
			{
				status: 400,
			},
		);
	}

	if (["save", "publish"].includes(intent)) {
		try {
			content = await prepareVsnSdkNodesForSave(content, { shop: session.shop, pageId: page.id, actor: builderActorName, intent });
		} catch (error) {
			return Response.json({ success:false, intent, error:error instanceof Error ? error.message : "A plugin rejected this save." }, { status:422 });
		}
	}

	const contentJson =
		JSON.stringify(content);
	const templateMetadata = deriveTemplateMetadata({ page: { ...page, title }, content });
	if (["save", "publish"].includes(intent) && runtimeEntitlements.collaborationEnabled) {
		const blockingLock = await getBlockingPageLock(db, { session, pageId });
		if (blockingLock) return Response.json({ success:false, locked:true, intent, lock:blockingLock, error:`This page is locked by ${blockingLock.ownerName}.` }, {status:423});
		if (intent === "publish" && !["approved","published"].includes(page.workflowStatus || "draft")) return Response.json({ success:false, workflowConflict:true, intent, error:"Approve this page before publishing." }, {status:409});
	}
	const clientVersion = Math.max(0, Number(formData.get("version") ?? page.version ?? 1));
	if (["save", "publish"].includes(intent) && Number(page.version || 1) !== clientVersion) {
		const autosave = formData.get("autosave") === "1";
		return Response.json({ success: false, conflict: true, autosaveConflict: autosave, intent, serverVersion: Number(page.version || 1), error: autosave ? "Autosave paused because a newer server version exists. Reload or review collaboration activity before continuing." : "This template was changed by another editor. Reload the latest version before saving." }, { status: 409 });
	}
	const syncTemplateRule = () => syncTemplateAssignmentRule(db, { shop: session.shop, page, content });

	if (intent === "save") {
		const updatedPage =
			await db.builderPage.update({
				where: {
					id: page.id,
				},
				data: {
					title,
					contentJson,
					templateImage: templateMetadata.templateImage,
					seoScore: templateMetadata.seoScore,
					version: { increment: 1 },

					// Published page ko save karne par
					// dobara draft mat banao.
					status:
						page.status ||
						"draft",
					workflowStatus: ["approved", "published"].includes(page.workflowStatus || "draft") ? "draft" : (page.workflowStatus || "draft"),
				},
			});

		await syncTemplateRule();
		const autosave = formData.get("autosave") === "1";
		await db.$transaction([
			db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: autosave ? "autosave" : "save", createdBy: builderActorName } }),
			db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: autosave ? "template.autosaved" : "template.saved" } }),
		]);
		const staleRevisions = await db.builderRevision.findMany({ where: { shop: session.shop, pageId: updatedPage.id }, orderBy: { createdAt: "desc" }, skip: 75, select: { id: true } });
		if (staleRevisions.length) await db.builderRevision.deleteMany({ where: { id: { in: staleRevisions.map((item) => item.id) } } });

		return Response.json({
			success: true,
			intent: "save",
			status: updatedPage.status,
			pageId: updatedPage.id,
			version: updatedPage.version,
			message:
				"Draft saved successfully.",
		});
	}

	if (intent !== "publish") {
		return Response.json(
			{
				success: false,
				error:
					"Unsupported action.",
			},
			{
				status: 400,
			},
		);
	}

	try {
		if (page.template === "index") {
			const updatedPage =
				await db.builderPage.update({
					where: {
						id: page.id,
					},
					data: {
						title,
						contentJson,
						templateImage: templateMetadata.templateImage,
						seoScore: templateMetadata.seoScore,
						publishedJson: contentJson,
						version: { increment: 1 },
						publishedVersion: { increment: 1 },
						status: "published",
						workflowStatus: "published",
						shopifyPageId: null,
						shopifyPageUrl: "/",
						publishedAt: new Date(),
						scheduledAt: null,
					},
				});

			
			await syncTemplateRule();
			await db.$transaction([
				db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: "publish", createdBy: builderActorName } }),
				db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: "template.published" } }),
			]);
			const assetBuild = await rebuildPublishedAssets();

			return Response.json({
				success: true,
				intent: "publish",
				status: "published",
						workflowStatus: "published",
				assetBuild,
				pageId: updatedPage.id,
			version: updatedPage.version,
				template: "index",
				storefrontPath: "/",
				storefrontUrl: `https://${session.shop}/`,
				message: "Home page template published successfully.",
			});
		}

		if (page.template === "collection") {
			if (!page.isDefault && !page.resourceHandle) {
				return Response.json(
					{ success: false, error: "This specific collection template is not assigned to a Shopify collection." },
					{ status: 400 },
				);
			}
			const collectionPath =
				!page.isDefault &&
					page.resourceHandle
					? `/collections/${page.resourceHandle}`
					: "/collections/all";

			const updatedPage =
				await db.builderPage.update({
					where: {
						id: page.id,
					},
					data: {
						title,
						contentJson,
						templateImage: templateMetadata.templateImage,
						seoScore: templateMetadata.seoScore,
						publishedJson: contentJson,
						version: { increment: 1 },
						publishedVersion: { increment: 1 },
						status: "published",
						workflowStatus: "published",
						shopifyPageId: null,
						shopifyPageUrl: collectionPath,
						publishedAt: new Date(),
						scheduledAt: null,
					},
				});

			
			await syncTemplateRule();
			await db.$transaction([
				db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: "publish", createdBy: builderActorName } }),
				db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: "template.published" } }),
			]);
			const assetBuild = await rebuildPublishedAssets();

			return Response.json({
				success: true,
				intent: "publish",
				status: "published",
						workflowStatus: "published",
				assetBuild,
				pageId: updatedPage.id,
			version: updatedPage.version,
				template: "collection",
				isDefault: updatedPage.isDefault,
				resourceHandle:
					updatedPage.resourceHandle,
				storefrontPath: collectionPath,
				storefrontUrl:
					`https://${session.shop}${collectionPath}`,
				message: updatedPage.isDefault
					? "Default collection template published successfully."
					: "Specific collection template published successfully.",
			});
		}

		if (page.template === "product") {
			if (!page.isDefault && !page.resourceHandle) {
				return Response.json(
					{ success: false, error: "This specific product template is not assigned to a Shopify product." },
					{ status: 400 },
				);
			}
			const productPath = !page.isDefault && page.resourceHandle
				? `/products/${page.resourceHandle}`
				: null;

			const updatedPage = await db.builderPage.update({
				where: { id: page.id },
				data: {
					title,
					contentJson,
					templateImage: templateMetadata.templateImage,
					seoScore: templateMetadata.seoScore,
					publishedJson: contentJson,
					version: { increment: 1 },
					publishedVersion: { increment: 1 },
					status: "published",
						workflowStatus: "published",
					shopifyPageId: null,
					shopifyPageUrl: productPath,
					publishedAt: new Date(),
					scheduledAt: null,
				},
			});

			
			await syncTemplateRule();
			await db.$transaction([
				db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: "publish", createdBy: builderActorName } }),
				db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: "template.published" } }),
			]);
			const assetBuild = await rebuildPublishedAssets();

			return Response.json({
				success: true,
				intent: "publish",
				status: "published",
						workflowStatus: "published",
				assetBuild,
				pageId: updatedPage.id,
			version: updatedPage.version,
				template: "product",
				isDefault: updatedPage.isDefault,
				resourceHandle: updatedPage.resourceHandle,
				storefrontPath: productPath,
				storefrontUrl: productPath ? `https://${session.shop}${productPath}` : null,
				message: updatedPage.isDefault
					? "Default product template published successfully."
					: "Specific product template published successfully.",
			});
		}

		if (["search", "blog", "article", "header", "footer", "section", "cart", "404", "password", "customer-account", "customer-login", "customer-register", "customer-order", "customer-addresses", "popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element"].includes(page.template)) {
			if (["blog", "article"].includes(page.template) && !page.isDefault && !page.resourceHandle) {
				return Response.json({ success:false, error:`This specific ${page.template} template is not assigned.` }, { status:400 });
			}
			let storefrontPath = null;
			if (page.template === "search") storefrontPath = "/search";
			if (page.template === "blog" && !page.isDefault) storefrontPath = `/blogs/${page.resourceHandle}`;
			if (page.template === "article" && !page.isDefault) storefrontPath = `/blogs/${page.resourceHandle}`;
			if (page.template === "cart") storefrontPath = "/cart";
			if (page.template === "password") storefrontPath = "/password";
			if (page.template === "customer-account") storefrontPath = "/account";
			if (page.template === "customer-login") storefrontPath = "/account/login";
			if (page.template === "customer-register") storefrontPath = "/account/register";
			if (page.template === "customer-addresses") storefrontPath = "/account/addresses";
			if (page.template === "customer-order") storefrontPath = "/account/orders";
			const updatedPage = await db.builderPage.update({ where:{ id:page.id }, data:{ title, contentJson, templateImage:templateMetadata.templateImage, seoScore:templateMetadata.seoScore, publishedJson:contentJson, version:{increment:1}, publishedVersion:{increment:1}, status:"published",workflowStatus:"published", shopifyPageId:null, shopifyPageUrl:storefrontPath, publishedAt:new Date(), scheduledAt:null } });
			
			await syncTemplateRule();
			await db.$transaction([
				db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: "publish", createdBy: builderActorName } }),
				db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: "template.published" } }),
			]);
			const assetBuild = await rebuildPublishedAssets();

			return Response.json({ success:true, intent:"publish", status:"published",workflowStatus:"published", assetBuild, pageId:updatedPage.id,
			version: updatedPage.version, template:page.template, isDefault:updatedPage.isDefault, resourceHandle:updatedPage.resourceHandle, storefrontPath, storefrontUrl: storefrontPath ? `https://${session.shop}${storefrontPath}` : null, message:`${page.template} template published successfully.` });
		}

		let shopifyPage = null;
		let existingShopifyPage = null;

		if (page.shopifyPageId) {
			existingShopifyPage =
				await getShopifyPage({
					admin,
					shopifyPageId:
						page.shopifyPageId,
				});
		}

		if (existingShopifyPage) {
			shopifyPage =
				await updateShopifyPage({
					admin,
					shopifyPageId:
						existingShopifyPage.id,
					builderPageId:
						page.id,
					title,
					handle: page.handle,
				});
		} else {
			shopifyPage =
				await createShopifyPage({
					admin,
					builderPageId:
						page.id,
					title,
					handle: page.handle,
				});
		}

		const storefrontPath =
			`/pages/${shopifyPage.handle}`;

		const updatedPage =
			await db.builderPage.update({
				where: {
					id: page.id,
				},
				data: {
					title,
					contentJson,
					templateImage: templateMetadata.templateImage,
					seoScore: templateMetadata.seoScore,
					publishedJson:
						contentJson,
					version: { increment: 1 },
					publishedVersion: { increment: 1 },
					status: "published",
						workflowStatus: "published",

					shopifyPageId:
						shopifyPage.id,

					shopifyPageUrl:
						storefrontPath,

					publishedAt:
						new Date(),
					scheduledAt: null,
				},
			});

		
			await syncTemplateRule();
			await db.$transaction([
				db.builderRevision.create({ data: { shop: session.shop, pageId: updatedPage.id, title: updatedPage.title, contentJson, kind: "publish", createdBy: builderActorName } }),
				db.builderAuditLog.create({ data: { shop: session.shop, pageId: updatedPage.id, actor: builderActorName, role: builderRole, action: "template.published" } }),
			]);
			const assetBuild = await rebuildPublishedAssets();

			return Response.json({
			success: true,
			intent: "publish",
			status: "published",
						workflowStatus: "published",
			assetBuild,
			pageId: updatedPage.id,
			version: updatedPage.version,
			shopifyPageId:
				shopifyPage.id,
			handle:
				shopifyPage.handle,
			storefrontPath,
			storefrontUrl:
				`https://${session.shop}${storefrontPath}`,
			message:
				page.shopifyPageId
					? "Shopify page updated successfully."
					: "Shopify page created successfully.",
		});
	} catch (error) {
		console.error(
			"VSN publish error:",
			error,
		);

		return Response.json(
			{
				success: false,
				intent: "publish",
				error:
					error instanceof Error
						? error.message
						: "Page publication failed.",
			},
			{
				status: 500,
			},
		);
	}
}

export default function BuilderRoute() {
	const {
		page,
		pagePermissions = {},
		collections = [],
		products = [],
		headers = [],
		footers = [],
		reusableSections = [],
		libraryItems = [],
		componentUsage = {},
		previewCollection = null,
		previewProduct = null,
		previewBlog = null,
		previewArticle = null,
		previewSearch = null,
		shop = "",
		designTokens = {},
		serverRevisions = [],
		featureFlags = {},
		collaboration = {},
		collaborationActor = null,
		localization = {},
		enabledWidgetIds = [],
		widgetPlatform = {},
		fontCatalog = { custom: [], google: [], system: [] },
	} = useLoaderData();

	registerVisualWidgetDefinitions(widgetPlatform.customWidgets || []);

	const fetcher =
		useFetcher();
	const versionRef = useRef(Number(page.version || 1));
	useEffect(() => {
		if (fetcher.data?.success && Number.isFinite(Number(fetcher.data?.version))) versionRef.current = Number(fetcher.data.version);
	}, [fetcher.data]);

	const [searchParams] =
		useSearchParams();

	const previewMode =
		searchParams.get(
			"preview",
		) === "true";

	const openLibraryOnLoad = searchParams.get("new") === "1";
	const openLocalizationOnLoad = searchParams.get("localization") === "1";

	const saving =
		fetcher.state !== "idle";

	function savePage({
		title,
		elements,
		publish = false,
		autosave = false,
	}) {
		fetcher.submit(
			{
				intent: publish
					? "publish"
					: "save",
				title,
				content:
					JSON.stringify(elements),
				version: String(versionRef.current),
				autosave: autosave ? "1" : "0",
			},
			{
				method: "post",
			},
		);
	}

	return (
		<FontRegistryProvider initialCatalog={fontCatalog}>
		<PageEditor
			key={page.id}
			page={page}
			pagePermissions={pagePermissions}
			featureFlags={featureFlags}
			initialCollaboration={collaboration}
			collaborationActor={collaborationActor}
			initialLocalization={localization}
			designTokens={designTokens}
			serverRevisions={serverRevisions}
			shop={shop}
			enabledWidgetIds={enabledWidgetIds}
			widgetPlatform={widgetPlatform}
			collections={collections}
			products={products}
			headers={headers}
			footers={footers}
			reusableSections={reusableSections}
			libraryItems={libraryItems}
			componentUsage={componentUsage}
			previewCollection={previewCollection}
			previewProduct={previewProduct}
			previewBlog={previewBlog}
			previewArticle={previewArticle}
			previewSearch={previewSearch}
			initialElements={
				page.content
			}
			previewMode={
				previewMode
			}
			openLibraryOnLoad={openLibraryOnLoad}
			openLocalizationOnLoad={openLocalizationOnLoad}
			saving={saving}
			saveResult={
				fetcher.data
			}
			onSave={({
				title,
				elements,
				autosave = false,
			}) => {
				savePage({
					title,
					elements,
					publish: false,
					autosave,
				});
			}}
			onPublish={({
				title,
				elements,
			}) => {
				savePage({
					title,
					elements,
					publish: true,
				});
			}}
			onBack={() => {
				const params = new URLSearchParams(window.location.search);
				if (params.get("appWindow") === "1" && window.parent && window.parent !== window) {
					window.parent.postMessage({ type: "vsn:close-editor" }, window.location.origin);
					return;
				}
				["appWindow", "preview", "collection", "product", "blog", "article", "query"].forEach((key) => params.delete(key));
				params.set("embedded", "1");
				window.location.assign(`/app/pages?${params.toString()}`);
			}}
		/>
		</FontRegistryProvider>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	const status = isRouteErrorResponse(error) ? error.status : 500;
	const message = isRouteErrorResponse(error)
		? String(error.data || error.statusText || "Builder request failed.")
		: error instanceof Error
			? error.message
			: "The builder could not be loaded.";
	return (
		<div className="min-h-screen bg-[#f6f6f7] p-8">
			<div className="mx-auto max-w-xl rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-sm">
				<p className="text-xs font-semibold uppercase tracking-wide text-[#b42318]">Builder error {status}</p>
				<h1 className="mt-2 text-xl font-semibold text-[#202223]">This template could not be opened</h1>
				<p className="mt-2 break-words text-sm text-[#6d7175]">{message}</p>
				<div className="mt-5 flex gap-2">
					<button type="button" onClick={() => window.location.reload()} className="vsn-home-button vsn-home-button-primary"><PolarisIcon type="reset" size="small" />Retry</button>
					<button type="button" onClick={() => { const params = new URLSearchParams(window.location.search); ["appWindow","preview","collection","product","blog","article","query"].forEach((key) => params.delete(key)); params.set("embedded", "1"); window.location.assign(`/app/pages?${params.toString()}`); }} className="vsn-home-button vsn-home-button-secondary"><PolarisIcon type="arrow-left" size="small" />Back to templates</button>
				</div>
			</div>
		</div>
	);
}
