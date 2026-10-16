// Stage-only Shopify SDK login screen. Never initiate OAuth ourselves.
// The official shopifyApp.login(request) validates the merchant and generates
// its state, redirects and cookies. NO hand-built OAuth state or HMAC.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";
import { hasCanonicalStagingOAuthQuery } from "./worker-shopify-auth-query.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const blocked=(status=503)=>new Response(null,{status,headers:{
 "cache-control":"no-store","x-content-type-options":"nosniff",
}});
const CSP="default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; "+
 "base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
const escape=value=>String(value).replace(/[&<>"']/g,x=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
})[x]);
function loginForm(message,shop=""){
 const label=escape(message);
 const entered=escape(shop.slice(0,253));
 const page='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>VSN | Builder (Staging) — Shopify login</title>'+
 '<style>:root{font-family:Inter,system-ui,sans-serif;background:#f6f6f7;color:#202223}'+
 'body{margin:10vh auto;max-width:450px;padding:0 24px}'+
 'main{background:white;border:1px solid #dde0e3;border-radius:14px;padding:28px}'+
 'h1{font-size:24px}label{display:block;margin:20px 0 8px}'+
 'input{box-sizing:border-box;padding:12px;width:100%;border:1px solid #9ea3a8;border-radius:8px}'+
 'button{padding:12px 20px;margin-top:20px;background:#285d0a;color:white;border:0;border-radius:8px}'+
 '.hint{color:#60656b;line-height:1.5}</style></head><body><main>'+
 '<h1>VSN | Builder</h1><p class="hint">Staging login only — Shopify verifies your store.</p>'+
 '<form action="/auth/login" method="get">'+
 '<label for="shop">Shopify store domain</label>'+
 '<input required id="shop" name="shop" type="text" maxlength="253" autocomplete="off"'+
 ' placeholder="example.myshopify.com" value="'+entered+'">'+
 '<button type="submit">Continue with Shopify</button></form>'+
 (label?'<p role="alert" class="hint">'+label+'</p>':"")+
 '</main></body></html>';
 return new Response(page,{status:200,headers:{
  "content-type":"text/html; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer","content-security-policy":CSP,
 }});
}

/** GET login only; Shopify supports both GET URL shop and POST form shop. */
export async function handleVerifiedStagingShopifyLogin(request,env,{
 createSdkContext=createWorkerShopifySdkContext,
}={}){
 if(!(request instanceof Request)||request.method!=="GET"||
    env?.APP_ENV!=="staging"||
    env?.VSN_WORKER_NAME!=="vsn-builder-staging"||
    env?.VSN_STAGING_OAUTH_ENABLED!=="true")return blocked();
 const url=new URL(request.url);
 if(url.pathname!=="/auth/login")return blocked(404);
 if(!hasCanonicalStagingOAuthQuery(url,"login"))return blocked(400);
 if(!inspectWorkerShopifyConfiguration(request,env).ready||
    !inspectWorkerNeonEnvironment(env).ready)return blocked();
 const hinted=url.searchParams.get("shop");
 // Prevent an invalid user-provided merchant URL from ever reaching SDK
 // login or being displayed as executable HTML.
 if(hinted!==null && !SHOP.test(hinted))
   return loginForm("Enter a valid *.myshopify.com domain.");
 let ctx;
 try{
  ctx=await createSdkContext(request,env);
  if(typeof ctx?.shopify?.login!=="function" ||
     typeof ctx?.close!=="function")return blocked();
  // Shopify's own login(request) owns OAuth initiation. If a shop is
  // present, it THROWS an SDK Response containing the correct redirect.
  const result=await ctx.shopify.login(request);
  if(result?.shop==="INVALID_SHOP")
    return loginForm("Shopify did not accept that store domain.",hinted||"");
  if(result?.shop==="MISSING_SHOP" || hinted===null)
    return loginForm("");
  // Official API returns LoginError | never; an unexpected successful
  // value is NOT proof of authentication and must never become a redirect.
  return blocked();
 }catch(error){
  if(error instanceof Response)return error;
  return blocked();
 }finally{
  try{await ctx?.close?.()}catch{/* no SDK / DB details in responses */}
 }
}
