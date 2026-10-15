// Cloudflare-safe React Router document renderer, isolated from the Node SSR
// entry and its PassThrough/Prisma/Shopify-Node transitive imports.
// Rendering HTML is NOT merchant authentication or Shopify OAuth.
import { renderToReadableStream } from "react-dom/server.browser";
import { isbot } from "isbot";

const HEADERS=Object.freeze({
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"strict-origin-when-cross-origin",
  "permissions-policy":"camera=(), microphone=(), geolocation=()",
});
function denied(status=503){
  return new Response(null,{status,headers:HEADERS});
}
export async function renderEdgeHtml(request,status,headers,element,{
  render=renderToReadableStream,
  bot=isbot,
}={}){
  if(!(request instanceof Request) || request.method!=="GET" ||
     !element || typeof render!=="function")return denied(503);
  const url=new URL(request.url);
  // The Shopify SDK must supply merchant-specific frame-ancestors/CSP *after*
  // authenticating and checking persisted sessions. Do not generate a generic
  // permissive CSP for an embedded app or accept one from URL parameters.
  const outgoing=new Headers(headers);
  const isMerchant=url.pathname==="/app" || url.pathname.startsWith("/app/");
  if(isMerchant){
    const csp=outgoing.get("content-security-policy")||"";
    if(!/(?:^|;)\s*frame-ancestors\s+[^;]+/i.test(csp))
      return denied(503);
  }
  // Response body must not be reused across requests.
  outgoing.delete("content-length");
  outgoing.delete("transfer-encoding");
  for(const [k,v] of Object.entries(HEADERS))outgoing.set(k,v);
  outgoing.set("content-type","text/html; charset=utf-8");
  if(!outgoing.has("x-request-id"))outgoing.set("x-request-id",crypto.randomUUID());
  let didError=false;
  try{
    const stream=await render(element,{
      signal:request.signal,
      onError(){didError=true;},
    });
    if(!(stream instanceof ReadableStream))return denied(503);
    if(bot(request.headers.get("user-agent")||"") && stream.allReady)
      await stream.allReady;
    if(didError)return denied(503);
    const code=Number.isInteger(status)&&status>=200&&status<=599?status:503;
    return new Response(stream,{status:code,headers:outgoing});
  }catch{
    return denied(503);
  }
}
