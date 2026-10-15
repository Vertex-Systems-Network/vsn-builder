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
      // A manifest too small for the real Builder is not merchant readiness.
      return new Response(JSON.stringify({
        ciOnly:true,actualMerchantGraphLoaded:false,
        blocked:"REACT_ROUTER_MANIFEST_INVALID",
      }),{status:503,headers:{...SAFE_HEADERS,
        "content-type":"application/json; charset=utf-8"}});
    } catch (error) {
      // This enum is exposed only to localhost with an exact synthetic test
      // identity. Never serialize exceptions, stack traces or secrets.
      const message=String(error?.message||"");
      const blocked=/fileURLToPath|path.*argument/i.test(message)
        ? "NODE_FILE_URL_BOOTSTRAP" :
        /prisma|sqlite|database|engine/i.test(message)
        ? "NODE_DATABASE_CLIENT" :
        /shopify|api.?key|session/i.test(message)
        ? "SHOPIFY_MODULE_BOOTSTRAP" :
        /import|module|require|node:/i.test(message)
        ? "NODE_MODULE_IMPORT" :
        "MERCHANT_SERVER_MODULE";
      // Only this test-only localhost route may read sanitized diagnostics.
      // Do not include original stack traces, environment objects or URLs.
      const ciCause=message
        .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi,"[URL]")
        .replace(/(?:api[-_]?key|secret|token|password)\s*[:=]\s*[^\s,"']+/gi,"[SECRET]")
        .replace(/\b[0-9a-f]{32,}\b/gi,"[HEX]")
        .replace(/\s+/g," ").slice(0,180);
      return new Response(JSON.stringify({
        ciOnly:true,actualMerchantGraphLoaded:false,blocked,ciCause,
      }),{status:503,headers:{...SAFE_HEADERS,
        "content-type":"application/json; charset=utf-8"}});
    }
  },
};
