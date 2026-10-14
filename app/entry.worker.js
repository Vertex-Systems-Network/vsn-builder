// Cloudflare React Router SSR entry candidate (not wired into the hosted
// application yet). Never import app/entry.server.jsx into a Worker: that file
// uses Node PassThrough. Shopify CSP must be applied by the SDK *before* here.
import { createElement } from "react";
import { ServerRouter } from "react-router";
import { renderEdgeHtml } from "./services/worker-edge-html.server.js";

export default function handleWorkerDocument(
  request,responseStatusCode,responseHeaders,reactRouterContext,
){
  return renderEdgeHtml(
    request,responseStatusCode,responseHeaders,
    createElement(ServerRouter,{
      context:reactRouterContext,
      url:request.url,
    }),
  );
}
