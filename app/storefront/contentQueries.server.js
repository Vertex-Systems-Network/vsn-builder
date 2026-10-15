import { shopifyHandleQuery, selectShopifyContentByHandle, selectShopifyArticleForBlog } from "../utils/shopify-blog-handle.server.js";
export async function safeAdminData(admin, query, variables, label) {
  try {
    const response = await admin.graphql(query, { variables });
    const result = await response.json();
    if (result.errors?.length) {
      console.error(`VSN ${label} GraphQL errors:`, result.errors);
      return null;
    }
    return result.data || null;
  } catch (error) {
    console.error(`VSN ${label} failed:`, error);
    return null;
  }
}

export async function getSearchData({ admin, query }) {
  const q = String(query || "").trim();
  if (!q) return { query: "", count: 0, items: [] };

  const [productData, pageData, articleData] = await Promise.all([
    safeAdminData(
      admin,
      `#graphql\nquery SearchProducts($query:String!){products(first:24,query:$query){nodes{id title handle description featuredImage{url altText} priceRangeV2{minVariantPrice{amount currencyCode}}}}}`,
      { query: q },
      "search products",
    ),
    safeAdminData(
      admin,
      `#graphql\nquery SearchPages($query:String!){pages(first:12,query:$query){nodes{id title handle bodySummary}}}`,
      { query: q },
      "search pages",
    ),
    safeAdminData(
      admin,
      `#graphql\nquery SearchArticles($query:String!){articles(first:12,query:$query){nodes{id title handle excerpt:summary blog{handle} image{url altText}}}}`,
      { query: q },
      "search articles",
    ),
  ]);

  const products = (productData?.products?.nodes || []).map((item) => ({
    type: "Product",
    title: item.title,
    excerpt: item.description || "",
    url: `/products/${item.handle}`,
    image: item.featuredImage,
    price: item.priceRangeV2?.minVariantPrice || null,
  }));
  const pages = (pageData?.pages?.nodes || []).map((item) => ({
    type: "Page",
    title: item.title,
    excerpt: item.bodySummary || "",
    url: `/pages/${item.handle}`,
    image: null,
  }));
  const articles = (articleData?.articles?.nodes || []).map((item) => ({
    type: "Article",
    title: item.title,
    excerpt: item.excerpt || "",
    url: `/blogs/${item.blog?.handle || "news"}/${item.handle}`,
    image: item.image,
  }));

  return {
    query: q,
    count: products.length + pages.length + articles.length,
    items: [...products, ...pages, ...articles],
  };
}

export async function getBlogData({ admin, handle }) {
  const query = shopifyHandleQuery(handle);
  if (!query) return null;
  const data = await safeAdminData(
    admin,
    `#graphql\nquery BlogData($query:String!){blogs(first:5,query:$query){nodes{id title handle articles(first:24,reverse:true){nodes{id title handle excerpt:summary publishedAt author{name} image{url altText}}}}}}`,
    { query },
    "blog data",
  );
  const blog = selectShopifyContentByHandle(data?.blogs?.nodes, handle);
  if (!blog) return null;
  return {
    id: blog.id,
    title: blog.title,
    handle: blog.handle,
    description: "",
    articles: (blog.articles?.nodes || []).map((article) => ({
      ...article,
      author: article.author?.name || "",
      url: `/blogs/${blog.handle}/${article.handle}`,
    })),
  };
}

export async function getArticleData({ admin, blogHandle, articleHandle }) {
  const blogQuery = shopifyHandleQuery(blogHandle);
  const articleQuery = shopifyHandleQuery(articleHandle);
  if (!blogQuery || !articleQuery) return null;
  const data = await safeAdminData(
    admin,
    `#graphql\nquery ArticleData($blogQuery:String!,$articleQuery:String!){blogs(first:5,query:$blogQuery){nodes{title handle articles(first:50,reverse:true){nodes{id title handle excerpt:summary publishedAt image{url altText}}}}} articles(first:20,query:$articleQuery){nodes{id title handle blog{handle} contentHtml:body excerpt:summary publishedAt tags author{name} image{url altText}}}}`,
    { blogQuery, articleQuery },
    "article data",
  );
  const blog = selectShopifyContentByHandle(data?.blogs?.nodes, blogHandle);
  const article = selectShopifyArticleForBlog(data?.articles?.nodes, blogHandle, articleHandle);
  if (!blog || !article) return null;

  const all = blog.articles?.nodes || [];
  const index = all.findIndex((item) => item.handle === article.handle);
  const previous = index >= 0 && index < all.length - 1 ? all[index + 1] : null;
  const next = index > 0 ? all[index - 1] : null;
  const related = all
    .filter((item) => item.handle !== article.handle)
    .slice(0, 3)
    .map((item) => ({ ...item, url: `/blogs/${blogHandle}/${item.handle}` }));

  return {
    ...article,
    author: article.author?.name || "",
    blogHandle,
    previous: previous ? { title: previous.title, url: `/blogs/${blogHandle}/${previous.handle}` } : null,
    next: next ? { title: next.title, url: `/blogs/${blogHandle}/${next.handle}` } : null,
    related,
  };
}
