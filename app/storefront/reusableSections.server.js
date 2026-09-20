import { resolveComponentInstance } from "../builder/componentSystem.js";
import { migrateBuilderContent } from "../builder/schemaMigrations.js";
import { resolveLocalizedPage } from "../services/localization.server.js";
import { getTemplateSettings } from "./templateSettings.js";

function safeParseJson(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function renderableElements(elements) {
	return (Array.isArray(elements) ? elements : []).filter(
		(item) => !["global-styles", "template-settings"].includes(item?.type),
	);
}

export async function resolveReusableSections({ database, shop, elements, locale = "", marketKey = "*", localizationEnabled = false }) {
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

export async function getGlobalSection(database, shop, template, requestedId = null, { locale = "", marketKey = "*", localizationEnabled = false } = {}) {
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
