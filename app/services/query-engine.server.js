import { applyQueryFilters, normalizeLoopItem, normalizeQueryDefinition, queryCostEstimate } from "../builder/queryBuilder.js";
import { resolveVsnDataProvider } from "../sdk/dataProviders.server.js";
import { ensureBuiltinSdkPlugins } from "../sdk/builtinPlugins.js";

ensureBuiltinSdkPlugins();

function sortConfig(source, sort) {
  const table = {
    products: {
      "title-asc": ["TITLE", false], "title-desc": ["TITLE", true],
      "price-asc": ["PRICE", false], "price-desc": ["PRICE", true],
      newest: ["CREATED_AT", true], oldest: ["CREATED_AT", false], featured: ["ID", false],
    },
    collections: {
      "title-asc": ["TITLE", false], "title-desc": ["TITLE", true], newest: ["UPDATED_AT", true], featured: ["ID", false],
    },
    blogs: { "title-asc": ["TITLE", false], "title-desc": ["TITLE", true] },
    articles: { newest: ["PUBLISHED_AT", true], oldest: ["PUBLISHED_AT", false], "title-asc": ["TITLE", false], "title-desc": ["TITLE", true] },
    search: { relevance: ["RELEVANCE", false], "title-asc": ["TITLE", false], "title-desc": ["TITLE", true] },
    metaobjects: { "display-name": ["display_name", false], "updated-desc": ["updated_at", true] },
  };
  return table[source]?.[sort] || Object.values(table[source] || {})[0] || ["ID", false];
}

async function graphql(admin, query, variables, label) {
  try {
    const response = await admin.graphql(query, { variables });
    const payload = await response.json();
    if (payload.errors?.length) return { ok: false, error: payload.errors.map((item) => item.message).join("; "), data: null };
    return { ok: true, data: payload.data || {} };
  } catch (error) {
    return { ok: false, error: `${label || "Query"}: ${error instanceof Error ? error.message : "Shopify request failed."}`, data: null };
  }
}

function connectionPage(connection = {}) {
  return {
    nodes: Array.isArray(connection?.nodes) ? connection.nodes : [],
    pageInfo: connection?.pageInfo || { hasNextPage: false, endCursor: null },
  };
}

