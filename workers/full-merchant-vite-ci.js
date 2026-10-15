// T020 Cloudflare-native Vite build experiment for the REAL VSN Builder route
// graph. Never deploy. No Shopify/Neon credentials; all merchant routes 503.
import { createRequestHandler } from "react-router";
const loadServerBuild = () => import("virtual:react-router/server-build");
const SAFE_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
});
const locked = () => new Response(null,{status:503,headers:SAFE_HEADERS});
export default {
  async fetch(request,env) {
    if (!(request instanceof Request) ||
        env?.APP_ENV !== "test" ||
        env?.VSN_BUILD_INTENT !== "cloudflare-vite-full-merchant-ci" ||
        Object.keys(env).length !== 2) return locked();

    const url = new URL(request.url);
    const testOnly = request.method === "GET" &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.pathname === "/__vsn/cf-vite-merchant-graph" &&
      !url.search && !url.hash &&
      !request.headers.has("cookie") &&
      !request.headers.has("authorization") &&
      !request.headers.has("x-shopify-hmac-sha256");

    if (!testOnly) return locked();
    try {
      const build = await loadServerBuild();
      const routeCount = Object.keys(build?.routes || {}).length;
      if (routeCount > 10 && typeof createRequestHandler === "function") {
        return new Response(JSON.stringify({
          ciOnly: true, actualMerchantGraphLoaded: true,
          routeCountAboveMinimum: true,
        }),{status:200,headers:{...SAFE_HEADERS,
          "content-type":"application/json; charset=utf-8"}});
      }
    } catch {
      // No error details, secret values or stack traces over HTTP.
    }
    return locked();
  },
};
