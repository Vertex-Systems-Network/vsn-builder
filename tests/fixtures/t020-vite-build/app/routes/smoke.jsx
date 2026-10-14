// A resource route in a *Vite-generated* React Router ServerBuild.
// This is a deliberately inert CI route; it has no Shopify credentials.
export async function loader({request,context}){
  if(request.method!=="GET" ||
     context?.cloudflare?.env?.APP_ENV!=="test" ||
     context?.cloudflare?.env?.VSN_BUILD_INTENT!=="react-router-ci"){
    return new Response(null,{status:503});
  }
  return new Response("<main>VSN Builder Vite-generated route proof</main>",{
    status:200,
    headers:{"content-type":"text/html; charset=utf-8"},
  });
}
