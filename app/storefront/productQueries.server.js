import { mapProductNode } from "./productMapper.js";
import {
  buildPriceSortPage,
  clampProductPageSize,
  getAllProductsSortConfig,
  getCollectionSortConfig,
  isPriceSort,
  sortProductsByPrice,
} from "./productPagination.js";

export async function getCollectionByHandle({
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

export async function getCollectionProductsPage({
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

export async function fetchAllProductsForPriceSort(admin) {
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

export async function getAllProducts({
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

export async function getAllProductsPage({
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

export async function getProductByHandle({ admin, handle }) {
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
