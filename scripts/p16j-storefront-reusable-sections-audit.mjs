import assert from "node:assert/strict";
import fs from "node:fs";
import {
	getGlobalSection,
	resolveReusableSections,
} from "../app/storefront/reusableSections.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
	assert.deepStrictEqual(actual, expected, message);
	checks += 1;
};
const ok = (value, message) => {
	assert.ok(value, message);
	checks += 1;
};

const baseNode = (id, text) => ({
	id,
	type: "text",
	props: { text },
	styles: {},
	meta: {},
	children: [],
});

let sectionQuery = null;
let libraryQuery = null;
const sections = [
	{
		id: "section-1",
		title: "Reusable One",
		publishedJson: JSON.stringify([
			{ id: "global", type: "global-styles", props: {}, children: [] },
			{ id: "settings", type: "template-settings", props: {}, children: [] },
			baseNode("section-text", "Reusable content"),
		]),
	},
];
const libraryItems = [
	{
		id: "library-1",
		kind: "block",
		contentJson: JSON.stringify({
			id: "master-id",
			type: "text",
			label: "Master",
			props: { text: "Synced master" },
			meta: { master: true },
			children: [],
		}),
	},
	{
		id: "component-1",
		kind: "component",
		contentJson: JSON.stringify({
			schemaVersion: 1,
			version: 2,
			name: "Hero component",
			slug: "hero-component",
			root: baseNode("component-root", "Component content"),
			props: [],
			slots: [],
			variants: [{ id: "default", name: "Default", propValues: {}, rootPatch: {} }],
		}),
	},
];
const reusableDb = {
	builderPage: {
		async findMany(args) {
			sectionQuery = args;
			return sections;
		},
	},
	builderLibraryItem: {
		async findMany(args) {
			libraryQuery = args;
			return libraryItems;
		},
	},
	builderPageTranslation: {
		async findMany() {
			return [];
		},
	},
};

const resolved = await resolveReusableSections({
	database: reusableDb,
	shop: "shop.example",
	elements: [
		{
			id: "global-instance",
			type: "global-section",
			label: "Custom section label",
			props: { sectionId: "section-1" },
			children: [],
		},
		{
			id: "library-instance",
			type: "text",
			label: "Instance label",
			props: { text: "Old" },
			meta: { libraryItemId: "library-1", instance: true },
			children: [],
		},
		{
			id: "component-instance-1",
			type: "component-instance",
			props: { componentId: "component-1", variantId: "default" },
			meta: {},
			children: [],
		},
	],
});
equal(sectionQuery, {
	where: {
		shop: "shop.example",
		deletedAt: null,
		status: "published",
		template: "section",
	},
}, "Reusable sections remain shop-scoped and published-only");
equal(libraryQuery, {
	where: {
		shop: "shop.example",
		syncMode: "global",
		deletedAt: null,
	},
}, "Reusable library lookup remains shop-scoped and global-sync-only");

equal(resolved[0].type, "section", "Global section instance resolves to section container");
equal(resolved[0].label, "Custom section label", "Global section instance label remains authoritative");
equal(resolved[0].children.length, 1, "Global/template settings nodes stay filtered from reusable section children");
equal(resolved[0].children[0].props.text, "Reusable content", "Reusable section content remains intact");

equal(resolved[1].id, "library-instance", "Synced library replacement preserves instance ID");
equal(resolved[1].label, "Instance label", "Synced library replacement preserves instance label");
equal(resolved[1].props.text, "Synced master", "Synced library replacement uses fresh master content");
equal(resolved[1].meta, {
	master: true,
	libraryItemId: "library-1",
	instance: true,
	librarySync: "global",
}, "Synced library replacement preserves merged metadata and global marker");

equal(resolved[2].type, "container", "Component instance resolves to container");
equal(resolved[2].label, "Hero component", "Component instance inherits component name");
equal(resolved[2].meta.componentId, "component-1", "Component instance keeps component ID");
equal(resolved[2].meta.componentVersion, 2, "Component instance records master version");
equal(resolved[2].children[0].id, "component-instance-1--component-root", "Component child IDs remain instance-scoped");
equal(resolved[2].children[0].props.text, "Component content", "Component content remains intact");

