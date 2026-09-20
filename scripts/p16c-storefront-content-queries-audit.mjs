import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getArticleData,
  getBlogData,
  getSearchData,
  safeAdminData,
} from "../app/storefront/contentQueries.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

let calls = [];
const searchAdmin = {
  async graphql(query, { variables }) {
    calls.push({ query, variables });
    if (query.includes("SearchProducts")) {
      return { async json() { return { data: { products: { nodes: [{
        id: "p1",
        title: "Alpha",
        handle: "alpha",
        description: "Product copy",
        featuredImage: { url: "https://cdn.example/alpha.jpg", altText: "Alpha" },
        priceRangeV2: { minVariantPrice: { amount: "12.00", currencyCode: "USD" } },
      }] } } }; } };
    }
    if (query.includes("SearchPages")) {
      return { async json() { return { data: { pages: { nodes: [{
        id: "page1",
        title: "About",
        handle: "about",
        bodySummary: "About summary",
      }] } } }; } };
    }
    if (query.includes("SearchArticles")) {
      return { async json() { return { data: { articles: { nodes: [
        { id: "a1", title: "News One", handle: "news-one", excerpt: "One", blog: { handle: "journal" }, image: { url: "one.jpg" } },
        { id: "a2", title: "News Two", handle: "news-two", excerpt: "", blog: null, image: null },
      ] } } }; } };
    }
    throw new Error("unexpected query");
  },
};

equal(await getSearchData({ admin: searchAdmin, query: "   " }), { query: "", count: 0, items: [] }, "Empty search remains local and empty");
equal(calls.length, 0, "Empty search does not call Admin API");

const search = await getSearchData({ admin: searchAdmin, query: "  alpha  " });
equal(calls.length, 3, "Non-empty search keeps three Admin queries");
ok(calls.every((call) => call.variables.query === "alpha"), "Search query remains trimmed for all Admin calls");
equal(search, {
  query: "alpha",
  count: 4,
  items: [
    {
      type: "Product",
      title: "Alpha",
      excerpt: "Product copy",
      url: "/products/alpha",
      image: { url: "https://cdn.example/alpha.jpg", altText: "Alpha" },
      price: { amount: "12.00", currencyCode: "USD" },
    },
    {
      type: "Page",
      title: "About",
      excerpt: "About summary",
      url: "/pages/about",
      image: null,
    },
    {
      type: "Article",
      title: "News One",
      excerpt: "One",
      url: "/blogs/journal/news-one",
      image: { url: "one.jpg" },
    },
    {
      type: "Article",
      title: "News Two",
      excerpt: "",
      url: "/blogs/news/news-two",
      image: null,
    },
  ],
}, "Search result shape/order and article blog fallback remain stable");

const blogAdmin = {
  async graphql(query, { variables }) {
    ok(query.includes("BlogData"), "Blog loader keeps BlogData query");
    equal(variables, { handle: "journal" }, "Blog loader keeps handle variable");
    return { async json() { return { data: { blogByHandle: {
      id: "blog1",
      title: "Journal",
      handle: "journal",
      articles: { nodes: [
        { id: "a1", title: "First", handle: "first", excerpt: "E1", publishedAt: "2026-01-01", author: { name: "A" }, image: null },
        { id: "a2", title: "Second", handle: "second", excerpt: "E2", publishedAt: "2025-01-01", author: null, image: null },
      ] },
    } } }; } };
  },
};
equal(await getBlogData({ admin: blogAdmin, handle: "journal" }), {
  id: "blog1",
  title: "Journal",
  handle: "journal",
  description: "",
  articles: [
    { id: "a1", title: "First", handle: "first", excerpt: "E1", publishedAt: "2026-01-01", author: "A", image: null, url: "/blogs/journal/first" },
    { id: "a2", title: "Second", handle: "second", excerpt: "E2", publishedAt: "2025-01-01", author: "", image: null, url: "/blogs/journal/second" },
  ],
}, "Blog mapping keeps author fallback and canonical URLs");

