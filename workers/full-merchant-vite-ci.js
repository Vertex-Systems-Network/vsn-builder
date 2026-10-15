// T020 Cloudflare-native Vite build experiment for actual VSN Builder routes.
// This module is NOT the hosted workers/app.js. All merchant traffic is denied.
// A successful CI build does not authorize a merchant route or Shopify session.
import { createRequestHandler } from "react-router";
const loadServerBuild = () => import("virtual:react-router/server-build");
const SAFE_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
});
export default {
  async fetch(request,env) {
    if (!(request instanceof Request) ||
        env?.APP_ENV !== "test" ||
        env?.VSN_BUILD_INTENT !== "cloudflare-vite-full-merchant-ci" ||
        Object.keys(env).length !== 2) {
      return new Response(null,{status:503,headers:SAFE_HEADERS});
    }
    // No route dispatch. Keeping the real framework API and the actual
    // virtual server build in the Worker import graph tests native bundling.
    void createRequestHandler;
    void loadServerBuild;
    return new Response(null,{status:503,headers:SAFE_HEADERS});
  },
};
