// React Router Cloudflare build only. All SDK operations are forwarded to the
// official Shopify SDK instance initialized for this request by the Worker.
import { getWorkerRequestContext } from "./services/worker-request-context.server.js";
import { SHOPIFY_API_VERSION_HANDLE } from "./config/shopifyIntegration.js";

function forward(path){
  const target=function(...args){
    let owner=getWorkerRequestContext().shopify;
    for(const key of path.slice(0,-1))owner=owner?.[key];
    const method=owner?.[path.at(-1)];
    if(typeof method!=="function")throw new Error("Official Shopify SDK method unavailable");
    return method.apply(owner,args);
  };
  return new Proxy(target,{
    get(_target,key){
      if(key==="then"||key==="toJSON")return undefined;
      if(key===Symbol.toStringTag)return "VSNRequestScopedShopifySdkMethod";
      if(typeof key==="symbol")return undefined;
      return forward([...path,key]);
    },
    set(){return false;},
  });
}

const sdkNamespace=new Proxy(Object.create(null),{
  get(_target,key){
    if(key==="then"||key==="toJSON")return undefined;
    if(typeof key==="symbol")return undefined;
    return forward([key]);
  },
  set(){return false;},
});

export const authenticate=forward(["authenticate"]);
export const unauthenticated=forward(["unauthenticated"]);
export const login=forward(["login"]);
export const registerWebhooks=forward(["registerWebhooks"]);
export const addDocumentResponseHeaders=forward(["addDocumentResponseHeaders"]);
export const sessionStorage=forward(["sessionStorage"]);
export const apiVersion=SHOPIFY_API_VERSION_HANDLE;
export const apiVersionHandle=SHOPIFY_API_VERSION_HANDLE;

export default sdkNamespace;
