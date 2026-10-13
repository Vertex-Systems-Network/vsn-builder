// Future Cloudflare Worker Admin request boundary. This is NOT a route.
// The official Shopify React Router SDK performs authentication and token
// exchange. Raw ?shop query strings, Authorization headers and cookies alone
// never grant access to VSN data.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const denied=status=>new Response(null,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
const isDate=value=>value instanceof Date && Number.isFinite(value.getTime());

/**
 * Authenticate the EXACT request using Shopify's official SDK, then ensure
 * the authenticated session remains active in the request's own database.
 * The callback must complete all database operations before this call ends.
 * No merchant identity is accepted from untrusted URL/header input.
 *
 * A Response thrown by authenticate.admin (e.g. embedded reauth redirect)
 * is preserved as-is, including its Shopify-managed headers.
 */
export async function acceptWorkerShopifyAdminRequest(request,env,{
  createSdkContext=createWorkerShopifySdkContext,onAuthenticated,
}={}) {
  if(!(request instanceof Request))return denied(400);
  if(!["GET","POST"].includes(request.method))return denied(405);
  const url=new URL(request.url);
  if(url.pathname!=="/app" && !url.pathname.startsWith("/app/"))
    return denied(404);
  if(typeof onAuthenticated!=="function")return denied(503);
  // Validate tier, origin, Worker identity and bound Neon project BEFORE
  // invoking any injected SDK factory or database connector.
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

    // Must use the official SDK as the only authentication authority.
    const authenticated=await context.shopify.authenticate.admin(request);
    const session=authenticated?.session;
    const shop=session?.shop;
    if(!SHOP.test(String(shop||"")) ||
       typeof session?.id!=="string" || !session.id ||
       typeof session?.accessToken!=="string" || !session.accessToken ||
       typeof session?.isOnline!=="boolean" ||
       (hintedShop!==null && hintedShop!==shop))return denied(401);

    // An authenticated SDK response alone must not reactivate a previously
    // uninstalled shop or allow a stale session after a concurrent revoke.
    const lifecycle=await context.database.builderShopInstallation.findUnique({
      where:{shop}
    });
    if(!lifecycle || !isDate(lifecycle.installedAt) ||
       lifecycle.uninstalledAt!==null)return denied(403);
    const stored=await context.database.session.findUnique({
      where:{id:session.id}
    });
    if(!stored || stored.shop!==shop ||
       stored.isOnline!==session.isOnline ||
       stored.accessToken!==session.accessToken)return denied(403);

    const response=await onAuthenticated({
      request,shop,session,admin:authenticated.admin,context,
    });
    if(!(response instanceof Response))return denied(503);
    response.headers.set("cache-control","no-store");
    response.headers.set("x-content-type-options","nosniff");
    return response;
  } catch(error) {
    // SDK-managed reauthentication/redirect response must keep its headers.
    if(error instanceof Response)return error;
    return denied(503);
  } finally {
    try { await context?.close?.() } catch { /* never surface DB URLs */ }
  }
}
