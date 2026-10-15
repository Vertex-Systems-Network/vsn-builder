// T020 isolated compatibility proof. Imports the FULL actual VSN Builder
// merchant SSR bundle, official Shopify Worker SDK and PrismaNeon constructor.
// It does NOT dispatch merchant routes, authenticate users or deploy anywhere.
// The purpose is to make Wrangler surface unsupported imports and bundling gaps.
import { createRequestHandler } from "react-router";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";

export const loadFullMerchantBuild = () => import("../build/server/index.js");

// Keep all four integration inputs referenced so bundlers cannot discard the
// code paths whose compatibility we are deliberately testing.
const mandatoryDependencies = Object.freeze([
  createRequestHandler,
  createWorkerShopifySdkContext,
  createWorkerNeonPrisma,
  loadFullMerchantBuild,
]);

const DENY = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

export default {
  async fetch(request, env) {
    // This is never a staging/production app and cannot be promoted by
    // supplying secrets. The full route graph is imported for build-time
    // compatibility ONLY and is not evaluated from HTTP requests.
    if (!(request instanceof Request) ||
        !env || Object.keys(env).length !== 2 ||
        env.APP_ENV !== "test" ||
        env.VSN_BUILD_INTENT !== "full-merchant-graph-compat" ||
        mandatoryDependencies.length !== 4) {
      return new Response(null, { status: 503, headers: DENY });
    }
    // CI-only local Workerd proof; this loads the real merchant build module
    // but NEVER dispatches a merchant route or supplies Shopify credentials.
    let url;
    try { url = new URL(request.url); } catch { return new Response(null, { status: 503, headers: DENY }); }
    const isLocal = url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (isLocal && request.method === "GET" &&
        url.pathname === "/__vsn/full-merchant-module-proof" &&
        !url.search && !url.hash &&
        !request.headers.has("cookie") &&
        !request.headers.has("authorization") &&
        !request.headers.has("x-shopify-hmac-sha256")) {
      try {
        const build = await loadFullMerchantBuild();
        const routes = build?.routes && Object.keys(build.routes).length;
        if (Number.isInteger(routes) && routes > 10 && build?.entry) {
          return new Response(JSON.stringify({
            ciOnly: true, fullMerchantModuleEvaluated: true,
            routeManifestPresent: true,
          }), { status: 200, headers: {
            ...DENY, "content-type": "application/json; charset=utf-8",
          } });
        }
        return new Response(JSON.stringify({
          ciOnly: true, fullMerchantModuleEvaluated: false,
          blocked: "REACT_ROUTER_SERVER_BUILD_EXPORTS",
        }), { status: 503, headers: {
          ...DENY, "content-type": "application/json; charset=utf-8",
        } });
      } catch (error) {
        // Diagnostics are intentionally restricted to the CI-only loopback
        // test route. Never serialize raw SDK errors, stack traces, tokens or
        // connection URLs. The category identifies the migration frontier.
        const detail = String(error?.message || "");
        const classification =
          /api.?key|api.?secret|shopify.*config|app.?url/i.test(detail)
            ? "SHOPIFY_APP_BOOTSTRAP_CONFIGURATION" :
          /prisma|database|sqlite|wasm|engine/i.test(detail)
            ? "DATABASE_CLIENT_RUNTIME_INITIALIZATION" :
          /process\.env|node:|module|import|require/i.test(detail)
            ? "NODE_MODULE_RUNTIME_COMPATIBILITY" :
            "MERCHANT_SERVER_MODULE_EVALUATION";
        return new Response(JSON.stringify({
          ciOnly: true, fullMerchantModuleEvaluated: false,
          blocked: classification,
        }), { status: 503, headers: {
          ...DENY, "content-type": "application/json; charset=utf-8",
        } });
      }
    }
    return new Response(null, { status: 503, headers: DENY });
  },
};
