import test from "node:test";
import assert from "node:assert/strict";
import { resolveStorefrontPreview, storefrontPreviewUrl, isStorefrontPreviewRequest, privatePreviewResponse } from "../app/storefront/storefrontPreview.server.js";
import { signPreviewToken } from "../app/services/preview-token.server.js";

const shop = "demo.myshopify.com";
const secret = "test-secret";
const draft = { id: "p1", shop, template: "page", contentJson: "[{\"id\":\"h\",\"type\":\"heading\"}]", publishedJson: null };
const db = { builderPage: { findFirst: async ({ where }) => (where.id === draft.id && where.shop === shop ? draft : null) } };
const url = (params) => new URL(`https://app.test/builder-proxy/preview?${new URLSearchParams(params)}`);

test("a signed draft preview renders the saved draft, not the published copy", async () => {
  const token = await signPreviewToken({ shop, pageId: "p1", secret });
  const result = await resolveStorefrontPreview({ db, url: url({ vsnPreview: "p1", vsnPreviewToken: token }), shop, secret });
  assert.equal(result.page.publishedJson, draft.contentJson);
});

test("a bad token or another shop's page is refused", async () => {
  const bad = await resolveStorefrontPreview({ db, url: url({ vsnPreview: "p1", vsnPreviewToken: "1.x" }), shop, secret });
  assert.match(bad.error, /expired/);
  const token = await signPreviewToken({ shop: "other.myshopify.com", pageId: "p1", secret });
  const other = await resolveStorefrontPreview({ db, url: url({ vsnPreview: "p1", vsnPreviewToken: token }), shop, secret });
  assert.ok(other.error);
});

test("a marketplace template previews from the built-in catalog", async () => {
  const catalog = [{ catalogId: "tpl-1", title: "Hero", content: [{ id: "x", type: "heading" }] }];
  const result = await resolveStorefrontPreview({ db, url: url({ vsnTemplate: "tpl-1" }), shop, secret, catalog });
  assert.deepEqual(JSON.parse(result.page.publishedJson), catalog[0].content);
  assert.ok((await resolveStorefrontPreview({ db, url: url({ vsnTemplate: "nope" }), shop, secret, catalog })).error);
  assert.equal(await resolveStorefrontPreview({ db, url: url({}), shop, secret, catalog }), null);
});

test("preview links point at the shop's app proxy and responses stay private", () => {
  assert.equal(storefrontPreviewUrl(shop, { vsnTemplate: "tpl-1", empty: "" }), "https://demo.myshopify.com/apps/vsn-builder/preview?vsnTemplate=tpl-1");
  assert.ok(isStorefrontPreviewRequest(url({ vsnPreview: "p1" })));
  const response = privatePreviewResponse(new Response("x", { headers: { "Cache-Control": "public, max-age=15" } }));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
});
