const CREATE_PAGE = `#graphql
  mutation CreateVsnPage(
    $page: PageCreateInput!
  ) {
    pageCreate(page: $page) {
      page {
        id
        title
        handle
        isPublished
      }

      userErrors {
        code
        field
        message
      }
    }
  }
`;

const UPDATE_PAGE = `#graphql
  mutation UpdateVsnPage(
    $id: ID!
    $page: PageUpdateInput!
  ) {
    pageUpdate(
      id: $id
      page: $page
    ) {
      page {
        id
        title
        handle
        isPublished
      }

      userErrors {
        code
        field
        message
      }
    }
  }
`;

const DELETE_PAGE = `#graphql
  mutation DeleteVsnPage($id: ID!) {
    pageDelete(id: $id) {
      deletedPageId

      userErrors {
        code
        field
        message
      }
    }
  }
`;

const GET_PAGE = `#graphql
  query GetVsnPage($id: ID!) {
    page(id: $id) {
      id
      title
      handle
      isPublished
    }
  }
`;

function getErrors(json, payloadKey) {
	const graphqlErrors = Array.isArray(
		json?.errors,
	)
		? json.errors.map((error) => ({
			message: error.message,
			field: null,
			code: "GRAPHQL_ERROR",
		}))
		: [];

	const userErrors = Array.isArray(
		json?.data?.[payloadKey]?.userErrors,
	)
		? json.data[payloadKey].userErrors
		: [];

	return [
		...graphqlErrors,
		...userErrors,
	];
}

function escapeAttribute(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export function buildBuilderPageBody({
	pageId,
	handle,
}) {
	return `
    <div
      class="vsn-builder-mount"
      data-vsn-page-id="${escapeAttribute(pageId)}"
      data-vsn-page-handle="${escapeAttribute(handle)}"
    >
      <div class="vsn-builder-loading">
        Loading page...
      </div>
    </div>
  `.trim();
}

export async function createShopifyPage({
	admin,
	builderPageId,
	title,
	handle,
}) {
	const response = await admin.graphql(
		CREATE_PAGE,
		{
			variables: {
				page: {
					title,
					handle,
					body: buildBuilderPageBody({
						pageId: builderPageId,
						handle,
					}),
					isPublished: true,
				},
			},
		},
	);

	const json = await response.json();

	const errors = getErrors(
		json,
		"pageCreate",
	);

	if (errors.length > 0) {
		throw new Error(
			errors
				.map((error) => error.message)
				.join(", "),
		);
	}

	const page =
		json.data?.pageCreate?.page;

	if (!page?.id) {
		throw new Error(
			"Shopify page was not created.",
		);
	}

	return page;
}

export async function updateShopifyPage({
	admin,
	shopifyPageId,
	builderPageId,
	title,
	handle,
}) {
	const response = await admin.graphql(
		UPDATE_PAGE,
		{
			variables: {
				id: shopifyPageId,
				page: {
					title,
					handle,
					body: buildBuilderPageBody({
						pageId: builderPageId,
						handle,
					}),
					isPublished: true,
				},
			},
		},
	);

	const json = await response.json();

	const errors = getErrors(
		json,
		"pageUpdate",
	);

	if (errors.length > 0) {
		throw new Error(
			errors
				.map((error) => error.message)
				.join(", "),
		);
	}

	const page =
		json.data?.pageUpdate?.page;

	if (!page?.id) {
		throw new Error(
			"Shopify page was not updated.",
		);
	}

	return page;
}


export async function setShopifyPagePublished({ admin, shopifyPageId, isPublished }) {
	if (!shopifyPageId) return null;
	const response = await admin.graphql(
		UPDATE_PAGE,
		{ variables: { id: shopifyPageId, page: { isPublished: Boolean(isPublished) } } },
	);
	const json = await response.json();
	const errors = getErrors(json, "pageUpdate");
	if (errors.length > 0) throw new Error(errors.map((error) => error.message).join(", "));
	return json.data?.pageUpdate?.page || null;
}

export async function deleteShopifyPage({
	admin,
	shopifyPageId,
}) {
	if (!shopifyPageId) {
		return null;
	}

	const response = await admin.graphql(
		DELETE_PAGE,
		{
			variables: {
				id: shopifyPageId,
			},
		},
	);

	const json = await response.json();

	const errors = getErrors(
		json,
		"pageDelete",
	);

	if (errors.length > 0) {
		throw new Error(
			errors
				.map((error) => error.message)
				.join(", "),
		);
	}

	return (
		json.data?.pageDelete
			?.deletedPageId || null
	);
}

export async function getShopifyPage({
	admin,
	shopifyPageId,
}) {
	if (!shopifyPageId) {
		return null;
	}

	const response = await admin.graphql(
		GET_PAGE,
		{
			variables: {
				id: shopifyPageId,
			},
		},
	);

	const json = await response.json();

	if (json.errors?.length) {
		throw new Error(
			json.errors
				.map((error) => error.message)
				.join(", "),
		);
	}

	return json.data?.page || null;
}