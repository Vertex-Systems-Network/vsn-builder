// Official Shopify App React Router SDK bootstrap, scoped to one Worker Request.
// No bypass/own implementation of OAuth, session JWT, webhook verification or billing.
// Connection lifecycle MUST be closed after the request (including streaming errors).
import { AppDistribution, shopifyApp } from "@shopify/shopify-app-react-router/server";
import { createShopifyWorkerSdk } from "./shopify-worker-configuration.js";
import { createWorkerShopifySessionContext } from "./shopify-worker-session-context.js";

export async function createWorkerShopifySdkContext(request, env, {
  createSessionContext = createWorkerShopifySessionContext,
  sdkFactory = shopifyApp,
  distribution = AppDistribution.AppStore,
} = {}) {
  let context;
  try {
    context = await createSessionContext(request, env);
    if (!context || !context.sessionStorage || typeof context.close !== "function") {
      throw new Error("Missing request-scoped session context");
    }
    const shopify = createShopifyWorkerSdk(request, env, {
      createSdk: sdkFactory,
      sessionStorage: context.sessionStorage,
      distribution,
    });
    if (!shopify || typeof shopify.addDocumentResponseHeaders !== "function" ||
        typeof shopify.authenticate?.admin !== "function" ||
        typeof shopify.authenticate?.webhook !== "function") {
      throw new Error("Shopify verification SDK not available");
    }
    return {
      shopify,
      sessionStorage: context.sessionStorage,
      close: context.close,
    };
  } catch {
    if (context && typeof context.close === "function") {
      try { await context.close(); } catch { /* never surface DB/secret errors */ }
    }
    const err = new Error("Shopify Worker SDK request bootstrap unavailable");
    err.code = "VSN_WORKER_SHOPIFY_BOOTSTRAP_BLOCKED";
    throw err;
  }
}
