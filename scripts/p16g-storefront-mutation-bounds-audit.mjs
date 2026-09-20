import assert from "node:assert/strict";
import fs from "node:fs";
import {
  boundedStorefrontFormData,
  boundedStorefrontText,
  STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS,
  STOREFRONT_MUTATION_MAX_BYTES,
  STOREFRONT_WISHLIST_ITEMS_MAX_CHARS,
} from "../app/storefront/mutationRequest.server.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

async function expect413(promise, message) {
  let thrown = null;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  ok(thrown instanceof Response, `${message}: throws a Response`);
  equal(thrown.status, 413, `${message}: status is 413`);
  equal(thrown.headers.get("content-type"), "application/json; charset=utf-8", `${message}: response is JSON`);
  equal(thrown.headers.get("cache-control"), "no-store", `${message}: response is no-store`);
  equal(thrown.headers.get("x-content-type-options"), "nosniff", `${message}: response keeps nosniff`);
  equal(thrown.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${message}: response keeps referrer policy`);
  equal(thrown.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=()", `${message}: response keeps restrictive permissions policy`);
  return thrown;
}

equal(STOREFRONT_MUTATION_MAX_BYTES, 32 * 1024 * 1024, "Aggregate storefront mutation ceiling is 32 MiB");
equal(STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS, 16 * 1024, "Experiment metadata parse cap is 16 KiB");
equal(STOREFRONT_WISHLIST_ITEMS_MAX_CHARS, 2 * 1024 * 1024, "Wishlist JSON parse cap is 2 MiB");

const accepted = new Request("https://example.test/builder-proxy/forms", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "formType=contact&email=hello%40example.com",
});
const acceptedForm = await boundedStorefrontFormData(accepted, { maxBytes: 1024 });
equal(acceptedForm.get("formType"), "contact", "Accepted body replays normal FormData semantics");
equal(acceptedForm.get("email"), "hello@example.com", "Accepted form field decoding remains intact");

const declaredTooLarge = new Request("https://example.test/builder-proxy/forms", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    "content-length": "2048",
  },
  body: "a=1",
});
await expect413(
  boundedStorefrontFormData(declaredTooLarge, { maxBytes: 1024 }),
  "Oversized Content-Length precheck",
);

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("field="));
    controller.enqueue(new Uint8Array(20).fill(97));
    controller.close();
  },
});
const streamedTooLarge = new Request("https://example.test/builder-proxy/forms", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: stream,
  duplex: "half",
});
await expect413(
  boundedStorefrontFormData(streamedTooLarge, { maxBytes: 16 }),
  "Streamed byte ceiling without Content-Length",
);

equal(boundedStorefrontText("abc", 3), "abc", "Bounded text preserves accepted content");
await expect413(
  Promise.resolve().then(() => boundedStorefrontText("abcd", 3, "Field too large.")),
  "Bounded text rejects oversized parse surfaces",
);

const secureRoute = fs.readFileSync("app/routes/builder-proxy-secure.$.jsx", "utf8");
const helperSource = fs.readFileSync("app/storefront/mutationRequest.server.js", "utf8");
const wishlistProxy = fs.readFileSync("app/services/wishlist-proxy.server.js", "utf8");

ok(secureRoute.includes("boundedStorefrontFormData(request)"), "Secure proxy consumes the bounded form parser");
ok(!secureRoute.includes("await request.formData()"), "Secure proxy cannot parse the public body before the aggregate ceiling");
ok(secureRoute.includes("STOREFRONT_EXPERIMENT_METADATA_MAX_CHARS"), "Secure proxy caps experiment metadata before JSON.parse");
ok(secureRoute.includes('if (error instanceof Response) return error;'), "Secure proxy preserves fail-closed Response status/headers");

const authIndex = secureRoute.indexOf("authenticate.public.appProxy(request)");
const parseIndex = secureRoute.indexOf("boundedStorefrontFormData(request)");
ok(authIndex >= 0 && parseIndex > authIndex, "App-proxy authentication still runs before body streaming/parsing");

const metadataBoundIndex = secureRoute.indexOf("boundedStorefrontText(");
const metadataParseIndex = secureRoute.indexOf("JSON.parse(metadataRaw)");
ok(metadataBoundIndex >= 0 && metadataParseIndex > metadataBoundIndex, "Experiment metadata is bounded before JSON.parse");

ok(wishlistProxy.includes("STOREFRONT_WISHLIST_ITEMS_MAX_CHARS"), "Wishlist proxy consumes dedicated JSON parse cap");
ok(wishlistProxy.includes("JSON.parse(boundedStorefrontText("), "Wishlist JSON parse is fed directly by bounded text");
ok(wishlistProxy.includes("if (error instanceof Response) return error"), "Wishlist proxy preserves 413 Response from bounded text");

for (const marker of [
  "request.body.getReader()",
  "reader.cancel()",
  'headers.delete("content-length")',
  "Buffer.concat(chunks)",
  'duplex: "half"',
  "jsonResponse({ ok: false, error: message }, 413)",
]) {
  ok(helperSource.includes(marker), `Mutation request helper marker missing: ${marker}`);
}

for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "builderPage.",
  "shopify.server",
  "process.env",
]) {
  ok(!helperSource.includes(forbidden), `Mutation request helper gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6g storefront mutation bounds audit: PASS (${checks}/${checks})`);
