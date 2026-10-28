import test from "node:test";
import assert from "node:assert/strict";
import { signPreviewToken, verifyPreviewToken } from "../app/services/preview-token.server.js";

test("preview tokens are bound to shop, page, secret and expiry", async () => {
  const base = { shop: "a.myshopify.com", pageId: "p1", secret: "s3cret" };
  const token = await signPreviewToken(base);
  assert.equal(await verifyPreviewToken({ ...base, token }), true);
  assert.equal(await verifyPreviewToken({ ...base, token, pageId: "p2" }), false);
  assert.equal(await verifyPreviewToken({ ...base, token, shop: "b.myshopify.com" }), false);
  assert.equal(await verifyPreviewToken({ ...base, token, secret: "other" }), false);
  assert.equal(await verifyPreviewToken({ ...base, token, now: Date.now() + 3 * 3600 * 1000 }), false);
  assert.equal(await verifyPreviewToken({ ...base, token: "garbage" }), false);
  assert.equal(await signPreviewToken({ ...base, secret: "" }), "");
});
