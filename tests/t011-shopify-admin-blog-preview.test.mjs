import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeShopifyContentHandle,
  shopifyHandleQuery,
  selectShopifyContentByHandle,
} from "../app/utils/shopify-blog-handle.server.js";

test("Shopify Admin blog/article handles are constrained, not interpolated into GraphQL", () => {
  assert.equal(normalizeShopifyContentHandle("  News-2026  "), "news-2026");
  assert.equal(shopifyHandleQuery(" News-2026 "), "handle:news-2026");
  for (const bad of [
    "", "handle:another", "blog or shop:example", "test\\nfoo",
    "foo/bar", "a:read_content", "a\" OR id:*", "-leading", "ending-",
    ".".repeat(128), "a".repeat(129), null, undefined,
  ]) {
    assert.equal(shopifyHandleQuery(bad), null, String(bad));
  }
});

test("Admin search results cannot substitute another tenant resource or fuzzy handle", () => {
  const rows = [
    { handle: "other", id: "gid://shopify/Blog/other" },
    { handle: "news-2026", id: "gid://shopify/Blog/correct" },
  ];
  assert.equal(selectShopifyContentByHandle(rows, "NEWS-2026")?.id, "gid://shopify/Blog/correct");
  assert.equal(selectShopifyContentByHandle(rows, "missing"), null);
  assert.equal(selectShopifyContentByHandle([], "news-2026"), null);
  assert.equal(selectShopifyContentByHandle(null, "news-2026"), null);
  assert.equal(selectShopifyContentByHandle([{handle: "news-2026-plus"}], "news-2026"), null);
});

test("actual builder preview GraphQL uses Admin blogs, not Storefront blogByHandle", () => {
  const source = readFileSync("app/routes/app.builder.$id.jsx", "utf8");
  assert.doesNotMatch(source, /blogByHandle\s*\(/);
  assert.match(source, /query PreviewBlog\(\$query:String!\)/);
  assert.match(source, /query PreviewArticle\(\$blogQuery:String!,\$articleQuery:String!\)/);
  assert.match(source, /contentHtml:body/);
  assert.match(source, /excerpt:summary/);
  assert.match(source, /selectShopifyContentByHandle/);
});