const cycleDb = {
	builderPage: {
		async findMany() {
			return [{
				id: "cycle-section",
				publishedJson: JSON.stringify([{
					id: "nested-cycle",
					type: "global-section",
					props: { sectionId: "cycle-section" },
					children: [],
				}]),
			}];
		},
	},
	builderLibraryItem: { async findMany() { return []; } },
};
const cycle = await resolveReusableSections({
	database: cycleDb,
	shop: "shop.example",
	elements: [{
		id: "outer-cycle",
		type: "global-section",
		props: { sectionId: "cycle-section" },
		children: [],
	}],
});
equal(cycle[0].type, "section", "Outer reusable section resolves normally");
equal(cycle[0].children[0].type, "section", "Nested self-reference is converted to safe section");
equal(cycle[0].children[0].children, [], "Nested self-reference is cycle-blocked");

const componentCycleDb = {
	builderPage: { async findMany() { return []; } },
	builderLibraryItem: {
		async findMany() {
			return [{
				id: "component-cycle",
				kind: "component",
				contentJson: JSON.stringify({
					schemaVersion: 1,
					version: 1,
					name: "Cycle component",
					root: {
						id: "root-cycle",
						type: "component-instance",
						props: { componentId: "component-cycle" },
						meta: {},
						children: [],
					},
					props: [],
					slots: [],
					variants: [{ id: "default", name: "Default", propValues: {}, rootPatch: {} }],
				}),
			}];
		},
	},
};
const componentCycle = await resolveReusableSections({
	database: componentCycleDb,
	shop: "shop.example",
	elements: [{
		id: "component-cycle-instance",
		type: "component-instance",
		props: { componentId: "component-cycle" },
		meta: {},
		children: [],
	}],
});
equal(componentCycle[0].children[0].type, "container", "Nested component self-reference becomes a safe container");
equal(componentCycle[0].children[0].children, [], "Nested component self-reference has no recursive children");
equal(componentCycle[0].children[0].meta.componentCycleBlocked, true, "Nested component cycle is explicitly marked blocked");

const originalError = console.error;
console.error = () => {};
try {
	const input = [baseNode("original", "Original")];
	const failed = await resolveReusableSections({
		database: {
			builderPage: { async findMany() { throw new Error("offline"); } },
			builderLibraryItem: { async findMany() { return []; } },
		},
		shop: "shop.example",
		elements: input,
	});
	equal(failed, input, "Reusable lookup failures preserve original elements");

	const malformed = await resolveReusableSections({
		database: {
			builderPage: {
				async findMany() {
					return [{ id: "bad-section", publishedJson: "{" }];
				},
			},
			builderLibraryItem: {
				async findMany() {
					return [{ id: "bad-library", kind: "block", contentJson: "{" }];
				},
			},
		},
		shop: "shop.example",
		elements: [
			{ id: "bad-section-instance", type: "global-section", props: { sectionId: "bad-section" }, children: [] },
			{ id: "bad-library-instance", type: "text", props: { text: "Keep me" }, meta: { libraryItemId: "bad-library" }, children: [] },
		],
	});
	equal(malformed[0].children, [], "Malformed persisted section JSON fails soft to empty section content");
	equal(malformed[1].props.text, "Keep me", "Malformed synced-library JSON keeps the instance content");
} finally {
	console.error = originalError;
}

