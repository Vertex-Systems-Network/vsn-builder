// T020 staging-only synthetic integration of the ACTUAL Shopify SDK session
// authorization boundary with a Vite-generated React Router resource loader.
// NOT the merchant application entrypoint; workers/app.js stays 503 locked.
// Do not generalize its one CI-only URL into a route dispatcher.
import {acceptWorkerShopifyAdminRequest} from "./worker-shopify-admin-gate.js";
import { isHostedTier } from "./worker-hosted-tier.js";

const ROUTE="/app/__vsn-auth-smoke";
const HEADERS=Object.freeze({
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
});
const failed=(code=503)=>new Response(null,{status:code,headers:HEADERS});
const CAP=16*1024;
const DEADLINE_MS=1500;
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

// Finish the entire router response while the request's trusted SDK/DB context
// is still alive; do not stream database-dependent data after close().
async function boundedHtml(response){
  if(!(response instanceof Response)||response.status!==200 ||
    !(response.headers.get("content-type")||"").startsWith("text/html") ||
    response.headers.has("set-cookie") || !response.body)return failed();
  if(Number(response.headers.get("content-length"))>CAP)return failed();
  const reader=response.body.getReader();
  const chunks=[];
  let length=0;
  const deadline=Date.now()+DEADLINE_MS;
  try{
    // eslint-disable-next-line no-constant-condition -- intentional bounded loop
    while(true){
      const remaining=deadline-Date.now();
      if(remaining<=0)return failed();
      let timer;
      const result=await Promise.race([
        reader.read(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("response timeout")),remaining);}),
      ]).finally(()=>clearTimeout(timer));
      if(result.done)break;
      if(!(result.value instanceof Uint8Array))return failed();
      length+=result.value.byteLength;
      if(length>CAP)return failed();
      chunks.push(result.value);
    }
  }catch{
    return failed();
  }finally{
    try{void reader.cancel().catch(()=>{})}catch{ /* best-effort */ }
    try{reader.releaseLock()}catch{ /* best-effort */ }
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new Response(bytes,{status:200,headers:{
    ...HEADERS,"content-type":"text/html; charset=utf-8",
  }});
}

export function createAuthenticatedWorkerRouterBridge({
  makeRequestHandler,loadServerBuild,createSdkContext,
}={}){
  return {
    async fetch(request,env,executionContext){
      if(!(request instanceof Request))return failed(400);
      let url;
      try{url=new URL(request.url);}catch{return failed(400);}
      // NEVER use this synthetic probe as a general /app route handler.
      if(url.pathname!==ROUTE||url.hash||request.method!=="GET" ||
         url.searchParams.size>1 ||
         [...url.searchParams.keys()].some(key=>key!=="shop"))
        return failed(404);
      if(!isHostedTier(env) || typeof makeRequestHandler!=="function" ||
         typeof loadServerBuild!=="function")
        return failed();
      // Official Shopify authenticates first; persisted token/installation and
      // expiry are verified by the Admin gate BEFORE this callback executes.
      return acceptWorkerShopifyAdminRequest(request,env,{
        ...(createSdkContext?{createSdkContext}:{}),
        async onAuthenticated({request:authorized,shop}){
          if(!SHOP.test(shop))return failed();
          const handler=makeRequestHandler(loadServerBuild,"production");
          if(typeof handler!=="function")return failed();
          // Never expose Shopify access tokens, session IDs, database clients,
          // Partner secrets, or mutable transactions to the fixture loader.
          const result=await handler(authorized,{
            cloudflare:{
              env:{APP_ENV:"staging",VSN_AUTH_PROBE:"true"},
              ctx:executionContext,
            },
            merchant:{shop},
          });
          return boundedHtml(result);
        },
      });
    },
  };
}
