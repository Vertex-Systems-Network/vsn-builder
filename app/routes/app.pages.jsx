import { redirect, useFetcher, useLoaderData, useNavigate, useLocation } from "react-router";
import { useCallback, useEffect, useState } from "react";

import Dashboard from "../components/Dashboard";
import { BUILDER_PANEL_IDS } from "../config/builder-panels.js";
import BuilderPanelHost from "../components/BuilderPanelHost";
import { useVsnConfirm } from "../components/ui/VsnConfirmProvider";
import CreatePageModal from "../components/CreatePageModal";
import { authenticate } from "../shopify.server";
import db from "../db.server.js";
import { builderActor, getBuilderRole, getRoleActionAccess } from "../utils/builder-permissions.js";
import { canAccessBuilderAction, getBuilderRoleAccess } from "../utils/builder-permissions.server.js";
import { finishObservation, startObservation } from "../utils/observability.server";
import { getQuotaDecision } from "../services/entitlements.server.js";
import { handleBulkTemplateAction } from "../services/template-dashboard-actions.server.js";
import {
	deleteShopifyPage,
	setShopifyPagePublished,
	updateShopifyPage,
} from "../services/shopify-pages.server";
import { restoreTemplateThemeAssets, trashTemplateThemeAssets } from "../services/theme-assets.server.js";
import {
	loadTemplateTableData,
	serializeTemplateRow,
} from "../services/template-management.server.js";
import { preloadBuilderPanels, dispatchBuilderPanelAction, loadBackupPanel } from "../services/builder-panels.server.js";
import { VSN_BASELINE } from "../config/baseline.js";
import { importPagePackage } from "../services/page-transfer.server.js";
import { makePagePackage } from "../utils/page-transfer.js";
import { assertTrustedMutationRequest } from "../utils/request-security.server.js";
import { loadTemplatesViewSettings, saveTemplatesViewSettings } from "../services/templates-view-settings.server.js";

const PRODUCTS_QUERY = `#graphql
	query GetBuilderProducts($first: Int!) {
		products(first: $first, sortKey: TITLE) {
			nodes { id title handle }
		}
	}
`;

const BLOGS_QUERY = `#graphql
	query GetBuilderBlogs($first: Int!) {
		blogs(first: $first, sortKey: TITLE) {
			nodes { id title handle }
		}
	}
`;

const WORKSPACE_ONLY_TEMPLATES = new Set(["popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element"]);
const BUILDER_PANEL_ACTION_PATHS = new Set([
	"/app/marketplace", "/app/brand-kits", "/app/campaigns", "/app/experiments",
	"/app/floating-elements", "/app/fonts", "/app/svg-assets", "/app/motion-library", "/app/form-submissions",
	"/app/form-settings", "/app/control-center", "/app/plugins",
]);

export function shouldRevalidate({ formAction, defaultShouldRevalidate }) {
	if (formAction) {
		try {
			const path = new URL(formAction, "https://vsn.local").pathname;
			if (BUILDER_PANEL_ACTION_PATHS.has(path) || path.startsWith("/app/builder-panel/")) return false;
		} catch {}
	}
	return defaultShouldRevalidate;
}

const COLLECTIONS_QUERY = `#graphql
	query GetBuilderCollections($first: Int!) {
		collections(
			first: $first
			sortKey: TITLE
		) {
			nodes {
				id
				title
				handle
			}
		}
	}
`;

