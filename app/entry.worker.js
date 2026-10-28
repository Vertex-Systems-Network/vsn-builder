// Cloudflare React Router SSR entry candidate (not wired into the hosted
// application yet). Never import app/entry.server.jsx into a Worker: that file
// uses Node PassThrough. Shopify CSP must be applied by the SDK *before* here.
import { createElement } from "react";
import { ServerRouter } from "react-router";
import { addDocumentResponseHeaders } from "./shopify.worker.server.js";
import { renderWorkerDocument } from "./services/worker-ssr-webstream.js";

export const streamTimeout=5000;

export default function handleWorkerDocument(
  request,responseStatusCode,responseHeaders,reactRouterContext,
){
  return renderWorkerDocument({
    request,
    responseStatusCode,
    responseHeaders,
    reactElement:createElement(ServerRouter,{
      context:reactRouterContext,
      url:request.url,
    }),
    addShopifyHeaders:addDocumentResponseHeaders,
    signal:request.signal,
  });
}
