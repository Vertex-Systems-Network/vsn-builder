// Per-request webhook verification with the official Shopify SDK.
// Never roll custom HMAC verification, trust request headers as authentication,
// or expose the Shopify Admin/session context after the database is closed.
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";

export async function verifyWorkerShopifyWebhook(request, env, {
  createSdkContext = createWorkerShopifySdkContext,
} = {}) {
  if (!(request instanceof Request)) throw new TypeError("Shopify webhook requires a Web Request");
  let context;
  try {
    // Validate both protected deployment identities before ANY injected
    // session/database factory can be invoked, even in alternate adapters.
    if (!inspectWorkerShopifyConfiguration(request, env).ready ||
        !inspectWorkerNeonEnvironment(env).ready) {
      throw new Error("Invalid Worker Shopify/Neon deployment identity");
    }
    context = await createSdkContext(request, env);
    if (!context || typeof context.shopify?.authenticate?.webhook !== "function" ||
        typeof context.close !== "function") {
      const error = new Error("Shopify webhook verification SDK unavailable");
      error.code = "VSN_WORKER_WEBHOOK_SDK_UNAVAILABLE";
      throw error;
    }
    // The SDK validates the exact raw request body, HMAC and mandatory headers.
    // Preserve SDK 400/401/405 Response exceptions and never parse the body first.
    const verified = await context.shopify.authenticate.webhook(request);
    if (!verified || typeof verified.shop !== "string" ||
        typeof verified.topic !== "string" || !verified.shop) {
      throw new Error("Invalid verified Shopify webhook context");
    }
    // Only return claims after SDK verification; never leak an admin client,
    // session/token, or the closed Prisma database to application callers.
    return Object.freeze({
      shop: verified.shop,
      topic: verified.topic,
      webhookId: verified.webhookId,
      apiVersion: verified.apiVersion,
      payload: verified.payload,
    });
  } catch (error) {
    if (error instanceof Response && [400,401,403,405].includes(error.status)) throw error;
    const blocked = new Error("Shopify webhook verification unavailable");
    blocked.code = "VSN_WORKER_WEBHOOK_UNAVAILABLE";
    throw blocked;
  } finally {
    if (context?.close) {
      try { await context.close(); } catch { /* no token/DB error disclosure */ }
    }
  }
}