export async function loader({ request }) {
	const { admin, session } =
		await authenticate.admin(request);
	if (!(await canAccessBuilderAction(db, session, "pages", "view"))) {
		throw new Response("Your role does not have permission to view builder pages.", { status: 403 });
	}
	const builderRole = getBuilderRole(session);
	const roleAccess = await getBuilderRoleAccess(db, session.shop);
	const permissions = getRoleActionAccess(roleAccess, builderRole).pages || {};
	const requestUrl = new URL(request.url);
	if (requestUrl.searchParams.get("panelDownload") === "backups" && requestUrl.searchParams.get("download") === "1") {
		return loadBackupPanel(request.clone());
	}
	const observation = startObservation(request, "/app/pages", session.shop);
	void finishObservation(observation, { status: 200 });

	if (requestUrl.searchParams.get("mode") === "export") {
		const exportId = String(requestUrl.searchParams.get("exportId") || "");
		const exportPage = exportId ? await db.builderPage.findFirst({ where: { id: exportId, shop: session.shop } }) : null;
		if (!exportPage) return Response.json({ ok: false, error: "Template not found." }, { status: 404 });
		const exportSections = await db.builderPage.findMany({ where: { shop: session.shop, deletedAt: null, template: "section" } });
		return Response.json({ ok: true, package: makePagePackage(exportPage, exportSections, VSN_BASELINE.version) });
	}

	const tableData = await loadTemplateTableData(db, session.shop, requestUrl);
	if (requestUrl.searchParams.get("mode") === "table") return tableData;
	const openPageId = String(requestUrl.searchParams.get("open") || "");
	const openPage = openPageId
		? serializeTemplateRow(await db.builderPage.findFirst({ where: { id: openPageId, shop: session.shop } }))
		: null;

	// Shopify resource lookups must never take the whole Templates screen down.
	// Missing scopes / transient Admin API errors now degrade to empty pickers.
	let collections = [];
	let products = [];
	let blogs = [];

	try {
		const collectionsResponse = await admin.graphql(
			COLLECTIONS_QUERY,
			{ variables: { first: 100 } },
		);
		const collectionsJson = await collectionsResponse.json();
		if (collectionsJson.errors?.length) {
			console.error("VSN collections picker GraphQL errors:", collectionsJson.errors);
		} else {
			collections = collectionsJson.data?.collections?.nodes || [];
		}
	} catch (error) {
		console.error("VSN collections picker failed:", error);
	}


	try {
		const blogsResponse = await admin.graphql(BLOGS_QUERY, { variables: { first: 100 } });
		const blogsJson = await blogsResponse.json();
		if (blogsJson.errors?.length) console.error("VSN blogs picker GraphQL errors:", blogsJson.errors);
		else blogs = blogsJson.data?.blogs?.nodes || [];
	} catch (error) {
		console.error("VSN blogs picker failed:", error);
	}

	try {
		const productsResponse = await admin.graphql(
			PRODUCTS_QUERY,
			{ variables: { first: 100 } },
		);
		const productsJson = await productsResponse.json();
		if (productsJson.errors?.length) {
			console.error("VSN products picker GraphQL errors:", productsJson.errors);
		} else {
			products = productsJson.data?.products?.nodes || [];
		}
	} catch (error) {
		console.error("VSN products picker failed:", error);
	}

	const [panelData, templatesViewSettings] = await Promise.all([preloadBuilderPanels(request), loadTemplatesViewSettings(db, session.shop)]);

	return {
		shop: session.shop,
		builderRole,
		permissions,
		panelData,
		blogs: blogs.map((blog) => ({ id: blog.id, title: blog.title, handle: blog.handle })),
		products: products.map((product) => ({ id: product.id, title: product.title, handle: product.handle })),

		collections: collections.map(
			(collection) => ({
				id: collection.id,
				title: collection.title,
				handle: collection.handle,
			}),
		),

		pages: tableData.records,
		trash: [],
		tableData,
		openPage,
		templatesViewSettings,
	};
}