let requestedLookup = null;
let defaultLookup = null;
const requestedPage = {
	id: "header-requested",
	title: "Requested header",
	publishedJson: JSON.stringify([
		{
			id: "settings",
			type: "template-settings",
			props: {
				sticky: true,
				seoTitle: "Header SEO",
			},
			children: [],
		},
		baseNode("header-text", "Header"),
	]),
};
const globalDb = {
	builderPage: {
		async findFirst(args) {
			if (args.where.id) {
				requestedLookup = args;
				return requestedPage;
			}
			defaultLookup = args;
			return null;
		},
	},
	builderPageTranslation: {
		async findMany() {
			return [];
		},
	},
};
const global = await getGlobalSection(
	globalDb,
	"shop.example",
	"header",
	"header-requested",
	{ locale: "ar", marketKey: "SA", localizationEnabled: true },
);
equal(requestedLookup, {
	where: {
		id: "header-requested",
		shop: "shop.example",
		deletedAt: null,
		status: "published",
		template: "header",
	},
}, "Requested global section lookup remains ID/shop/template scoped");
equal(defaultLookup, null, "Requested published global section avoids default lookup");
equal(global.id, "header-requested", "Requested global section ID is preserved");
equal(global.settings.sticky, true, "Global section template settings remain derived from localized elements");
equal(global.settings.seoTitle, "Header SEO", "Global section SEO setting remains intact without override");
equal(global.localization, {
	locale: "ar",
	marketKey: "SA",
	direction: "rtl",
}, "Global section localization metadata remains intact");

const fallbackDb = {
	builderPage: {
		async findFirst(args) {
			if (args.where.id) return null;
			defaultLookup = args;
			return {
				id: "footer-default",
				title: "Default footer",
				publishedJson: JSON.stringify([baseNode("footer-text", "Footer")]),
			};
		},
	},
};
const fallback = await getGlobalSection(
	fallbackDb,
	"shop.example",
	"footer",
	"missing-footer",
	{ locale: "fr", marketKey: "*", localizationEnabled: true },
);
equal(defaultLookup, {
	where: {
		shop: "shop.example",
		deletedAt: null,
		status: "published",
		template: "footer",
		isDefault: true,
	},
	orderBy: { publishedAt: "desc" },
}, "Missing requested global section falls back to latest published default");
equal(fallback.id, "footer-default", "Default global section fallback is returned");
equal(fallback.localization.direction, "ltr", "Localization resolver failure preserves legacy LTR fallback");
equal(await getGlobalSection({
	builderPage: { async findFirst() { return { id: "empty", publishedJson: "" }; } },
}, "shop.example", "header"), null, "Global section without published JSON returns null");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/reusableSections.server.js", "utf8");

ok(route.includes('from "../storefront/reusableSections.server.js"'), "Builder proxy imports reusable-section boundary");
for (const call of [
	"resolveReusableSections({ database: db, shop: session.shop",
	'getGlobalSection(db, session.shop, "header"',
	'getGlobalSection(db, session.shop, "footer"',
]) {
	ok(route.includes(call), `Builder proxy keeps reusable-section call site: ${call}`);
}
for (const duplicate of [
	"async function resolveReusableSections(",
	"async function getGlobalSection(",
]) {
	ok(!route.includes(duplicate), `Builder proxy no longer owns reusable-section helper: ${duplicate}`);
}
for (const marker of [
	'database.builderPage.findMany({ where: { shop, deletedAt: null, status: "published", template: "section" } })',
	'database.builderLibraryItem.findMany({ where: { shop, syncMode: "global", deletedAt: null } })',
	'stack.has(`library:${libraryId}`)',
	'stack.has(componentKey)',
	"stack.has(sectionId)",
	'status: "published"',
	"isDefault: true",
	'orderBy: { publishedAt: "desc" }',
	"resolveLocalizedPage",
	"getTemplateSettings",
]) {
	ok(source.includes(marker), `Reusable-section boundary contract marker missing: ${marker}`);
}
for (const forbidden of [
	'from "../db.server.js"',
	"authenticate.",
	"admin.graphql",
	"fetch(",
	"Response(",
	"renderBuilder",
	"shopify.server",
	"process.env",
]) {
	ok(!source.includes(forbidden), `Reusable-section boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6j storefront reusable section audit: PASS (${checks}/${checks})`);
