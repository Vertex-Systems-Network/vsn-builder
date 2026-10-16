// Staging-only, SDK-owned Shopify authentication completion boundary.
// No hand-rolled OAuth, HMAC, token decoding, cookie issuance or billing.
// Deliberately OFF by default and NEVER authorized in Production.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";
import { hasCanonicalStagingOAuthQuery } from "./worker-shopify-auth-query.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const AUTH_ROUTE=/^\/auth\/(?!login(?:\/|$))[a-z0-9-]{1,64}$/;
const denied=(status=503)=>new Response(null,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff",
}});
const validTime=value=>value instanceof Date&&Number.isFinite(value.getTime());
const validSession=(persisted,current)=>{
  if(!persisted||persisted.shop!==current.shop||
     persisted.id!==current.id||
     persisted.isOnline!==current.isOnline ||
     persisted.accessToken!==current.accessToken)return false;
  const cutoff=Date.now();
  for(const x of [persisted,current]){
    if(x.expires!=null && (!validTime(x.expires)||x.expires.getTime()<=cutoff))
      return false;
    // Online tokens represent user sessions and MUST have explicit expiry.
    if(x.isOnline && !validTime(x.expires))return false;
  }
  return true;
};

/**
 * React Router template's /auth/$ calls authenticate.admin(request).
 * This Worker uses the same *official* Shopify SDK, with verified persisted
 * Neon sessions, and the SDK's own embedded redirect transport.
 *
 * SDK-thrown Response is passed through intact, including login/callback
 * redirects and Set-Cookie headers; all other failures become empty 503.
 * Do not call this handler without a protected, migrated staging database.
 */
export async function handleVerifiedStagingShopifyAuth(request,env,{
  createSdkContext=createWorkerShopifySdkContext,
}={}){
  if(!(request instanceof Request) ||
     request.method!=="GET"||
     env?.APP_ENV!=="staging"||
     env?.VSN_WORKER_NAME!=="vsn-builder-staging"||
     env?.VSN_STAGING_OAUTH_ENABLED!=="true")
    return denied();
  const url=new URL(request.url);
  if(!AUTH_ROUTE.test(url.pathname))return denied(404);
  // Canonical query shape is checked BEFORE any SDK/Neon I/O; do not
  // let duplicate signed parameters be interpreted differently by layers.
  if(!hasCanonicalStagingOAuthQuery(url,"callback"))return denied(400);
  const hintedShop=url.searchParams.get("shop");
  if(hintedShop!==null && !SHOP.test(hintedShop))return denied(400);
  if(!inspectWorkerShopifyConfiguration(request,env).ready ||
     !inspectWorkerNeonEnvironment(env).ready)return denied();
  let context;
  try{
    context=await createSdkContext(request,env);
    if(typeof context?.shopify?.authenticate?.admin!=="function" ||
       typeof context?.database?.builderShopInstallation?.findUnique!=="function" ||
       typeof context?.database?.session?.findUnique!=="function" ||
       typeof context?.close!=="function")return denied();
    // The official package performs the entire Shopify session-token/OAuth
    // handshake and persists the resulting session through our fenced
    // PrismaSessionStorage. Never decode or trust the callback query ourselves.
    const auth=await context.shopify.authenticate.admin(request);
    const session=auth?.session;
    if(!SHOP.test(String(session?.shop||"")) ||
       typeof session?.id!=="string" || !session.id ||
       typeof session?.accessToken!=="string" || !session.accessToken ||
       typeof session?.isOnline!=="boolean")
      return denied(401);
    const hint=url.searchParams.get("shop");
    if(hint!==null && hint!==session.shop)return denied(401);
    const lifecycle=await context.database.builderShopInstallation.findUnique({
      where:{shop:session.shop},
    });
    if(!lifecycle || lifecycle.shop!==session.shop ||
       !validTime(lifecycle.installedAt) || lifecycle.uninstalledAt!==null)
      return denied(403);
    const stored=await context.database.session.findUnique({
      where:{id:session.id},
    });
    if(!validSession(stored,session))return denied(403);
    if(typeof auth?.redirect!=="function")return denied();
    const response=await auth.redirect("/app?shop="+encodeURIComponent(session.shop));
    if(!(response instanceof Response)||response.status<300||
       response.status>=400)return denied();
    // Shopify's redirect transport may include cookies, embedded navigation
    // headers and app-bridge response handling. Preserve them exactly.
    const headers=new Headers(response.headers);
    headers.set("cache-control","no-store");
    headers.set("x-content-type-options","nosniff");
    return new Response(response.body,{
      status:response.status,statusText:response.statusText,headers,
    });
  }catch(error){
    if(error instanceof Response){
      // The SDK may deliberately throw a Response to complete token exchange,
      // trigger reauthorization or set a signed cookie. Never reconstruct it.
      return error;
    }
    return denied();
  }finally{
    try{await context?.close?.()}catch{/* never leak session or driver data */}
  }
}
