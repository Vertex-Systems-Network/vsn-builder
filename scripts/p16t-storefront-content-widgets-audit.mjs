import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getNodeSpacing,
  renderArticleContent,
  renderArticleDate,
  renderArticleNavigation,
  renderArticleTags,
  renderBlogArticleGrid,
  renderRelatedArticles,
  renderSearchQueryTitle,
  renderSearchResultCount,
  renderSearchResultsGrid,
  sanitizeRichHtml,
} from "../app/storefront/contentWidgets.js";

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const node = (type) => ({ id: `n-${type}`, type });

const dirty = `<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="//e"></iframe><a href="javascript:alert(1)">l</a><img src='javascript:x' onerror=y>`;
const clean = sanitizeRichHtml(dirty);
ok(!/<script|<iframe/i.test(clean), "sanitizeRichHtml strips script and iframe tags");
ok(!/\son\w+=/i.test(clean), "sanitizeRichHtml strips inline event handlers");
ok(!/javascript:/i.test(clean), "sanitizeRichHtml neutralises javascript: URLs");
ok(clean.includes("<p>Hi</p>"), "sanitizeRichHtml keeps safe markup");
equal(sanitizeRichHtml(null), "", "sanitizeRichHtml tolerates nullish input");

equal(getNodeSpacing({}), { margin: "0px", padding: "0px" }, "Spacing defaults to 0px");
equal(getNodeSpacing({ spacing: { margin: { top: 1, right: 2, bottom: 3, left: 4, unit: "em" } } }).margin, "1em 2em 3em 4em", "Spacing reads box objects");
equal(getNodeSpacing({ spacing: { paddingTop: 5, paddingLeft: "2rem" } }).padding, "5px 0px 0px 2rem", "Spacing reads individual sides");

const q = renderSearchQueryTitle(node("q"), { tag: "script" }, {}, { search: { query: "<b>" } });
ok(q.startsWith("<h1") && q.includes("“&lt;b&gt;”"), "Search title rejects unknown tags and escapes the query");
ok(renderSearchResultCount(node("c"), {}, {}, { search: { count: 1 } }).includes(">result<"), "Search count uses singular text for 1");
ok(renderSearchResultCount(node("c"), {}, {}, { search: { count: 3 } }).includes(">results<"), "Search count uses plural text");

const grid = renderSearchResultsGrid(node("g"), { limit: 1 }, {}, { search: { items: [{ title: "A", url: "/a", price: { amount: "5", currencyCode: "USD" } }, { title: "B" }] } });
equal((grid.match(/vsn-search-card"/g) || []).length, 1, "Search grid honours the limit");
ok(grid.includes("vsn-search-card-title") && grid.includes("$5.00"), "Search grid renders title and formatted price");
ok(renderSearchResultsGrid(node("g"), {}, {}, {}).includes("vsn-search-empty"), "Empty search grid shows empty text");

ok(renderBlogArticleGrid(node("b"), {}, {}, { blog: { handle: "news", articles: [{ handle: "post", title: "Post" }] } }).includes('href="/blogs/news/post"'), "Article cards build blog URLs from handles");

const article = { contentHtml: "<p>Body</p><script>x</script>", content: "a\nb", publishedAt: "2026-01-02T00:00:00Z", tags: ["x", "<y>"], previous: { url: "/p", title: "Prev" } };
const body = renderArticleContent(node("ac"), {}, {}, { article });
ok(body.includes("<p>Body</p>") && !body.includes("<script>"), "Article contentHtml is sanitized");
ok(renderArticleContent(node("ac"), {}, {}, { article: { content: "a\nb" } }).includes("a<br>b"), "Plain article content converts newlines");
ok(renderArticleDate(node("ad"), { format: "iso" }, {}, { article }).includes(">2026-01-02<"), "Article date supports ISO format");
ok(renderArticleTags(node("at"), {}, {}, { article }).includes("&lt;y&gt;"), "Article tags are escaped");
const nav = renderArticleNavigation(node("an"), {}, {}, { article });
ok(nav.includes("vsn-article-nav-prev") && nav.includes("<span></span>"), "Navigation renders previous link and empty next slot");
ok(renderRelatedArticles(node("r"), {}, {}, { article: { related: [] } }).includes("Related articles"), "Related articles renders default heading");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/contentWidgets.js", "utf8");
ok(route.includes('from "../storefront/contentWidgets.js"'), "Builder proxy imports content-widget boundary");
for (const name of ["getNodeSpacing", "sanitizeRichHtml", "contentTypography", "renderSearchResultsGrid", "articleCard", "renderArticleContent", "renderRelatedArticles"]) {
  ok(!route.includes(`function ${name}(`), `Builder proxy no longer owns ${name}`);
}
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Content-widget boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6t storefront content widgets audit: PASS (${checks}/${checks})`);
