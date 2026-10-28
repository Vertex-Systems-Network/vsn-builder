// Staging-only bridge between Cloudflare Fetch and the complete React Router
// merchant graph. Auth and Neon are initialized per request; the database is
// closed only after the response stream finishes or is cancelled.
import { runWithWorkerRequestContext } from "./worker-request-context.server.js";
import { logStagingFailure, logStagingRequest } from "./worker-diagnostics.js";
import { isHostedWorker } from "./worker-hosted-tier.js";

const SAFE_HEADERS=Object.freeze({
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
});
const locked=(status=503)=>new Response(null,{status,headers:SAFE_HEADERS});
const bypassToLegacy=path=>path==="/healthz"||path==="/readyz"||
  path==="/__vsn/database-health"||path.startsWith("/__vsn/")||
  path.startsWith("/app/__vsn/");
const isStaticAsset=path=>path.startsWith("/assets/")||path.startsWith("/build/")||
  path==="/favicon.ico"||path==="/favicon.svg";

function closeAfterBody(response,context) {
  let closePromise;
  const close=()=>closePromise||(closePromise=Promise.resolve().then(()=>context.close()));
  if(!response.body){
    return close().then(()=>response);
  }
  const reader=response.body.getReader();
  const body=new ReadableStream({
    async pull(controller){
      try{
        const chunk=await reader.read();
        if(chunk.done){controller.close();await close();return;}
        controller.enqueue(chunk.value);
      }catch(error){
        controller.error(error);
        try{await close()}catch{/* preserve stream failure */}
      }
    },
    async cancel(reason){
      try{await reader.cancel(reason)}finally{await close()}
    },
  });
  return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
}

export function createStagingFullAppRouterWorker({
  makeRequestHandler,
  loadServerBuild,
  createSdkContext,
  legacyWorker,
  mode="production",
}={}){
  if(typeof makeRequestHandler!=="function"||typeof loadServerBuild!=="function"||
     typeof createSdkContext!=="function"||typeof legacyWorker?.fetch!=="function")
    throw new TypeError("Full app Worker dependencies are required");
  let requestHandler;
  const handler=()=>requestHandler||(requestHandler=makeRequestHandler(loadServerBuild,mode));
  return Object.freeze({
    async fetch(request,env,ctx){
      if(!(request instanceof Request))return locked();
      let url;
      try{url=new URL(request.url)}catch{return locked(400)}
      if(!isHostedWorker(env)||
         env?.VSN_STAGING_REACT_ROUTER_ENABLED!=="true")
        return legacyWorker.fetch(request,env,ctx);
      if(bypassToLegacy(url.pathname))return legacyWorker.fetch(request,env,ctx);
      // Shop-less entry points cannot be rendered as an embedded document (the SDK
      // only issues frame-ancestors for a known shop). The legacy Worker owns them:
      // "/" and "/app" redirect to the SDK login form, which has its own strict CSP.
      if(request.method==="GET"&&!url.searchParams.has("shop")&&
         (url.pathname==="/"||url.pathname==="/app"||url.pathname==="/auth/login"))
        return legacyWorker.fetch(request,env,ctx);
      if(isStaticAsset(url.pathname)){
        if(!env?.ASSETS||typeof env.ASSETS.fetch!=="function")return locked(404);
        try{return await env.ASSETS.fetch(request)}catch{return locked()}
      }

      let context;
      try{
        context=await createSdkContext(request,env);
        if(!context||typeof context.close!=="function"||!context.database||!context.shopify)
          throw new Error("Missing request-scoped Shopify/Neon runtime");
        // Only the non-secret tier marker enters AsyncLocalStorage so route
        // error boundaries can emit Staging-only classified diagnostics.
        context.runtimeTier=env.APP_ENV;
        const response=await runWithWorkerRequestContext(context,()=>handler()(
          request,{cloudflare:{env,ctx}},
        ));
        if(!(response instanceof Response))throw new TypeError("React Router returned no Response");
        const completed=await closeAfterBody(response,context);
        context=null;
        logStagingRequest(env,request,completed);
        return completed;
      }catch(error){
        try{await context?.close?.()}catch{/* do not disclose database errors */}
        logStagingFailure(env,"full-app-router",error);
        const response=locked();
        logStagingRequest(env,request,response);
        return response;
      }
    },
  });
}
