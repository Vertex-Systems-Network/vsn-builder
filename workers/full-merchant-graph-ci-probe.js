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
    return new Response(null, { status: 503, headers: DENY });
  },
};
