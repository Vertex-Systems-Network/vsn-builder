// T020 *bundle-only* probe for the actual Worker Shopify SDK/PrismaNeon imports.
// No Shopify merchant routes, credentials, sessions, writes, OAuth or deployment.
// This file deliberately references the actual module factories without
// invoking them, so Wrangler has to resolve their Worker-targeted imports.
import {createWorkerShopifySdkContext} from "../app/services/shopify-worker-sdk-context.js";
import {createWorkerShopifySessionContext} from "../app/services/shopify-worker-session-context.js";
import {acceptWorkerShopifyAdminRequest,acceptWorkerShopifyAdminMutation} from "../app/services/worker-shopify-admin-gate.js";
import {createWorkerNeonPrisma,inspectWorkerNeonEnvironment} from "../app/services/db-worker-neon.js";

const factories=new Map([
  ["sdk",createWorkerShopifySdkContext],
  ["session",createWorkerShopifySessionContext],
  ["read",acceptWorkerShopifyAdminRequest],
  ["write",acceptWorkerShopifyAdminMutation],
  ["neon",createWorkerNeonPrisma],
  ["policy",inspectWorkerNeonEnvironment],
]);
const LOCKED=Object.freeze({
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
});
export default {
  async fetch() {
    // Never dispatch a real request, even when malicious headers/secret-like
    // bindings are supplied. The references force an SDK+Prisma bundle check.
    if(factories.size!==6)return new Response(null,{status:503,headers:LOCKED});
    return new Response(null,{status:503,headers:LOCKED});
  },
};
