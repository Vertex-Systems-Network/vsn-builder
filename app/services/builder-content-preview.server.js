// Isolated server-only Shopify Admin preview queries used by Builder editor.
// No route entitlement, OAuth, or database authorization lives here.
import { safeAdminGraphql } from "../utils/admin-graphql.server.js";
import {
  shopifyHandleQuery,
  selectShopifyContentByHandle,
  selectShopifyArticleForBlog,
} from "../utils/shopify-blog-handle.server.js";

export async function loadBuilderBlogPreview({ admin, requestedHandle, resourceHandle } = {}) {
  let handle = requestedHandle || resourceHandle || "";
  if (!handle) {
    const firstBlog = await safeAdminGraphql(admin,
      `#graphql\nquery FirstPreviewBlog { blogs(first:1, sortKey:TITLE){ nodes{ handle } } }`,
      {}, "first blog preview");
    handle = firstBlog?.blogs?.nodes?.[0]?.handle || "";
  }
  const query = shopifyHandleQuery(handle);
  if (!query) return null;
  const data = await safeAdminGraphql(admin,
    `#graphql\nquery PreviewBlog($query:String!){ blogs(first:5, query:$query){ nodes{ id title handle articles(first:12, reverse:true){ nodes{ id title handle excerpt:summary publishedAt author{ name } image{ url altText } } } } } }`,
    { query }, "blog preview");
  return selectShopifyContentByHandle(data?.blogs?.nodes, handle);
}

export async function loadBuilderArticlePreview({ admin, requestedHandle, resourceHandle } = {}) {
  let resource = requestedHandle || resourceHandle || "";
  if (!resource) {
    const firstArticle = await safeAdminGraphql(admin,
      `#graphql\nquery FirstPreviewArticle { blogs(first:1, sortKey:TITLE){ nodes{ handle articles(first:1, reverse:true){ nodes{ handle } } } } }`,
      {}, "first article preview");
    const blog = firstArticle?.blogs?.nodes?.[0];
    const article = blog?.articles?.nodes?.[0];
    if (blog?.handle && article?.handle) resource = blog.handle + "/" + article.handle;
  }
  const segments = resource.split("/");
  if (segments.length !== 2) return null;
  const [blogHandle, articleHandle] = segments;
  const articleQuery = shopifyHandleQuery(articleHandle);
  if (!shopifyHandleQuery(blogHandle) || !articleQuery) return null;
  const data = await safeAdminGraphql(admin,
    `#graphql\nquery PreviewArticle($articleQuery:String!){ articles(first:20, query:$articleQuery){ nodes{ id title handle blog{ handle } contentHtml:body excerpt:summary publishedAt tags author{ name } image{ url altText } } } }`,
    { articleQuery }, "article preview");
  const selected = selectShopifyArticleForBlog(data?.articles?.nodes, blogHandle, articleHandle);
  return selected ? { ...selected, blogHandle } : null;
}
