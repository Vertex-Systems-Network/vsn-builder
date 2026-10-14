// Disposable CI-only Cloudflare Worker SSR probe, NOT the Shopify merchant app.
// Does not connect to Neon, authenticate merchants, bill, deploy, or unlock /app.
import { createElement } from "react";
import { renderEdgeHtml } from "../app/services/worker-edge-html.server.js";

const EMPTY=Object.freeze({"cache-control":"no-store","x-content-type-options":"nosniff"});
export default {
  async fetch(request,env) {
    if(!(request instanceof Request) || env?.APP_ENV!=="test" ||
       env?.VSN_BUILD_INTENT!=="edge-ssr-ci")
      return new Response(null,{status:503,headers:EMPTY});
    const url=new URL(request.url);
    if(url.pathname!=="/__vsn/edge-ssr-smoke" || url.search ||
       request.method!=="GET")
      return new Response(null,{status:404,headers:EMPTY});
    return renderEdgeHtml(request,200,{
      "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
    },createElement("main",{"data-vsn-probe":"edge-ssr"},
       "VSN Builder Cloudflare Web Streams SSR proof"));
  },
};
