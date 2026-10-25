// Per-invocation Worker bindings. Cloudflare's nodejs_compat AsyncLocalStorage
// keeps concurrent merchant requests isolated without putting credentials in
// module globals or route loader data.
import { AsyncLocalStorage } from "node:async_hooks";

const requestContext=new AsyncLocalStorage();

export function runWithWorkerRequestContext(context,callback) {
  if(!context || typeof callback!=="function")
    throw new TypeError("Worker request context and callback are required");
  return requestContext.run(context,callback);
}

export function getWorkerRequestContext() {
  const context=requestContext.getStore();
  if(!context || !context.database || !context.shopify)
    throw Object.assign(new Error("Worker request-scoped Shopify/Neon context is unavailable"),{
      code:"VSN_WORKER_REQUEST_CONTEXT_REQUIRED",
    });
  return context;
}