async function fetchConnection({ admin, source, query, after = null, first = 100 }) {
  const [sortKey, reverse] = sortConfig(source, query.sort);
  const commonVars = { first, after, q: query.query || null };
  if (source === "products" || source === "search") {
    const effectiveQuery = source === "search" ? (query.query || "") : (query.query || null);
    const result = await graphql(admin, `#graphql
      query VsnLoopProducts($first:Int!,$after:String,$q:String){
        products(first:$first,after:$after,query:$q,sortKey:${sortKey},reverse:${reverse ? "true" : "false"}){
          nodes{ id title handle createdAt updatedAt vendor productType tags featuredImage{url altText width height} priceRangeV2{minVariantPrice{amount currencyCode}} variants(first:20){nodes{availableForSale}} }
          pageInfo{hasNextPage endCursor}
        }
      }`, { ...commonVars, q: effectiveQuery }, "Loop products");
    return result.ok ? { ok: true, ...connectionPage(result.data.products) } : result;
  }
  if (source === "collections") {
    const result = await graphql(admin, `#graphql
      query VsnLoopCollections($first:Int!,$after:String,$q:String){
        collections(first:$first,after:$after,query:$q,sortKey:${sortKey},reverse:${reverse ? "true" : "false"}){
          nodes{ id title handle description updatedAt image{url altText width height} productsCount{count} }
          pageInfo{hasNextPage endCursor}
        }
      }`, commonVars, "Loop collections");
    return result.ok ? { ok: true, ...connectionPage(result.data.collections) } : result;
  }
  if (source === "blogs") {
    const result = await graphql(admin, `#graphql
      query VsnLoopBlogs($first:Int!,$after:String,$q:String){
        blogs(first:$first,after:$after,query:$q,sortKey:${sortKey},reverse:${reverse ? "true" : "false"}){
          nodes{ id title handle updatedAt articlesCount{count} }
          pageInfo{hasNextPage endCursor}
        }
      }`, commonVars, "Loop blogs");
    return result.ok ? { ok: true, ...connectionPage(result.data.blogs) } : result;
  }
  if (source === "articles") {
    const result = await graphql(admin, `#graphql
      query VsnLoopArticles($first:Int!,$after:String,$q:String){
        articles(first:$first,after:$after,query:$q,sortKey:${sortKey},reverse:${reverse ? "true" : "false"}){
          nodes{ id title handle summary publishedAt image{url altText width height} blog{handle title} author{name} tags }
          pageInfo{hasNextPage endCursor}
        }
      }`, commonVars, "Loop articles");
    return result.ok ? { ok: true, ...connectionPage(result.data.articles) } : result;
  }
  if (source === "metaobjects") {
    if (!query.metaobjectType) return { ok: false, error: "Choose a metaobject type before previewing this query.", nodes: [] };
    const result = await graphql(admin, `#graphql
      query VsnLoopMetaobjects($first:Int!,$after:String,$q:String,$type:String!){
        metaobjects(first:$first,after:$after,query:$q,type:$type,sortKey:"${sortKey}",reverse:${reverse ? "true" : "false"}){
          nodes{ id handle type displayName updatedAt fields{key value type} }
          pageInfo{hasNextPage endCursor}
        }
      }`, { ...commonVars, type: query.metaobjectType }, "Loop metaobjects");
    return result.ok ? { ok: true, ...connectionPage(result.data.metaobjects) } : result;
  }
  return { ok: false, error: `Unsupported loop source: ${source}`, nodes: [] };
}

async function fetchMetafieldReferences({ admin, query, context = {} }) {
  const owner = query.metafieldOwner || "product";
  const handle = owner === "collection" ? context.collectionHandle : context.productHandle;
  if (!handle) return { ok: false, error: `A current ${owner} preview context is required for metafield references.`, nodes: [] };
  if (!query.metafieldKey) return { ok: false, error: "Enter a metafield key.", nodes: [] };
  const rootField = owner === "collection" ? "collectionByHandle" : "productByHandle";
  const result = await graphql(admin, `#graphql
    query VsnLoopMetafieldReferences($handle:String!,$namespace:String!,$key:String!,$first:Int!){
      ${rootField}(handle:$handle){
        metafield(namespace:$namespace,key:$key){
          references(first:$first){
            nodes{
              __typename
              ... on Product { id title handle vendor productType featuredImage{url altText width height} priceRangeV2{minVariantPrice{amount currencyCode}} }
              ... on Collection { id title handle description image{url altText width height} }
              ... on Metaobject { id handle type displayName updatedAt fields{key value type} }
              ... on MediaImage { id image{url altText width height} }
              ... on GenericFile { id url mimeType }
            }
            pageInfo{hasNextPage endCursor}
          }
        }
      }
    }`, { handle, namespace: query.metafieldNamespace, key: query.metafieldKey, first: Math.min(100, query.offset + query.limit) }, "Loop metafield references");
  if (!result.ok) return result;
  const refs = result.data?.[rootField]?.metafield?.references;
  return { ok: true, ...connectionPage(refs || {}) };
}

function enrichRaw(raw, source) {
  if (source === "articles") return { ...raw, url: raw?.blog?.handle && raw?.handle ? `/blogs/${raw.blog.handle}/${raw.handle}` : "#", excerpt: raw?.summary || "" };
  if (source === "blogs") return { ...raw, meta: raw?.articlesCount?.count != null ? `${raw.articlesCount.count} article${raw.articlesCount.count === 1 ? "" : "s"}` : "" };
  if (raw?.__typename === "MediaImage") return { ...raw, title: raw?.image?.altText || "Image", image: raw?.image, url: raw?.image?.url || "#" };
  if (raw?.__typename === "GenericFile") return { ...raw, title: raw?.mimeType || "File", url: raw?.url || "#" };
  return raw;
}

