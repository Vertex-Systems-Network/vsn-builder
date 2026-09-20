import assert from "node:assert/strict";
import fs from "node:fs";
import {
  htmlResponse,
  javascriptResponse,
  jsonResponse,
} from "../app/storefront/responses.server.js";

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
  equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    `${label} keeps nosniff`,
  );
  equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
    `${label} applies shared referrer policy`,
  );
  equal(
    response.headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=(), payment=()",
    `${label} applies restrictive permissions policy`,
  );
}

const html = htmlResponse("<main>ok</main>");
equal(html.status, 200, "HTML response keeps default 200 status");
equal(html.headers.get("content-type"), "text/html; charset=utf-8", "HTML response keeps content type");
equal(
  html.headers.get("cache-control"),
  "public, max-age=15, stale-while-revalidate=30",
  "Successful HTML keeps historical cache policy",
);
equal(html.headers.get("vary"), "Accept-Encoding", "HTML response keeps Accept-Encoding vary");
equal(await html.text(), "<main>ok</main>", "HTML response keeps body unchanged");
assertSecurityHeaders(html, "HTML response");

const htmlError = htmlResponse("error", 503);
equal(htmlError.status, 503, "HTML response preserves explicit status");
equal(htmlError.headers.get("cache-control"), "no-store", "Non-200 HTML remains no-store");
assertSecurityHeaders(htmlError, "Error HTML response");

const js = javascriptResponse("window.__vsn=1;", 201);
equal(js.status, 201, "JavaScript response preserves explicit status");
equal(
  js.headers.get("content-type"),
  "application/javascript; charset=utf-8",
  "JavaScript response keeps content type",
);
equal(js.headers.get("cache-control"), "no-store", "JavaScript response remains no-store");
equal(await js.text(), "window.__vsn=1;", "JavaScript response stringifies body without mutation");
assertSecurityHeaders(js, "JavaScript response");

const json = jsonResponse({ ok: true, nested: { value: 1 } }, 202);
equal(json.status, 202, "JSON response preserves explicit status");
equal(
  json.headers.get("content-type"),
  "application/json; charset=utf-8",
  "JSON response keeps content type",
);
equal(json.headers.get("cache-control"), "no-store", "JSON response remains no-store");
equal(await json.json(), { ok: true, nested: { value: 1 } }, "JSON response keeps payload semantics");
assertSecurityHeaders(json, "JSON response");

const routes = fs.readFileSync("app/routes.js", "utf8");
const legacy = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const secure = fs.readFileSync("app/routes/builder-proxy-secure.$.jsx", "utf8");
const responses = fs.readFileSync("app/storefront/responses.server.js", "utf8");

ok(
  routes.includes('route("builder-proxy/*", "./routes/builder-proxy-secure.$.jsx")'),
  "Builder proxy URL remains manually bound to hardened secure route",
);
ok(
  routes.includes('ignoredRouteFiles: ["**/builder-proxy.$.jsx", "**/builder-proxy-secure.$.jsx"]'),
  "Filesystem routing continues to ignore both proxy implementation files",
);
ok(
  secure.includes('export { loader } from "./builder-proxy.$.jsx";'),
  "Secure proxy continues to reuse mature loader only",
);
ok(
  secure.includes("export async function action({ request })"),
  "Secure proxy remains sole active mutation owner",
);
for (const marker of [
  "authenticate.public.appProxy(request)",
  "handleWishlistProxyAction",
  "handleStorefrontFormSubmission",
  "handleLegacyStorefrontFormSubmission",
  "recordExperimentEvent",
  'eventType === "purchase"',
]) {
  ok(secure.includes(marker), `Secure mutation route guard/flow missing: ${marker}`);
}

for (const forbidden of [
  "export async function action({ request })",
  "createHmac",
  "detectSpam(",
  "recordExperimentEvent(",
  "handleStorefrontFormSubmission(",
  "handleWishlistProxyAction(",
  "fetch(endpoint.url",
  "builderFormSubmission.create",
  "builderWebhookEndpoint.findMany",
]) {
  ok(!legacy.includes(forbidden), `Legacy loader regained mutation/webhook authority: ${forbidden}`);
}

ok(
  legacy.includes('from "../storefront/responses.server.js"'),
  "Legacy loader/render implementation consumes shared response boundary",
);
ok(
  secure.includes('from "../storefront/responses.server.js"'),
  "Secure mutation route consumes shared JSON response boundary",
);
for (const duplicate of [
  "function htmlResponse(",
  "function javascriptResponse(",
  "function jsonResponse(",
]) {
  ok(!legacy.includes(duplicate), `Legacy proxy retained local response helper: ${duplicate}`);
}
ok(!secure.includes("function jsonResponse("), "Secure proxy no longer duplicates JSON response helper");

for (const marker of [
  "applyVsnSecurityHeaders",
  '"Content-Type": "text/html; charset=utf-8"',
  '"Content-Type": "application/javascript; charset=utf-8"',
  '"Content-Type": "application/json; charset=utf-8"',
  '"public, max-age=15, stale-while-revalidate=30"',
  'Vary: "Accept-Encoding"',
]) {
  ok(responses.includes(marker), `Storefront response boundary marker missing: ${marker}`);
}
ok(
  !responses.includes("Content-Security-Policy"),
  "P1.6f intentionally does not introduce an unvalidated CSP",
);
for (const forbidden of [
  "db.",
  "fetch(",
  "graphql(",
  "authenticate.",
  "builderPage.",
  "shopify.server",
  "process.env",
]) {
  ok(!responses.includes(forbidden), `Response boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6f storefront response security audit: PASS (${checks}/${checks})`);
