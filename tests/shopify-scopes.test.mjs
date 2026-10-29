import test from "node:test";
import assert from "node:assert/strict";
import { expandShopifyScopes } from "../app/utils/shopify-scopes.js";

test("write scopes imply read scopes, as Shopify stores them compressed", () => {
  const scopes = expandShopifyScopes("write_files,write_themes,read_orders,unauthenticated_write_checkouts");
  for (const scope of ["read_files", "read_themes", "write_themes", "read_orders", "unauthenticated_read_checkouts"]) assert.ok(scopes.has(scope), scope);
  assert.equal(scopes.has("read_products"), false);
});
