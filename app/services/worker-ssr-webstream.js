// Cloudflare/Web Streams rendering primitive, isolated from the Node/SQLite app.
// Not a runnable Shopify Worker: a certified Shopify header provider and
// Cloudflare-compatible route/auth adapter must be integrated before deployment.
import { renderToReadableStream } from "react-dom/server.browser";
import { isbot } from "isbot";

export async function renderWorkerDocument({
  request,
  reactElement,
  responseStatusCode = 200,
  responseHeaders = new Headers(),
  addShopifyHeaders,
  signal,
} = {}) {
  if (!(request instanceof Request)) throw new TypeError("Worker SSR requires a Request");
  if (typeof addShopifyHeaders !== "function") {
    throw new Error("Shopify document security headers have not been wired for Workers");
  }
  if (reactElement == null) throw new TypeError("React element is required");
  if (!Number.isInteger(responseStatusCode) || responseStatusCode < 200 || responseStatusCode > 599) {
    throw new RangeError("Invalid Worker SSR response status");
  }
  const headers = new Headers(responseHeaders);
  // The real Shopify SDK must supply this callback; never silently bypass its
  // frame-ancestor/CSP checks for an embedded Shopify app.
  await addShopifyHeaders(request, headers);
  if (!headers.has("content-security-policy")) {
    throw new Error("Shopify document Content-Security-Policy is missing");
  }
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  headers.set("cross-origin-opener-policy","same-origin-allow-popups");
  headers.set("content-type","text/html; charset=utf-8");
  headers.set("cache-control","no-store");
  if(!headers.has("x-request-id"))headers.set("x-request-id",request.headers.get("x-request-id")||crypto.randomUUID());

  let renderFailed=false;
  const stream=await renderToReadableStream(reactElement,{
    signal,
    onError() {
      // Do not log errors here: they may include Shopify sessions/tokens.
      renderFailed=true;
    },
  });
  // Bots need complete content for reliable indexing (React Web Stream
  // semantics); human requests may be progressively streamed.
  if(isbot(request.headers.get("user-agent")||""))await stream.allReady;
  return new Response(stream,{
    status:renderFailed?500:responseStatusCode,
    headers,
  });
}
