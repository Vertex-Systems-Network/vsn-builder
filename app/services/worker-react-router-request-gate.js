// Strictly isolated React Router / Cloudflare Fetch bridge.
// This only proves the official createRequestHandler call signature and
// Cloudflare load-context wiring. NOT a merchant router or OAuth entrypoint.
// Real /app, /auth, webhooks, billing and assets remain in the locked Worker.
const SAFE_HEADERS={
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
  "referrer-policy":"no-referrer",
};
const EXPECTED_KEYS=["APP_ENV","VSN_BUILD_INTENT"];
const ALLOWED_HOST=/^(?:localhost|127\.0\.0\.1|[a-z0-9-]+\.test)$/i;
const PROBE_PATH="/__vsn/react-router-smoke";
const blocked=(status=503)=>new Response(null,{status,headers:SAFE_HEADERS});

function ciOnlyEnvironment(env) {
  if(!env || typeof env!=="object" ||
    env.APP_ENV!=="test" || env.VSN_BUILD_INTENT!=="react-router-ci")
    return false;
  // An accidental deployment with real store/DB secrets cannot satisfy this
  // gate, even if someone adds the test-mode environment variables.
  const keys=Object.keys(env).sort();
  return keys.length===EXPECTED_KEYS.length &&
    keys.every((key,i)=>key===EXPECTED_KEYS[i]);
}

/** A locked CI-only bridge. The request handler must have a tested build. */
export function createIsolatedReactRouterGateway({
  makeRequestHandler,
  loadServerBuild,
  mode="production",
}={}){
  // This is a factory, NOT a reusable, initialized customer route handler.
  return {
    async fetch(request,env,ctx) {
      if(!(request instanceof Request) || !ciOnlyEnvironment(env))
        return blocked();
      let url;
      try{url=new URL(request.url)}catch{return blocked(400)}
      if(!ALLOWED_HOST.test(url.hostname) || url.protocol!=="https:" &&
          url.protocol!=="http:")
        return blocked();
      if(url.pathname!==PROBE_PATH || url.search || url.hash ||
          request.method!=="GET")
        return blocked(404);
      // Fail closed on traffic that resembles a real merchant request.
      if(request.headers.has("authorization") ||
         request.headers.has("cookie") ||
         request.headers.has("x-shopify-hmac-sha256") ||
         request.headers.has("x-shopify-shop-domain"))
        return blocked(403);
      if(typeof makeRequestHandler!=="function" ||
         typeof loadServerBuild!=="function" || mode!=="production")
        return blocked();
      try{
        // Cloudflare docs: createRequestHandler(() => import(server-build),
        // import.meta.env.MODE), handler(request,{cloudflare:{env,ctx}}).
        const handler=makeRequestHandler(loadServerBuild,mode);
        if(typeof handler!=="function")return blocked();
        // Never forward production secrets or an arbitrary Worker env object.
        const context={cloudflare:{
          env:{APP_ENV:"test",VSN_BUILD_INTENT:"react-router-ci"},
          ctx,
        }};
        const response=await handler(request,context);
        if(!(response instanceof Response) || response.status!==200)
          return blocked();
        // The route should only return a small static CI document; untrusted
        // redirect/set-cookie/body metadata is not propagated.
        const type=response.headers.get("content-type")||"";
        if(!type.startsWith("text/html"))return blocked();
        const length=Number(response.headers.get("content-length"));
        if(Number.isFinite(length) && length>65536)return blocked();
        const body=await response.text();
        if(body.length>65536)return blocked();
        return new Response(body,{status:200,headers:{
          ...SAFE_HEADERS,"content-type":"text/html; charset=utf-8",
        }});
      }catch{
        // No stack traces, route data, connection strings or SDK tokens.
        return blocked();
      }
    },
  };
}
