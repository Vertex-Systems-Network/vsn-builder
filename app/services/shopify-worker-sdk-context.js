// Official Shopify App React Router SDK bootstrap, scoped to one Worker Request.
// No bypass/own implementation of OAuth, session JWT, webhook verification or billing.
// Connection lifecycle MUST be closed after the request (including streaming errors).
import { AppDistribution, shopifyApp } from "@shopify/shopify-app-react-router/server";
import { createShopifyWorkerSdk, inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySessionContext } from "./shopify-worker-session-context.js";

export async function createWorkerShopifySdkContext(request, env, {
  createSessionContext = createWorkerShopifySessionContext,
  sdkFactory = shopifyApp,
  distribution = AppDistribution.AppStore,
} = {}) {
  let context;
  try {
    // Fail closed before ANY storage/database factory call, including injected
    // adapters. Cross-tier configuration must never trigger a DB connection.
    if (!inspectWorkerShopifyConfiguration(request, env).ready ||
        !inspectWorkerNeonEnvironment(env).ready) {
      throw new Error("Invalid Worker runtime identity");
    }
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
      // Internal-only request-scoped Prisma handle, never serialized to HTTP.
      // Verified webhook cleanup may use it for a single shop-scoped delete.
      database: context.database,
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
