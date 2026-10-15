// CI-only legacy Shopify-import boundary for full-route Workerd module tests.
// Production must use the official Shopify SDK with persisted Neon sessions,
// never these blocked aliases. No OAuth/JWT/billing route can use this adapter.
const unavailable = () => {
  const error = new Error("Worker Shopify SDK must be initialized per authenticated request");
  error.code = "VSN_WORKER_REQUEST_SHOPIFY_REQUIRED";
  throw error;
};
const unavailableAsync = async () => unavailable();
const frozenAuthenticator = Object.freeze({
  admin: unavailableAsync,
  webhook: unavailableAsync,
  public: Object.freeze({
    appProxy: unavailableAsync,
    checkout: unavailableAsync,
    customerAccount: unavailableAsync,
  }),
  flow: unavailableAsync,
  fulfillmentService: unavailableAsync,
});
export const authenticate = frozenAuthenticator;
export const unauthenticated = Object.freeze({
  admin: unavailableAsync,
  storefront: unavailableAsync,
});
export const login = unavailableAsync;
export const registerWebhooks = unavailableAsync;
export const addDocumentResponseHeaders = unavailable;
export const sessionStorage = Object.freeze({
  storeSession: unavailableAsync,
  loadSession: unavailableAsync,
  deleteSession: unavailableAsync,
  deleteSessions: unavailableAsync,
  findSessionsByShop: unavailableAsync,
});
export const apiVersion = "2026-07";
export const apiVersionHandle = "2026-07";
export default Object.freeze({
  authenticate, unauthenticated, login,
  registerWebhooks, addDocumentResponseHeaders,
  sessionStorage,
});

// Real Worker traffic MUST use the audited official Shopify/Neon SDK context.
// It validates target Worker identity before any DB or session activity, and
// its caller must await close() after every request / streamed response.
export async function createAuthenticatedWorkerShopifyContext(request, env) {
  const { createWorkerShopifySdkContext } =
    await import("../app/services/shopify-worker-sdk-context.js");
  return createWorkerShopifySdkContext(request, env);
}
