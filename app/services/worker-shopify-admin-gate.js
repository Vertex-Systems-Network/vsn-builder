// Future Cloudflare Worker Admin request boundaries. NOT deployed routes.
// The official Shopify React Router SDK authenticates every request.
// Mutations must hold the merchant's installation row lock across their entire
// database transaction; a previous GET-time session check is insufficient.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const denied=status=>new Response(null,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
const isDate=value=>value instanceof Date && Number.isFinite(value.getTime());
const matches=(stored,session,shop)=>!!stored &&
  stored.shop===shop && stored.isOnline===session.isOnline &&
  stored.accessToken===session.accessToken;

async function guardedAdminRequest(request,env,{
  createSdkContext=createWorkerShopifySdkContext,onAuthenticated,
}={},mutation=false) {
  if(!(request instanceof Request))return denied(400);
  if(request.method!==(mutation?"POST":"GET"))return denied(405);
  const url=new URL(request.url);
  if(url.pathname!=="/app" && !url.pathname.startsWith("/app/"))
    return denied(404);
  if(typeof onAuthenticated!=="function")return denied(503);
  if(!inspectWorkerShopifyConfiguration(request,env).ready ||
     !inspectWorkerNeonEnvironment(env).ready)return denied(503);
  const hintedShop=url.searchParams.get("shop");
  if(hintedShop!==null && !SHOP.test(hintedShop))return denied(400);
  let context;
  try {
    context=await createSdkContext(request,env);
    if(typeof context?.shopify?.authenticate?.admin!=="function" ||
       typeof context?.database?.session?.findUnique!=="function" ||
       typeof context?.database?.builderShopInstallation?.findUnique!=="function" ||
       typeof context?.close!=="function")return denied(503);

    // This is the only authentication authority. Untrusted ?shop and headers
    // are NEVER merchant credentials; ?shop is only a consistency check.
    const authenticated=await context.shopify.authenticate.admin(request);
    const session=authenticated?.session;
    const shop=session?.shop;
    if(!SHOP.test(String(shop||"")) ||
       typeof session?.id!=="string" || !session.id ||
       typeof session?.accessToken!=="string" || !session.accessToken ||
       typeof session?.isOnline!=="boolean" ||
       (hintedShop!==null && hintedShop!==shop))return denied(401);

    const lifecycle=await context.database.builderShopInstallation.findUnique({
      where:{shop}
    });
    if(!lifecycle || !isDate(lifecycle.installedAt) ||
       lifecycle.uninstalledAt!==null)return denied(403);
    const stored=await context.database.session.findUnique({
      where:{id:session.id}
    });
    if(!matches(stored,session,shop))return denied(403);

    let response;
    if(mutation) {
      if(typeof context.database.$transaction!=="function")return denied(503);
      // updateMany locks the exact shop row. The uninstall callback updates
      // this same row before deleting sessions, so the two operations must
      // serialize on PostgreSQL. Critically, recheck the session INSIDE that
      // lock, after any concurrent uninstall/rotation has finished.
      response=await context.database.$transaction(async transaction=>{
        if(typeof transaction?.builderShopInstallation?.updateMany!=="function" ||
           typeof transaction?.session?.findUnique!=="function")
          throw new Error("Missing transactional authorization delegates");
        const locked=await transaction.builderShopInstallation.updateMany({
          where:{shop,uninstalledAt:null},
          data:{updatedAt:new Date()},
        });
        if(locked?.count!==1)return denied(403);
        const current=await transaction.session.findUnique({
          where:{id:session.id}
        });
        if(!matches(current,session,shop))return denied(403);

        // All merchant-facing database writes MUST use this transaction.
        // The external request-scoped Prisma client is NOT passed through.
        return onAuthenticated({
          request,shop,session,admin:authenticated.admin,transaction
        });
      },{maxWait:5000,timeout:12000});
    }else{
      // GET is for loaders/read-only data. Do not expose the mutable DB
      // handle to read callbacks. Never use GET for merchant mutations.
      response=await onAuthenticated({
        request,shop,session,admin:authenticated.admin
      });
    }
    if(!(response instanceof Response))return denied(503);
    response.headers.set("cache-control","no-store");
    response.headers.set("x-content-type-options","nosniff");
    return response;
  } catch(error) {
    // Shopify SDK can throw a Response to start reauthentication. Forward it
    // unchanged (including cookie/redirect headers), as the official SDK
    // requires. Reject other errors without exposing tokens/Neon URLs.
    if(error instanceof Response)return error;
    return denied(503);
  } finally {
    try{await context?.close?.()}catch{ /* never log database secrets */ }
  }
}

/** Authenticated read-only GET /app request, no database transaction. */
export function acceptWorkerShopifyAdminRequest(request,env,options) {
  return guardedAdminRequest(request,env,options,false);
}

/** Authenticated POST; transactionally serialized against uninstall. */
export function acceptWorkerShopifyAdminMutation(request,env,options) {
  return guardedAdminRequest(request,env,options,true);
}
