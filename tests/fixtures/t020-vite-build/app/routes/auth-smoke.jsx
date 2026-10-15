// One explicitly synthetic, Vite-generated resource loader. This route is
// reachable only via the SDK/persisted-session gated CI bridge. The public
// Shopify Worker continues returning 503 to /app and /auth.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
export async function loader({request,context}){
  const authorizedShop=context?.merchant?.shop;
  if(request.method!=="GET" ||
    new URL(request.url).pathname!=="/app/__vsn-auth-smoke" ||
    context?.cloudflare?.env?.APP_ENV!=="staging" ||
    context?.cloudflare?.env?.VSN_AUTH_PROBE!=="true" ||
    !SHOP.test(String(authorizedShop||""))){
    return new Response(null,{status:503});
  }
  // This is a synthetic HTML fixture, not a Shopify Admin query. Domain syntax
  // is restricted above; never include a token, session ID, email or secrets.
  return new Response("<main>Authenticated VSN Builder routing proof: "+
    authorizedShop+"</main>",{
    status:200,headers:{"content-type":"text/html; charset=utf-8"},
  });
}
