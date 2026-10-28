import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getBlogData, getArticleData } from "../app/storefront/contentQueries.server.js";
import { loadBuilderBlogPreview, loadBuilderArticlePreview } from "../app/services/builder-content-preview.server.js";
import {
  normalizeShopifyContentHandle,
  shopifyHandleQuery,
  selectShopifyContentByHandle,
  selectShopifyArticleForBlog,
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

test("Article query cannot disclose content from the wrong blog even with identical handle", () => {
  const rows = [
    { handle:"launch", blog:{handle:"different"}, id:"wrong" },
    { handle:"launch", blog:{handle:"news-2026"}, id:"correct" },
  ];
  assert.equal(selectShopifyArticleForBlog(rows,"news-2026","launch")?.id,"correct");
  assert.equal(selectShopifyArticleForBlog(rows,"unknown","launch"),null);
  assert.equal(selectShopifyArticleForBlog(rows,"news-2026","missing"),null);
});

test("actual builder preview GraphQL uses Admin blogs, not Storefront blogByHandle", () => {
  const route = readFileSync("app/routes/app.builder.$id.jsx", "utf8");
  assert.match(route,/loadBuilderBlogPreview/);
  assert.match(route,/loadBuilderArticlePreview/);
  const source = readFileSync("app/services/builder-content-preview.server.js", "utf8");
  assert.doesNotMatch(source, /blogByHandle\s*\(/);
  assert.match(source, /query PreviewBlog\(\$query:String!\)/);
  assert.match(source, /query PreviewArticle\(\$articleQuery:String!\)/);
  assert.match(source, /articles\(first:20, query:\$articleQuery\)/);
  assert.doesNotMatch(source, /articles\(first:\d+, sortKey:/);
  assert.match(source, /selectShopifyArticleForBlog/);
  assert.match(source, /contentHtml:body/);
  assert.match(source, /excerpt:summary/);
  assert.match(source, /selectShopifyContentByHandle/);
});


test("Admin search helper returns exact blog and never uses Storefront blogByHandle", async () => {
  const requests = [];
  const admin = {
    graphql: async (document,{ variables }) => {
      requests.push({document,variables});
      return {json:async()=>({data:{blogs:{nodes:[
        {id:"wrong",handle:"other",articles:{nodes:[]}},
        {id:"correct",handle:"news",title:"News",articles:{nodes:[{
          id:"a1",handle:"post",title:"Post",author:{name:"Editor"},publishedAt:"2026-10-01",
        }]}}
      ]}}})};
    },
  };
  const blog=await getBlogData({admin,handle:"NEWS"});
  assert.equal(blog?.id,"correct");
  assert.equal(blog?.articles[0]?.author,"Editor");
  assert.equal(blog?.articles[0]?.url,"/blogs/news/post");
  assert.match(requests[0].document,/blogs\(first:5,query:\$query\)/);
  assert.doesNotMatch(requests[0].document,/blogByHandle|sortKey:PUBLISHED_AT/);
  assert.equal(requests[0].variables.query,"handle:news");
  assert.equal(await getBlogData({admin,handle:"news OR id:*"}),null);
  assert.equal(requests.length,1);
});

test("Admin article search requires the correct owning blog and preserves summary/body aliases",async()=>{
  const admin={graphql:async(doc,{variables})=>{
    assert.match(doc,/articles\(first:20,query:\$articleQuery\)/);
    assert.match(doc,/contentHtml:body/);
    assert.match(doc,/excerpt:summary/);
    assert.equal(variables.articleQuery,"handle:launch");
    return {json:async()=>({data:{
      blogs:{nodes:[{handle:"news",articles:{nodes:[{id:"a",handle:"other",title:"Other"}]}}]},
      articles:{nodes:[
        {id:"wrong",handle:"launch",blog:{handle:"unrelated"}},
        {id:"correct",handle:"launch",blog:{handle:"news"},title:"Launch",author:{name:"Editor"},contentHtml:"<p>Body</p>"},
      ]}
    }})};
  }};
  const article=await getArticleData({admin,blogHandle:"news",articleHandle:"launch"});
  assert.equal(article?.id,"correct");
  assert.equal(article?.blogHandle,"news");
  assert.equal(article?.contentHtml,"<p>Body</p>");
  assert.equal(article?.related?.[0]?.url,"/blogs/news/other");
});

test("Builder editor previews run through isolated Admin module and preserve exact handles", async()=>{
  const requests=[];
  const admin={graphql:async(document,{variables})=>{
    requests.push({document,variables});
    if(document.includes("PreviewBlog"))
      return {json:async()=>({data:{blogs:{nodes:[
        {id:"wrong",handle:"other"},
        {id:"correct",handle:"news",articles:{nodes:[]}},
      ]}}})};
    if(document.includes("PreviewArticle"))
      return {json:async()=>({data:{articles:{nodes:[
        {id:"cross",handle:"launch",blog:{handle:"other"}},
        {id:"match",handle:"launch",blog:{handle:"news"}},
      ]}}})};
    throw Error("Unexpected preview operation");
  }};
  const blog=await loadBuilderBlogPreview({admin,requestedHandle:"NEWS"});
  assert.equal(blog?.id,"correct");
  const article=await loadBuilderArticlePreview({admin,requestedHandle:"news/launch"});
  assert.equal(article?.id,"match");
  assert.equal(article?.blogHandle,"news");
  assert.equal(requests.length,2);
  assert.equal(requests[0].variables.query,"handle:news");
  assert.equal(requests[1].variables.articleQuery,"handle:launch");
  const blocked=await loadBuilderArticlePreview({admin,requestedHandle:"news/launch/forged"});
  assert.equal(blocked,null);
  assert.equal(requests.length,2);
});
