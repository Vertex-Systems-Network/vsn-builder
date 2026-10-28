import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isPrerenderCacheable, prerenderKey } from "../app/services/storefront-prerender.server.js";

const base = { template: "index", html: '<div class="vsn-page"></div>', dynamicData: [{}, {}, []], elementGroups: [[{ type: "heading", props: { text: "Hi" } }]] };

test("prerender key matches the Liquid embed key", () => {
  assert.equal(prerenderKey("index", ""), "p_index__default");
  const liquid = fs.readFileSync(new URL("../extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid", import.meta.url), "utf8");
  assert.match(liquid, /'p_index__default'/);
  assert.match(liquid, /app\.metafields\.vsn_prerender\[vsn_pr_key\]/);
  assert.ok(prerenderKey("index", "x".repeat(200)).length <= 64);
  // Liquid builds blog.handle + "-" + article.handle; the proxy receives "blog/article".
  assert.equal(prerenderKey("article", "news/hello-world"), "p_article__news-hello-world");
  assert.equal(prerenderKey("blog", "news"), "p_blog__news");
  assert.match(liquid, /'p_article__' \| append: blog\.handle \| append: '-' \| append: article\.handle/);
});

test("only static, non-personalised home fragments are cached", () => {
  assert.equal(isPrerenderCacheable(base), true);
  assert.equal(isPrerenderCacheable({ ...base, template: "product" }), false);
  assert.equal(isPrerenderCacheable({ ...base, template: "collection" }), false);
  assert.equal(isPrerenderCacheable({ ...base, template: "article" }), true);
  assert.equal(isPrerenderCacheable({ ...base, experiment: { id: "e" } }), false);
  assert.equal(isPrerenderCacheable({ ...base, localizationEnabled: true }), false);
  assert.equal(isPrerenderCacheable({ ...base, hasLiquid: true }), false);
  assert.equal(isPrerenderCacheable({ ...base, ruleCount: 1 }), false);
  assert.equal(isPrerenderCacheable({ ...base, dynamicData: [{ grid: [1] }] }), false);
  assert.equal(isPrerenderCacheable({ ...base, elementGroups: [[{ props: { visibilityRules: [] } }]] }), false);
  assert.equal(isPrerenderCacheable({ ...base, html: "x".repeat(300 * 1024) }), false);
});