export async function action({ request }) {
  assertTrustedMutationRequest(request);
	const { admin, session } =
		await authenticate.admin(request);
	if (!(await canAccessBuilderAction(db, session, "pages", "view"))) {
		throw new Response("Your role does not have permission to view builder pages.", { status: 403 });
	}
	const builderRole = getBuilderRole(session);
	const builderActorName = builderActor(session);

	const formData =
		await request.formData();

	const panel = String(formData.get("panel") || "");
	if (panel) {
		const forwarded = new FormData();
		for (const [key, value] of formData.entries()) {
			if (key !== "panel") forwarded.append(key, value);
		}
		const forwardedHeaders = new Headers(request.headers);
		forwardedHeaders.delete("content-type");
		forwardedHeaders.delete("content-length");
		const forwardedRequest = new Request(request.url, {
			method: "POST",
			headers: forwardedHeaders,
			body: forwarded,
		});
		const panelResult = await dispatchBuilderPanelAction(panel, forwardedRequest);
		if (panelResult) return panelResult;
	}

	const intent = String(
		formData.get("intent") || "",
	);

	if (intent === "save-template-view-settings") {
		let payload = {};
		try { payload = JSON.parse(String(formData.get("settings") || "{}")); }
		catch { return Response.json({ success:false, error:"Template view settings are invalid." }, { status:400 }); }
		const settings = await saveTemplatesViewSettings(db, session.shop, payload);
		return Response.json({ success:true, intent, settings });
	}

	const pageId = String(
		formData.get("pageId") || "",
	);

	const title = String(
		formData.get("title") || "Untitled page",
	).trim();

	const requestedTemplate = String(
		formData.get("template") || "page",
	);

	const template = [
		"page", "index", "collection", "product",
		"search", "blog", "article", "header", "footer", "section",
		"cart", "404", "password",
		"customer-account", "customer-login", "customer-register",
		"customer-order", "customer-addresses",
		"popup", "modal", "drawer", "flyout", "announcement-overlay", "floating-element",
	].includes(requestedTemplate)
		? requestedTemplate
		: "page";

	const isDefault =
		String(
			formData.get("isDefault") ||
			"false",
		) === "true";

	const resourceId =
		String(
			formData.get("resourceId") || "",
		).trim() || null;

	const resourceHandle =
		String(
			formData.get(
				"resourceHandle",
			) || "",
		)
			.trim()
			.toLowerCase() || null;


	if (intent === "import") {
		if (!(await canAccessBuilderAction(db, session, "pages", "import"))) return Response.json({ success:false, error:"Your role cannot import templates." }, { status:403 });
		let payload; try { payload=JSON.parse(String(formData.get("payload")||"{}")); } catch { return Response.json({success:false,error:"Invalid VSN page package JSON."},{status:400}); }
		try {
			const result=await importPagePackage({db,shop:session.shop,payload,actor:builderActorName,role:builderRole});
			return Response.json({success:true,intent:"import",pageId:result.created.id,message:`Page package imported as a draft${result.dependencies?` with ${result.dependencies} reusable section dependenc${result.dependencies===1?"y":"ies"}`:""}.`});
		} catch (error) { return Response.json({success:false,error:error instanceof Error?error.message:"Page package import failed."},{status:400}); }
	}

	/*
	 * CREATE PAGE
	 */
	if (intent === "create") {
		if (!(await canAccessBuilderAction(db, session, "pages", "create"))) return Response.json({ success: false, error: "Your role cannot create templates." }, { status: 403 });
		const entitlement = await getQuotaDecision(db, session.shop, "pages");
		if (!entitlement.allowed) return Response.json({ success: false, error: entitlement.message, code: entitlement.code, entitlement }, { status: 403 });
		const finalTitle =
			title || "Untitled page";

		// A specific template without a Shopify resource is malformed and later
		// causes confusing 400/404 storefront behavior. Fail early with a clear error.
		if (["collection", "product", "blog", "article"].includes(template) && !isDefault) {
			if (!resourceId || !resourceHandle) {
				return Response.json(
					{ success: false, error: `Select a Shopify ${template} before creating a specific template.` },
					{ status: 400 },
				);
			}
		}

		if (
			template === "index" &&
			isDefault
		) {
			const existingHome =
				await db.builderPage.findFirst({
					where: {
						shop: session.shop,
						deletedAt: null,
						template: "index",
						isDefault: true,
					},
				});

			if (existingHome) {
				return Response.json({ success: true, intent: "create", pageId: existingHome.id, existing: true });
			}
		}

		if (
			template === "collection" &&
			isDefault
		) {
			const existingDefaultCollection =
				await db.builderPage.findFirst({
					where: {
						shop: session.shop,
						deletedAt: null,
						template: "collection",
						isDefault: true,
						resourceId: null,
					},
				});

			if (existingDefaultCollection) {
				return Response.json({ success: true, intent: "create", pageId: existingDefaultCollection.id, existing: true });
			}
		}

		if (
			template === "collection" &&
			!isDefault &&
			resourceId
		) {
			const existingSpecificCollection =
				await db.builderPage.findFirst({
					where: {
						shop: session.shop,
						deletedAt: null,
						template: "collection",
						isDefault: false,
						resourceId,
					},
				});

			if (existingSpecificCollection) {
				return Response.json({ success: true, intent: "create", pageId: existingSpecificCollection.id, existing: true });
			}
		}

		if (template === "product" && isDefault) {
			const existingDefaultProduct = await db.builderPage.findFirst({
				where: { shop: session.shop, deletedAt: null, template: "product", isDefault: true, resourceId: null },
			});
			if (existingDefaultProduct) return Response.json({ success: true, intent: "create", pageId: existingDefaultProduct.id, existing: true });
		}

		if (template === "product" && !isDefault && resourceId) {
			const existingSpecificProduct = await db.builderPage.findFirst({
				where: { shop: session.shop, deletedAt: null, template: "product", isDefault: false, resourceId },
			});
			if (existingSpecificProduct) return Response.json({ success: true, intent: "create", pageId: existingSpecificProduct.id, existing: true });
		}

		if (["search", "blog", "article", "header", "footer", "cart", "404", "password", "customer-account", "customer-login", "customer-register", "customer-order", "customer-addresses"].includes(template) && isDefault) {
			const existingGenericDefault = await db.builderPage.findFirst({ where: { shop: session.shop, deletedAt: null, template, isDefault: true } });
			if (existingGenericDefault) return Response.json({ success: true, intent: "create", pageId: existingGenericDefault.id, existing: true });
		}

		if (["blog", "article"].includes(template) && !isDefault && resourceHandle) {
			const existingSpecific = await db.builderPage.findFirst({ where: { shop: session.shop, deletedAt: null, template, isDefault: false, resourceHandle } });
			if (existingSpecific) return Response.json({ success: true, intent: "create", pageId: existingSpecific.id, existing: true });
		}

		const handle = await generateUniqueHandle({
			shop: session.shop,
			title: finalTitle,
		});

		const page =
			await db.builderPage.create({
				data: {
					shop: session.shop,
					title: finalTitle,
					handle,
					template,

					resourceId:
						["collection", "product", "blog", "article"].includes(template) ? resourceId : null,

					resourceHandle:
						["collection", "product", "blog", "article"].includes(template) ? resourceHandle : null,

					isDefault,

					status: "draft",
					createdBy: builderActorName,
					contentJson:
						JSON.stringify([]),
					publishedJson: null,
				},
			});

		return Response.json({ success: true, intent: "create", pageId: page.id, existing: false });
	}


	if (intent === "bulk") return handleBulkTemplateAction({ formData, admin, session, builderRole, builderActorName });

	if (!pageId) {
		return {
			success: false,
			error: "Page ID is required.",
		};
	}

	const existingPage =
		await db.builderPage.findFirst({
			where: {
				id: pageId,
				shop: session.shop,
			},
		});

	if (!existingPage) {
		return {
			success: false,
			error: "Page not found.",
		};
	}

	if (existingPage.deletedAt && !["restore", "hard-delete"].includes(intent)) {
		return Response.json({ success: false, error: "This template is in Trash. Restore it before editing or changing it." }, { status: 409 });
	}

	/*
 * SET COLLECTION TEMPLATE AS DEFAULT
 */
	if (intent === "set-default") {
		if (!(await canAccessBuilderAction(db, session, "pages", "publish"))) return Response.json({ success: false, error: "Your role cannot publish or change default templates." }, { status: 403 });
		if (!["collection", "product", "blog", "article"].includes(existingPage.template)) {
			return Response.json(
				{ success: false, error: "Only collection, product, blog, or article templates can be set as default." },
				{ status: 400 },
			);
		}

		try {
			await db.$transaction([
				/*
				 * Remove default flag from all
				 * other collection templates.
				 */
				db.builderPage.updateMany({
					where: {
						shop: session.shop,
						template: existingPage.template,
						isDefault: true,
						id: {
							not: existingPage.id,
						},
					},
					data: {
						isDefault: false,
					},
				}),

				/*
				 * Make selected template default.
				 */
				db.builderPage.update({
					where: {
						id: existingPage.id,
					},
					data: {
						isDefault: true,

						/*
						 * Default template must not
						 * belong to one collection.
						 */
						resourceId: null,
						resourceHandle: null,

						/*
						 * Default storefront location.
						 */
						shopifyPageUrl:
							existingPage.template === "collection" && existingPage.status === "published"
								? "/collections/all"
								: ["product", "blog", "article"].includes(existingPage.template)
									? null
									: existingPage.shopifyPageUrl,
					},
				}),
			]);

			return Response.json({
				success: true,
				intent: "set-default",
				pageId: existingPage.id,
				message:
					`Default ${existingPage.template} template updated successfully.`,
			});
		} catch (error) {
			console.error(
				"VSN set default collection error:",
				error,
			);

			return Response.json(
				{
					success: false,
					intent: "set-default",
					error:
						error instanceof Error
							? error.message
							: "Could not set default collection template.",
				},
				{
					status: 500,
				},
			);
		}
	}

	/*
	 * MOVE PAGE/TEMPLATE TO TRASH
	 */
	if (intent === "delete") {
		if (!(await canAccessBuilderAction(db, session, "pages", "delete"))) return Response.json({ success: false, error: "Your role cannot move templates to Trash." }, { status: 403 });
		if (existingPage.deletedAt) return Response.json({ success: true, intent: "delete", pageId: existingPage.id, message: "Template is already in Trash." });

		const warnings = [];
		try {
			if (existingPage.shopifyPageId) {
				try { await setShopifyPagePublished({ admin, shopifyPageId: existingPage.shopifyPageId, isPublished: false }); }
				catch (error) { warnings.push(`Shopify page could not be hidden: ${error instanceof Error ? error.message : "unknown error"}`); }
			}

			await db.builderPage.update({ where: { id: existingPage.id }, data: { deletedAt: new Date() } });
			const assetResult = await trashTemplateThemeAssets({
				admin,
				session,
				pageId: existingPage.id,
				fallbackFiles: safeParseJson(existingPage.trashedAssetsJson, []),
			});
			const rememberedAssets = Array.isArray(assetResult.files) ? assetResult.files : [];
			try {
				await db.builderPage.update({ where: { id: existingPage.id }, data: { trashedAssetsJson: JSON.stringify(rememberedAssets) } });
			} catch (error) {
				warnings.push(`Trash metadata could not be saved: ${error instanceof Error ? error.message : "unknown error"}`);
			}
			if (!assetResult.success && assetResult.error) warnings.push(`Generated asset cleanup: ${assetResult.error}`);
			await db.builderAuditLog.create({ data: { shop: session.shop, pageId: existingPage.id, actor: builderActorName, role: builderRole, action: "template.trashed", details: JSON.stringify({ assets: rememberedAssets, warnings }) } }).catch(()=>{});

			return Response.json({ success: true, intent: "delete", pageId: existingPage.id, message: warnings.length ? "Template moved to Trash with warnings." : "Template moved to Trash. Generated CSS/JS removed.", warnings });
		} catch (error) {
			console.error("VSN page trash error:", error);
			return Response.json({ success: false, intent: "delete", error: error instanceof Error ? error.message : "Could not move template to Trash." }, { status: 500 });
		}
	}

	/*
	 * RESTORE PAGE/TEMPLATE FROM TRASH
	 */
	if (intent === "restore") {
		if (!(await canAccessBuilderAction(db, session, "pages", "restore"))) return Response.json({ success: false, error: "Your role cannot restore templates." }, { status: 403 });
		if (!existingPage.deletedAt) return Response.json({ success: true, intent: "restore", pageId: existingPage.id, message: "Template is already active." });

		const conflictWhere = existingPage.isDefault
			? { shop: session.shop, deletedAt: null, template: existingPage.template, isDefault: true }
			: existingPage.resourceId
				? { shop: session.shop, deletedAt: null, template: existingPage.template, isDefault: false, resourceId: existingPage.resourceId }
				: existingPage.resourceHandle
					? { shop: session.shop, deletedAt: null, template: existingPage.template, isDefault: false, resourceHandle: existingPage.resourceHandle }
					: null;
		if (conflictWhere) {
			const conflict = await db.builderPage.findFirst({ where: { ...conflictWhere, id: { not: existingPage.id } }, select: { id: true, title: true } });
			if (conflict) return Response.json({ success: false, intent: "restore", error: `Cannot restore while "${conflict.title}" is using the same default/resource assignment.` }, { status: 409 });
		}

		const staleFiles = safeParseJson(existingPage.trashedAssetsJson, []);
		await db.builderPage.update({ where: { id: existingPage.id }, data: { deletedAt: null } });
		const warnings = [];
		if (existingPage.shopifyPageId && existingPage.status === "published") {
			try { await setShopifyPagePublished({ admin, shopifyPageId: existingPage.shopifyPageId, isPublished: true }); }
			catch (error) { warnings.push(`Shopify page could not be republished: ${error instanceof Error ? error.message : "unknown error"}`); }
		}
		const assetResult = await restoreTemplateThemeAssets({ admin, session, db, pageId: existingPage.id, staleFiles });
		if (!assetResult.success && assetResult.error) warnings.push(`Generated asset rebuild: ${assetResult.error}`);
		if (assetResult.success) await db.builderPage.update({ where: { id: existingPage.id }, data: { trashedAssetsJson: null } });
		await db.builderAuditLog.create({ data: { shop: session.shop, pageId: existingPage.id, actor: builderActorName, role: builderRole, action: "template.restored", details: JSON.stringify({ generatedFiles: assetResult.files || [], warnings }) } }).catch(()=>{});
		return Response.json({ success: true, intent: "restore", pageId: existingPage.id, message: warnings.length ? "Template restored with warnings." : (assetResult.skipped ? "Draft template restored." : "Template restored and generated CSS/JS rebuilt."), warnings });
	}

	/*
	 * PERMANENT DELETE FROM TRASH
	 */
	if (intent === "hard-delete") {
		if (!(await canAccessBuilderAction(db, session, "pages", "delete"))) return Response.json({ success: false, error: "Your role cannot permanently delete templates." }, { status: 403 });
		if (!existingPage.deletedAt) return Response.json({ success: false, error: "Move the template to Trash before deleting it forever." }, { status: 400 });
		const staleFiles = safeParseJson(existingPage.trashedAssetsJson, []);
		const assetResult = await trashTemplateThemeAssets({ admin, session, pageId: existingPage.id, fallbackFiles: staleFiles });
		if (existingPage.shopifyPageId) {
			try { await deleteShopifyPage({ admin, shopifyPageId: existingPage.shopifyPageId }); } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Shopify page deletion failed." }, { status: 500 }); }
		}
		await db.$transaction([
			db.builderTemplateRule.deleteMany({ where: { shop: session.shop, pageId: existingPage.id } }),
			db.builderRevision.deleteMany({ where: { shop: session.shop, pageId: existingPage.id } }),
			db.builderPageTranslation.deleteMany({ where: { shop: session.shop, pageId: existingPage.id } }),
			db.builderPage.delete({ where: { id: existingPage.id } }),
		]);
		return Response.json({ success: true, intent: "hard-delete", pageId: existingPage.id, message: assetResult.success ? "Template permanently deleted." : "Template permanently deleted; some old theme assets may require a later cleanup." });
	}

	/*
	 * DUPLICATE PAGE
	 */
	if (intent === "duplicate") {
		if (!(await canAccessBuilderAction(db, session, "pages", "create"))) return Response.json({ success: false, error: "Your role cannot duplicate templates." }, { status: 403 });
		const duplicateTitle =
			`${existingPage.title} Copy`;

		const duplicateHandle =
			await generateUniqueHandle({
				shop: session.shop,
				title: duplicateTitle,
			});

		const duplicatedPage =
			await db.builderPage.create({
				data: {
					shop: session.shop,
					title: duplicateTitle,
					handle: duplicateHandle,
					template: existingPage.template || "page",
					// A duplicate must never silently become another default template.
					isDefault: false,
					resourceId: existingPage.isDefault ? null : existingPage.resourceId,
					resourceHandle: existingPage.isDefault ? null : existingPage.resourceHandle,
					status: "draft",
					createdBy: builderActorName,
					templateImage: existingPage.templateImage || null,
					seoScore: Number(existingPage.seoScore ?? 100),
					pageCount: Number(existingPage.pageCount ?? 1),
					contentJson:
						existingPage.contentJson ||
						JSON.stringify([]),
					publishedJson: null,
				},
			});

		try {
			const translations = await db.builderPageTranslation.findMany({ where: { shop: session.shop, pageId: existingPage.id } });
			if (translations.length) {
				await db.builderPageTranslation.createMany({
					data: translations.map((row) => ({
						shop: session.shop,
						pageId: duplicatedPage.id,
						locale: row.locale,
						marketKey: row.marketKey,
						overridesJson: row.overridesJson,
						seoJson: row.seoJson,
						status: "draft",
						sourceVersion: Number(duplicatedPage.version || 1),
					})),
				});
			}
		} catch (error) {
			console.warn("VSN localization duplicate warning:", error instanceof Error ? error.message : error);
		}

		return redirect(
			`/app/builder/${duplicatedPage.id}`,
		);
	}

	/*
	 * RENAME PAGE
	 */
	if (intent === "rename") {
		if (!(await canAccessBuilderAction(db, session, "pages", "edit"))) return Response.json({ success: false, error: "Your role cannot rename templates." }, { status: 403 });
		const newTitle =
			title || existingPage.title;

		const newHandle =
			await generateUniqueHandle({
				shop: session.shop,
				title: newTitle,
				excludePageId: existingPage.id,
			});

		try {
			let syncedShopifyPage = null;

			if (existingPage.shopifyPageId) {
				syncedShopifyPage =
					await updateShopifyPage({
						admin,
						shopifyPageId:
							existingPage.shopifyPageId,
						builderPageId:
							existingPage.id,
						title: newTitle,
						handle: newHandle,
					});
			}

			const finalHandle =
				syncedShopifyPage?.handle ||
				newHandle;

			const updatedPage =
				await db.builderPage.update({
					where: {
						id: existingPage.id,
					},
					data: {
						title: newTitle,
						handle: finalHandle,

						shopifyPageUrl:
							existingPage.shopifyPageId
								? `/pages/${finalHandle}`
								: existingPage.shopifyPageUrl,
					},
				});

			return Response.json({
				success: true,
				intent: "rename",
				pageId: updatedPage.id,
				handle: updatedPage.handle,
				shopifyPageUrl:
					updatedPage.shopifyPageUrl,
			});
		} catch (error) {
			console.error(
				"VSN rename error:",
				error,
			);

			return Response.json(
				{
					success: false,
					intent: "rename",
					error:
						error instanceof Error
							? error.message
							: "Page rename failed.",
				},
				{
					status: 500,
				},
			);
		}
	}

	return {
		success: false,
		error: "Invalid page action.",
	};
}