export async function runShopifyLoopQuery({ admin, definition, context = {}, afterCursor = null, pageSize = null }) {
  const query = normalizeQueryDefinition(definition);
  const requested = Math.max(1, Math.min(100, Number(pageSize || query.limit)));
  const cost = queryCostEstimate(query);
  if (query.source === "sdk-provider") {
    if (!query.providerId) return { success:false, error:"Choose an SDK data provider.", items:[], total:0, pageInfo:{hasNextPage:false,endCursor:null}, cost };
    let providerInput={}; try { providerInput=JSON.parse(query.providerInputJson || "{}"); } catch { return { success:false, error:"SDK provider input must be valid JSON.", items:[], total:0, pageInfo:{hasNextPage:false,endCursor:null}, cost }; }
    try {
      const payload=await resolveVsnDataProvider(query.providerId,{admin,...context},{...providerInput,limit:requested,query:query.query,afterCursor});
      const rows=Array.isArray(payload)?payload:Array.isArray(payload?.items)?payload.items:[];
      const normalized=rows.map((raw)=>normalizeLoopItem(raw,"sdk-provider"));
      const items=applyQueryFilters(normalized,{...query,offset:afterCursor?0:query.offset,limit:requested});
      return {success:true,items,total:Number(payload?.total ?? items.length),pageInfo:payload?.pageInfo || {hasNextPage:false,endCursor:null},cost,providerId:query.providerId};
    } catch(error) { return {success:false,error:error instanceof Error?error.message:query.errorText,items:[],total:0,pageInfo:{hasNextPage:false,endCursor:null},cost,providerId:query.providerId}; }
  }

  if (query.source === "metafield-references") {
    const refs = await fetchMetafieldReferences({ admin, query: { ...query, limit: requested }, context });
    if (!refs.ok) return { success: false, error: refs.error || query.errorText, items: [], total: 0, pageInfo: { hasNextPage: false, endCursor: null }, cost };
    const normalized = refs.nodes.map((raw) => normalizeLoopItem(enrichRaw(raw, query.source), query.source));
    const items = applyQueryFilters(normalized, { ...query, limit: requested });
    return { success: true, items, total: items.length, pageInfo: refs.pageInfo, cost };
  }

  // Cursor mode requests one page directly. Offset mode walks Shopify cursors so offsets > 100 are still deterministic.
  if (afterCursor) {
    const page = await fetchConnection({ admin, source: query.source, query, after: afterCursor, first: requested });
    if (!page.ok) return { success: false, error: page.error || query.errorText, items: [], total: 0, pageInfo: { hasNextPage: false, endCursor: null }, cost };
    const normalized = page.nodes.map((raw) => normalizeLoopItem(enrichRaw(raw, query.source), query.source));
    const items = applyQueryFilters(normalized, { ...query, offset: 0, limit: requested });
    return { success: true, items, total: items.length, pageInfo: page.pageInfo, cost };
  }

  const target = Math.max(1, Math.min(550, query.offset + requested));
  const rawNodes = [];
  let after = null;
  let pageInfo = { hasNextPage: false, endCursor: null };
  while (rawNodes.length < target) {
    const first = Math.min(100, target - rawNodes.length);
    const page = await fetchConnection({ admin, source: query.source, query, after, first });
    if (!page.ok) return { success: false, error: page.error || query.errorText, items: [], total: 0, pageInfo: { hasNextPage: false, endCursor: null }, cost };
    rawNodes.push(...page.nodes);
    pageInfo = page.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor || page.nodes.length === 0) break;
    after = pageInfo.endCursor;
  }
  const normalized = rawNodes.map((raw) => normalizeLoopItem(enrichRaw(raw, query.source), query.source));
  const items = applyQueryFilters(normalized, { ...query, limit: requested });
  return { success: true, items, total: items.length, pageInfo, cost };
}
