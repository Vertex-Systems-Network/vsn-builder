// Isolated CI-only ServerBuild fixture for the REAL React Router handler.
// It deliberately has one synthetic resource route, no merchant routes,
// no App Bridge, no checkout, no Shopify store credentials and no database.
// This is NOT a Vite-compiled Builder application.
const routePath="__vsn/react-router-smoke";
const loader=async({request,context})=>{
  if(request.method!=="GET" ||
     context?.cloudflare?.env?.APP_ENV!=="test" ||
     context?.cloudflare?.env?.VSN_BUILD_INTENT!=="react-router-ci")
    return new Response(null,{status:503});
  return new Response("<main>VSN Builder real React Router loader CI proof</main>",{
    status:200,
    headers:{"content-type":"text/html; charset=utf-8"},
  });
};
export default Object.freeze({
  assets:{version:"ci",entry:{module:"",imports:[],css:[]},routes:{}},
  assetsBuildDirectory:"build/client",
  basename:"/",
  entry:{module:{}},
  future:{},
  isSpaMode:false,
  prerender:[],
  publicPath:"/",
  routeDiscovery:{manifestPath:"/__vsn/router-manifest",mode:"initial"},
  routes:{
    "root":{id:"root",path:"",module:{}},
    "routes/__vsn-react-router-smoke":{
      id:"routes/__vsn-react-router-smoke",
      parentId:"root",
      path:routePath,
      module:{loader},
    },
  },
  ssr:true,
});
