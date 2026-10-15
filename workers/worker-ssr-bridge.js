// Stage-only, not an automatic entry.server.jsx replacement.
// React Router route bundle can call this bridge only after a certified
// Shopify Cloudflare adapter and security-header injection exist.
import { createElement } from "react";
import { ServerRouter } from "react-router";
import { renderWorkerDocument } from "../app/services/worker-ssr-webstream.js";

export function renderWorkerReactRouter(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
  { addShopifyHeaders, signal } = {},
) {
  if (!reactRouterContext || typeof reactRouterContext !== "object") {
    throw new TypeError("React Router server context not available");
  }
  return renderWorkerDocument({
    request,responseStatusCode,responseHeaders,
    reactElement:createElement(ServerRouter,{context:reactRouterContext,url:request.url}),
    addShopifyHeaders,signal,
  });
}