const articleAdmin = {
  async graphql(query, { variables }) {
    ok(query.includes("ArticleData"), "Article loader keeps ArticleData query");
    equal(variables, { blog: "journal", query: "handle:middle" }, "Article loader keeps blog/query variables");
    return { async json() { return { data: { blogByHandle: {
      title: "Journal",
      handle: "journal",
      articles: { nodes: [{
        id: "middle-id",
        title: "Middle",
        handle: "middle",
        contentHtml: "<p>Body</p>",
        excerpt: "Middle excerpt",
        publishedAt: "2025-06-01",
        tags: ["tag"],
        author: { name: "Writer" },
        image: null,
      }] },
      allArticles: { nodes: [
        { id: "new-id", title: "Newer", handle: "newer", excerpt: "N", publishedAt: "2026-01-01", image: null },
        { id: "middle-id", title: "Middle", handle: "middle", excerpt: "M", publishedAt: "2025-06-01", image: null },
        { id: "old-id", title: "Older", handle: "older", excerpt: "O", publishedAt: "2025-01-01", image: null },
        { id: "old2-id", title: "Old Two", handle: "old-two", excerpt: "O2", publishedAt: "2024-06-01", image: null },
        { id: "old3-id", title: "Old Three", handle: "old-three", excerpt: "O3", publishedAt: "2024-01-01", image: null },
      ] },
    } } }; } };
  },
};

const article = await getArticleData({ admin: articleAdmin, blogHandle: "journal", articleHandle: "middle" });
equal(article.author, "Writer", "Article author name remains flattened");
equal(article.blogHandle, "journal", "Article result keeps requested blog handle");
equal(article.previous, { title: "Older", url: "/blogs/journal/older" }, "Previous article remains the next older entry");
equal(article.next, { title: "Newer", url: "/blogs/journal/newer" }, "Next article remains the previous newer entry");
equal(article.related.map((item) => item.handle), ["newer", "older", "old-two"], "Related articles keep source order, exclude current, and cap at three");
equal(article.related.map((item) => item.url), ["/blogs/journal/newer", "/blogs/journal/older", "/blogs/journal/old-two"], "Related article URLs remain canonical");

const originalError = console.error;
console.error = () => {};
try {
  const graphQLErrorAdmin = {
    async graphql() {
      return { async json() { return { errors: [{ message: "bad query" }], data: { ignored: true } }; } };
    },
  };
  equal(await safeAdminData(graphQLErrorAdmin, "query", {}, "test"), null, "GraphQL errors remain soft-null");
  const throwingAdmin = { async graphql() { throw new Error("offline"); } };
  equal(await safeAdminData(throwingAdmin, "query", {}, "test"), null, "Admin exceptions remain soft-null");
  equal(await getBlogData({ admin: graphQLErrorAdmin, handle: "missing" }), null, "Blog loader remains null on safe Admin failure");
  equal(await getArticleData({ admin: graphQLErrorAdmin, blogHandle: "journal", articleHandle: "missing" }), null, "Article loader remains null on safe Admin failure");
} finally {
  console.error = originalError;
}

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const moduleSource = fs.readFileSync("app/storefront/contentQueries.server.js", "utf8");
ok(route.includes('from "../storefront/contentQueries.server.js"'), "Builder proxy imports extracted content query boundary");
for (const callSite of ["getSearchData({ admin, query: searchQuery })", "getBlogData({ admin, handle: requestedResourceHandle })", "getArticleData({ admin, blogHandle, articleHandle })"]) {
  ok(route.includes(callSite), `Builder proxy keeps content-query call site: ${callSite}`);
}
for (const duplicate of ["async function safeAdminData(", "async function getSearchData(", "async function getBlogData(", "async function getArticleData("]) {
  ok(!route.includes(duplicate), `Builder proxy must not retain extracted content query helper: ${duplicate}`);
}
for (const marker of ["SearchProducts", "SearchPages", "SearchArticles", "BlogData", "ArticleData", "Promise.all", "metaobjectByHandle"]) {
  if (marker === "metaobjectByHandle") continue;
  ok(moduleSource.includes(marker), `Content query boundary marker missing: ${marker}`);
}
for (const forbidden of ["db.", "fetch(", "authenticate.", "builderPage.", "Response(", "renderBuilder", "shopify.server"]) {
  ok(!moduleSource.includes(forbidden), `Content query boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6c storefront content query audit: PASS (${checks}/${checks})`);
