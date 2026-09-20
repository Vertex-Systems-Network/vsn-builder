import assert from "node:assert/strict";
import fs from "node:fs";
import { handleStorefrontFormSubmission } from "../app/services/storefront-form-submission.server.js";
import { handleLegacyStorefrontFormSubmission } from "../app/services/legacy-storefront-form-submission.server.js";
import {
  handleWishlistProxyAction,
  handleWishlistProxyLoader,
} from "../app/services/wishlist-proxy.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

function assertSecurityHeaders(response, label) {
  equal(response.headers.get("content-type"), "application/json; charset=utf-8", `${label} keeps JSON content type`);
  equal(response.headers.get("cache-control"), "no-store", `${label} remains no-store`);
  equal(response.headers.get("x-content-type-options"), "nosniff", `${label} keeps nosniff`);
  equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${label} gets shared referrer policy`);
  equal(
    response.headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=(), payment=()",
    `${label} gets restrictive permissions policy`,
  );
}

const request = new Request("https://example.test/builder-proxy/forms", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "website=bot",
});
const spamForm = new FormData();
spamForm.set("website", "bot");
const forms2 = await handleStorefrontFormSubmission(request, { shop: "test.myshopify.com" }, spamForm);
equal(forms2.status, 200, "Forms 2 honeypot keeps success status");
equal(await forms2.json(), { ok: true, spamFiltered: true }, "Forms 2 honeypot keeps payload");
assertSecurityHeaders(forms2, "Forms 2 honeypot response");

const legacyForm = new FormData();
legacyForm.set("website", "bot");
const legacy = await handleLegacyStorefrontFormSubmission({
  session: { shop: "test.myshopify.com" },
  formData: legacyForm,
});
equal(legacy.status, 200, "Legacy honeypot keeps success status");
equal(await legacy.json(), { ok: true }, "Legacy honeypot keeps payload");
assertSecurityHeaders(legacy, "Legacy form honeypot response");

const wishlistActionForm = new FormData();
wishlistActionForm.set("_vsnAction", "wishlist-sync");
const wishlistAction = await handleWishlistProxyAction({
  db: null,
  session: { shop: "test.myshopify.com" },
  formData: wishlistActionForm,
  url: new URL("https://example.test/builder-proxy/wishlist"),
});
equal(wishlistAction.status, 401, "Unauthenticated wishlist sync keeps 401 status");
equal(
  await wishlistAction.json(),
  {
    ok: false,
    authenticated: false,
    error: "Customer login required for server wishlist sync.",
  },
  "Unauthenticated wishlist sync keeps payload",
);
assertSecurityHeaders(wishlistAction, "Wishlist action response");

const wishlistLoader = await handleWishlistProxyLoader({
  db: null,
  admin: null,
  session: { shop: "test.myshopify.com" },
  url: new URL("https://example.test/builder-proxy/wishlist?wishlist=1"),
  signedCustomerId: "",
});
equal(wishlistLoader.status, 200, "Unauthenticated wishlist loader keeps 200 status");
equal(
  await wishlistLoader.json(),
  { ok: true, authenticated: false, items: [], count: 0, serverCount: 0 },
  "Unauthenticated wishlist loader keeps payload",
);
assertSecurityHeaders(wishlistLoader, "Wishlist loader response");

const files = [
  "app/services/storefront-form-submission.server.js",
  "app/services/legacy-storefront-form-submission.server.js",
  "app/services/wishlist-proxy.server.js",
];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  ok(
    source.includes("../storefront/responses.server.js"),
    `${file} imports shared hardened storefront responses`,
  );
  ok(
    !source.includes('"X-Content-Type-Options": "nosniff"'),
    `${file} no longer duplicates partial JSON security headers`,
  );
  ok(
    !source.includes("new Response(JSON.stringify"),
    `${file} no longer constructs local JSON responses`,
  );
}
const formsSource = fs.readFileSync(files[0], "utf8");
const legacySource = fs.readFileSync(files[1], "utf8");
const wishlistSource = fs.readFileSync(files[2], "utf8");
ok(!formsSource.includes("function jsonResponse("), "Forms 2 service no longer owns jsonResponse helper");
ok(!legacySource.includes("function jsonResponse("), "Legacy form service no longer owns jsonResponse helper");
ok(!wishlistSource.includes("function json("), "Wishlist proxy no longer owns local json helper");
ok(wishlistSource.includes("jsonResponse as json"), "Wishlist keeps historical call sites through shared-helper alias");

console.log(`VSN P1.6h storefront JSON response convergence audit: PASS (${checks}/${checks})`);
