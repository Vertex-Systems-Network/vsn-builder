import db from "../db.server.js";

export async function getBuilderPage({
	id,
	shop,
}) {
	return db.builderPage.findFirst({
		where: { id, shop, deletedAt: null },
	});
}

export async function getBuilderPages(shop) {
	return db.builderPage.findMany({
		where: { shop, deletedAt: null },
		orderBy: {
			updatedAt: "desc",
		},
	});
}

export async function createBuilderPage({
	shop,
	title,
	handle,
	content,
	createdBy = "Store owner",
}) {
	return db.builderPage.create({
		data: {
			shop,
			title,
			handle,
			status: "draft",
			contentJson: JSON.stringify(content),
			createdBy,
		},
	});
}

export async function updateBuilderPage({
	id,
	shop,
	title,
	content,
}) {
	return db.builderPage.updateMany({
		where: { id, shop, deletedAt: null },
		data: {
			title,
			contentJson: JSON.stringify(content),
		},
	});
}

export async function publishBuilderPage({
	id,
	shop,
	title,
	content,
}) {
	return db.builderPage.updateMany({
		where: { id, shop, deletedAt: null },
		data: {
			title,
			status: "published",
			contentJson: JSON.stringify(content),
			publishedJson: JSON.stringify(content),
		},
	});
}