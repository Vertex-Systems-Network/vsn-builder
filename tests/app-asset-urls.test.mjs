import test from "node:test";
import assert from "node:assert/strict";
import { absolutizeAppAssetUrls } from "../app/storefront/appAssetUrls.js";

test("template stock media is made absolute for the shop domain, https app URLs only", () => {
  const css = 'a{background-image:url(/vsn-stock/f.svg)} <img src="/vsn-stock/x.svg">';
  assert.equal(absolutizeAppAssetUrls(css, "https://app.example.com/"), 'a{background-image:url(https://app.example.com/vsn-stock/f.svg)} <img src="https://app.example.com/vsn-stock/x.svg">');
  assert.equal(absolutizeAppAssetUrls(css, "http://insecure.test"), css);
  assert.equal(absolutizeAppAssetUrls("/other/vsn-stock/z.svg", "https://a.test"), "/other/vsn-stock/z.svg");
});