async function generateUniqueHandle({
	shop,
	title,
	excludePageId = null,
}) {
	const baseHandle =
		title
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") ||
		"untitled-page";

	let handle = baseHandle;
	let suffix = 2;

	while (true) {
		const existingPage =
			await db.builderPage.findFirst({
				where: {
					shop,
					handle,

					...(excludePageId
						? {
							id: {
								not: excludePageId,
							},
						}
						: {}),
				},
			});

		if (!existingPage) {
			return handle;
		}

		handle = `${baseHandle}-${suffix}`;
		suffix += 1;
	}
}

export default function PagesRoute() {
	const confirmAction = useVsnConfirm();
	const {
		pages,
		trash = [],
		shop,
		builderRole = "admin",
		permissions = {},
		collections = [],
		products = [],
		blogs = [],
		panelData = {},
		tableData = null,
		openPage = null,
		templatesViewSettings = null,
	} = useLoaderData();

	const fetcher = useFetcher();
	const navigate = useNavigate();
	const location = useLocation();
	const [editorWindowSrc, setEditorWindowSrc] = useState("");
	const [activeView, setActiveView] = useState("pages");
	const [pageFeedback, setPageFeedback] = useState({ error: "", message: "" });

	const busy = fetcher.state !== "idle";

	const saveViewSettings = useCallback(async (settings) => {
		const body = new FormData();
		body.set("intent", "save-template-view-settings");
		body.set("settings", JSON.stringify(settings || {}));
		try {
			const response = await fetch(location.pathname, { method:"POST", body, credentials:"include", headers:{ Accept:"application/json" } });
			if (!response.ok) console.warn("VSN template view settings save failed:", response.status);
		} catch (error) { console.warn("VSN template view settings save failed:", error instanceof Error ? error.message : error); }
	}, [location.pathname]);


	useEffect(() => {
		const requestedPanel = new URLSearchParams(location.search || "").get("panel");
		setActiveView(requestedPanel && BUILDER_PANEL_IDS.has(requestedPanel) ? requestedPanel : "pages");
	}, [location.search]);

	useEffect(() => {
		if (activeView !== "pages") { setPageFeedback({ error: "", message: "" }); return; }
		const data = fetcher.data;
		if (!data) return;
		setPageFeedback({ error: String(data.error || ""), message: String(data.message || "") });
	}, [activeView, fetcher.data]);


	const changeView = useCallback((view) => {
		const next = BUILDER_PANEL_IDS.has(view) ? view : "pages";
		setActiveView(next);
		const params = new URLSearchParams(location.search || "");
		params.delete("open");
		if (next === "pages") params.delete("panel"); else params.set("panel", next);
		const search = params.toString();
		navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
	}, [location.pathname, location.search, navigate]);

	useEffect(() => {
		if (!editorWindowSrc) return undefined;
		let cancelled = false;

		const openEditorWindow = async () => {
			try {
				if (window.customElements?.whenDefined) {
					await window.customElements.whenDefined("s-app-window");
				}
				if (cancelled) return;
				const frame = document.getElementById("vsn-builder-app-window");
				if (!frame) return;
				frame.src = editorWindowSrc;
				await frame.show?.();
			} catch (error) {
				console.error("VSN app window open error:", error);
			}
		};

		void openEditorWindow();
		return () => { cancelled = true; };
	}, [editorWindowSrc]);


	useEffect(() => {
		if (!editorWindowSrc) return undefined;
		const frame = document.getElementById("vsn-builder-app-window");
		if (!frame?.addEventListener) return undefined;
		const onHide = () => setEditorWindowSrc("");
		frame.addEventListener("hide", onHide);
		return () => frame.removeEventListener("hide", onHide);
	}, [editorWindowSrc]);

	useEffect(() => {
		const handleEditorMessage = async (event) => {
			if (event.origin !== window.location.origin) return;
			if (event.data?.type !== "vsn:close-editor" && event.data?.type !== "vsn:open-builder-panel") return;
			const frame = document.getElementById("vsn-builder-app-window");
			try { await frame?.hide?.(); } catch (error) { console.error("VSN app window close error:", error); }
			setEditorWindowSrc("");
			if (event.data?.type === "vsn:open-builder-panel") {
				const requestedPanel = String(event.data?.panel || "pages");
				if (BUILDER_PANEL_IDS.has(requestedPanel)) changeView(requestedPanel);
			}
		};
		window.addEventListener("message", handleEditorMessage);
		return () => window.removeEventListener("message", handleEditorMessage);
	}, [changeView]);

	function createPage() {
		const modal = document.getElementById("vsn-create-page-modal");
		if (modal?.showOverlay) {
			modal.showOverlay();
			return;
		}
		if (typeof window !== "undefined" && window.shopify?.modal?.show) {
			window.shopify.modal.show("vsn-create-page-modal");
		}
	}

	function submitCreatePage(payload) {
		fetcher.submit(
			{
				intent: "create",
				title: payload.title,
				template: payload.template,
				isDefault: String(!!payload.isDefault),
				resourceId: payload.resourceId || "",
				resourceHandle: payload.resourceHandle || "",
			},
			{ method: "post" },
		);
	}


	async function setAsDefault(page) {
		if (!["collection", "product", "blog", "article"].includes(page.template)) return;
		if (page.isDefault) {
			setPageFeedback({ error: "", message: "This is already the default template." });
			return;
		}
		const confirmed = await confirmAction({
			title: `Set default ${page.template} template?`,
			message: `"${page.title}" will become the default ${page.template} template for matching storefront requests.`,
			confirmLabel: "Set as default",
			tone: "default",
		});
		if (!confirmed) return;
		fetcher.submit({ intent: "set-default", pageId: page.id }, { method: "post" });
	}

	function getEditPageUrl(page, options = {}) {
		const params = new URLSearchParams(location.search || "");
		params.set("appWindow", "1");
		params.set("embedded", "1");
		params.delete("preview");
		if (options.newPage) params.set("new", "1"); else params.delete("new");
		if (shop) params.set("shop", shop);
		return `/app/builder/${page.id}?${params.toString()}`;
	}

	function editPage(page, options = {}) {
		setEditorWindowSrc(getEditPageUrl(page, options));
	}

	useEffect(() => {
		const params = new URLSearchParams(location.search || "");
		const openPageId = String(params.get("open") || "");
		if (!openPageId) return;
 		const page = pages.find((item) => String(item.id) === openPageId)
			|| (openPage && String(openPage.id) === openPageId ? openPage : null);
		params.delete("open");
		const search = params.toString();
		navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
		if (!page) return;
		const editorParams = new URLSearchParams(location.search || "");
		editorParams.delete("open");
		editorParams.set("appWindow", "1");
		editorParams.set("embedded", "1");
		editorParams.delete("preview");
		if (shop) editorParams.set("shop", shop);
		setEditorWindowSrc(`/app/builder/${page.id}?${editorParams.toString()}`);
	}, [location.pathname, location.search, navigate, openPage, pages, shop]);

	useEffect(() => {
		const data = fetcher.data;
		if (data?.success && data?.intent === "create" && data?.pageId) {
			editPage({ id: data.pageId }, { newPage: data.existing !== true });
		}
	}, [fetcher.data]);

	function previewPage(page) {
		const params = new URLSearchParams(window.location.search);
		params.set("preview", "true");
		params.delete("embedded");
		if (shop) params.set("shop", shop);

		if (page.template === "collection") {
			const handle = page.resourceHandle || collections[0]?.handle || "";
			if (handle) params.set("collection", handle);
		}
		if (page.template === "product") {
			const handle = page.resourceHandle || products[0]?.handle || "";
			if (handle) params.set("product", handle);
		}
		if (page.template === "blog") {
			const handle = page.resourceHandle || blogs[0]?.handle || "";
			if (handle) params.set("blog", handle);
		}
		if (page.template === "article" && page.resourceHandle) params.set("article", page.resourceHandle);
		if (page.template === "search") params.set("query", "shirt");

		window.open(
			`/app/builder/${page.id}?${params.toString()}`,
			"_blank",
		);
	}

	function visitPage(page) {
		if (page.status !== "published" || !page.shopifyPageUrl) {
			setPageFeedback({ error: "Publish this template before visiting it on the storefront.", message: "" });
			return;
		}

		const storefrontPath =
			page.shopifyPageUrl.startsWith("/")
				? page.shopifyPageUrl
				: `/${page.shopifyPageUrl}`;

		const pageUrl =
			`https://${shop}${storefrontPath}`;

		window.open(
			pageUrl,
			"_blank",
			"noopener,noreferrer",
		);
	}

	function duplicatePage(page) {
		fetcher.submit(
			{
				intent: "duplicate",
				pageId: page.id,
			},
			{
				method: "post",
			},
		);
	}

	function renamePage(page, nextTitle) {
		const title = String(nextTitle || "").trim();
		if (!title) return;
		fetcher.submit({ intent: "rename", pageId: page.id, title }, { method: "post" });
	}

	async function exportPage(page) {
		try {
			const params = new URLSearchParams(location.search || "");
			params.delete("open");
			params.delete("panel");
			params.set("mode", "export");
			params.set("exportId", page.id);
			if (shop) params.set("shop", shop);
			const response = await fetch(`${location.pathname}?${params.toString()}`, { credentials: "include", headers: { Accept: "application/json" } });
			const data = await response.json().catch(() => ({}));
			if (!response.ok || !data?.ok || !data?.package) throw new Error(data?.error || "Template export failed.");
			const blob = new Blob([JSON.stringify(data.package, null, 2)], { type: "application/json" });
			const objectUrl = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = objectUrl;
			anchor.download = `${page.handle || "template"}.vsn.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(objectUrl);
		} catch (error) {
			setPageFeedback({ error: error instanceof Error ? error.message : "Template export failed.", message: "" });
		}
	}

	function importTemplateFile(file) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const payload = JSON.parse(String(reader.result || "{}"));
				fetcher.submit({ intent: "import", payload: JSON.stringify(payload) }, { method: "post" });
			} catch {
				setPageFeedback({ error: "This file is not valid template JSON.", message: "" });
			}
		};
		reader.readAsText(file);
	}

	async function deletePage(page) {
		const confirmed = await confirmAction({
			title: "Move template to Trash?",
			message: `"${page.title}" will move to Trash. Generated CSS/JS will be removed and can be rebuilt on Restore.`,
			confirmLabel: "Move to Trash",
			tone: "danger",
		});
		if (!confirmed) return;
		fetcher.submit({ intent: "delete", pageId: page.id }, { method: "post" });
	}

	function bulkAction(action, ids, options = {}) {
		const pageIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
		if (!pageIds.length) return;
		fetcher.submit({
			intent: "bulk",
			bulkAction: String(action || ""),
			pageIds: JSON.stringify(pageIds),
			scheduledAt: options.scheduledAt || "",
		}, { method: "post" });
	}

	function restorePage(page) {
		fetcher.submit({ intent: "restore", pageId: page.id }, { method: "post" });
	}

	async function hardDeletePage(page) {
		const confirmed = await confirmAction({
			title: "Delete page permanently?",
			message: `${page.title} and its Builder history/assets will be permanently deleted. This cannot be undone.`,
			confirmLabel: "Delete permanently",
			tone: "danger",
		});
		if (!confirmed) return;
		fetcher.submit({ intent: "hard-delete", pageId: page.id }, { method: "post" });
	}

	return (
		<div className="vsn-builder-unified-content min-h-0 bg-[#fafafa]">
			{editorWindowSrc ? (
				<s-app-window
					suppressHydrationWarning
					id="vsn-builder-app-window"
					src={editorWindowSrc}
				/>
			) : null}

			<main className="min-w-0 min-h-0">
				{activeView === "pages" ? (
					<>
						<CreatePageModal
							collections={collections}
							products={products}
							blogs={blogs}
							busy={busy}
							onCreate={submitCreatePage}
						/>
						<Dashboard
							pages={pages}
							initialData={tableData}
							trash={trash}
							busy={busy}
							error={pageFeedback.error}
							notice={pageFeedback.message}
							onNewPage={createPage}
							onImportTemplate={importTemplateFile}
								canCreate={permissions.create === true}
								canImport={permissions.import === true}
								canEdit={permissions.edit === true}
								canDuplicate={permissions.create === true}
								canDelete={permissions.delete === true}
								canRestore={permissions.restore === true}
								canSetDefault={permissions.publish === true}
							onEditPage={editPage}
							getEditPageUrl={getEditPageUrl}
							onPreviewPage={previewPage}
							onVisitPage={visitPage}
							onDuplicatePage={duplicatePage}
							onRenamePage={renamePage}
							onExportPage={exportPage}
							onDeletePage={deletePage}
							onRestorePage={restorePage}
							onHardDeletePage={hardDeletePage}
							onSetDefault={setAsDefault}
							onBulkAction={bulkAction}
							refreshSignal={fetcher.data}
							savedViewSettings={templatesViewSettings}
							onSaveViewSettings={saveViewSettings}
						/>
					</>
				) : (
					<BuilderPanelHost activeView={activeView} onViewChange={changeView} panelData={panelData} onEditPage={editPage} />
				)}
			</main>
		</div>
	);
}

function safeParseJson(value, fallback) {
	try {
		const parsed = JSON.parse(value);
		return parsed == null ? fallback : parsed;
	} catch {
		return fallback;
	}
}
