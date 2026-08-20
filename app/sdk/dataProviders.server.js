import { getVsnDataProvider, getVsnPluginPermissions, registerVsnDataProvider, reportVsnSdkError } from "./registry.js";
import { assertAllowedExternalUrl } from "./security.js";

let coreProvidersRegistered = false;
export function registerCoreShopifyDataProviders() {
  if (coreProvidersRegistered) return; coreProvidersRegistered = true;
  const connection = (field, queryBody) => registerVsnDataProvider({ id:`shopify:${field}`, label:`Shopify ${field[0].toUpperCase()+field.slice(1)}`, type:"shopify", async resolve({admin}, input={}) { if(!admin) throw new Error("Shopify Admin client is required."); const first=Math.max(1,Math.min(100,Number(input.limit||20))); const response=await admin.graphql(queryBody,{variables:{first,q:String(input.query||"")||null}}); const payload=await response.json(); if(payload.errors?.length)throw new Error(payload.errors.map(e=>e.message).join("; ")); return payload.data?.[field]?.nodes||[]; } });
  connection("products", `#graphql\nquery VsnSdkProducts($first:Int!,$q:String){products(first:$first,query:$q){nodes{id title handle vendor productType featuredImage{url altText} priceRangeV2{minVariantPrice{amount currencyCode}}}}}`);
  connection("collections", `#graphql\nquery VsnSdkCollections($first:Int!,$q:String){collections(first:$first,query:$q){nodes{id title handle description image{url altText}}}}`);
  connection("blogs", `#graphql\nquery VsnSdkBlogs($first:Int!,$q:String){blogs(first:$first,query:$q){nodes{id title handle}}}`);
  connection("articles", `#graphql\nquery VsnSdkArticles($first:Int!,$q:String){articles(first:$first,query:$q){nodes{id title handle summary publishedAt blog{handle}}}}`);
  registerVsnDataProvider({ id:"shopify:search", label:"Shopify Search", type:"shopify", async resolve({admin}, input={}) { const provider=getVsnDataProvider("shopify:products"); return provider.resolve({admin},{limit:input.limit||20,query:input.query||""}); } });
  registerVsnDataProvider({ id:"shopify:metaobjects", label:"Shopify Metaobjects", type:"shopify", async resolve({admin}, input={}) { if(!admin)throw new Error("Shopify Admin client is required."); const type=String(input.type||"").trim(); if(!type)throw new Error("Metaobject type is required."); const first=Math.max(1,Math.min(100,Number(input.limit||20))); const response=await admin.graphql(`#graphql\nquery VsnSdkMetaobjects($type:String!,$first:Int!){metaobjects(type:$type,first:$first){nodes{id handle type displayName fields{key value type}}}}`,{variables:{type,first}}); const payload=await response.json(); if(payload.errors?.length)throw new Error(payload.errors.map(e=>e.message).join("; ")); return payload.data?.metaobjects?.nodes||[]; } });
}

function safeProviderContext(provider, context = {}) {
  if (provider.pluginId === "vsn.core") return context;
  const permissions = new Set(getVsnPluginPermissions(provider.pluginId));
  const safe = {
    shop: String(context.shop || ""),
    locale: String(context.locale || context.language || ""),
    market: String(context.market || ""),
    pageType: String(context.pageType || ""),
  };
  const map = {
    products: "data:shopify.products",
    collections: "data:shopify.collections",
    blogs: "data:shopify.blogs",
    articles: "data:shopify.articles",
    metaobjects: "data:shopify.metaobjects",
    search: "data:shopify.search",
  };
  safe.shopify = Object.freeze(Object.fromEntries(Object.entries(map).filter(([, permission]) => permissions.has(permission)).map(([name]) => [name, async (providerInput = {}) => resolveVsnDataProvider(`shopify:${name}`, context, providerInput)])));
  return Object.freeze(safe);
}

export async function resolveVsnDataProvider(id, context = {}, input = {}) {
  registerCoreShopifyDataProviders();
  const provider=getVsnDataProvider(id);
  if(!provider)throw new Error(`Unknown VSN data provider: ${id}`);
  try { return await provider.resolve(safeProviderContext(provider, context),input); }
  catch(error){ reportVsnSdkError("data.resolve",id,error); throw error; }
}

export function createExternalDataProvider({ id, label, endpoint, method="GET", networkOrigins=[], mapResponse }) {
  return {
    id, label, type:"external", requiredPermissions:["network:external"], networkOrigins:[...networkOrigins],
    async resolve(context={}, input={}) {
      const url=assertAllowedExternalUrl(typeof endpoint==="function"?endpoint(input,context):endpoint,networkOrigins);
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Math.max(500,Math.min(8000,Number(input.timeoutMs||4000))));
      try {
        const response=await fetch(url,{method:["GET","POST"].includes(method)?method:"GET",headers:{Accept:"application/json"},body:method==="POST"?JSON.stringify(input.body||{}):undefined,signal:controller.signal,redirect:"error"});
        if(!response.ok)throw new Error(`External provider returned HTTP ${response.status}.`);
        const length=Number(response.headers.get("content-length")||0);
        if(length>1_000_000)throw new Error("External provider response exceeds the 1 MB SDK limit.");
        const text=await response.text();
        if(text.length>1_000_000)throw new Error("External provider response exceeds the 1 MB SDK limit.");
        let payload; try { payload=JSON.parse(text); } catch { throw new Error("External provider must return valid JSON."); }
        return typeof mapResponse==="function"?mapResponse(payload,input):payload;
      } finally { clearTimeout(timer); }
    }
  };
}
