// VSN Builder hosted Worker entry — gated Staging integration boundary.
// This is NOT the React Router merchant UI and is not authorized for Live.
// No merchant editor, billing mutations, or Shopify App Store review is enabled.
import { inspectWorkerNeonEnvironment, createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";
import { inspectWorkerShopifyConfiguration } from "../app/services/shopify-worker-configuration.js";
import { acceptWorkerShopifyAdminRequest } from "../app/services/worker-shopify-admin-gate.js";
import { acceptWorkerShopifyUninstallWebhook } from "../app/services/worker-shopify-webhook-gate.js";
import { revokeVerifiedWorkerShopifySessions } from "../app/services/worker-shopify-uninstall-session-revoke.js";

const LOCKED = Object.freeze({
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});
function locked(status = 503) {
  return new Response(null, { status, headers: LOCKED });
}
function safeJson(value,status=200) {
  return new Response(JSON.stringify(value),{
    status,headers:{...LOCKED,"content-type":"application/json; charset=utf-8"},
  });
}
function tierIdentity(env) {
  const tier = env?.APP_ENV;
  const expected = tier === "staging" ? "vsn-builder-staging" :
    tier === "production" ? "vsn-builder-production" : "";
  return Boolean(expected && env?.VSN_WORKER_NAME === expected);
}

// Return health of the *actual* PostgreSQL schema, not a synthetic mock.
// A healthy database is NOT readiness of the user-facing Shopify app.
async function databaseHealth(request,env) {
  if (!inspectWorkerShopifyConfiguration(request,env).ready ||
      !inspectWorkerNeonEnvironment(env).ready) return locked();
  let prisma;
  try {
    prisma=createWorkerNeonPrisma(env);
    const rows=await prisma.$queryRawUnsafe(
      "SELECT (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables, (SELECT COUNT(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations"
    );
    const tableCount=Number(rows?.[0]?.tables||0);
    const migrationCount=Number(rows?.[0]?.migrations||0);
    if(tableCount<52 || migrationCount<2)return locked();
    return safeJson({database:"healthy",tier:env.APP_ENV,schemaVerified:true});
  }catch{
    return locked();
  }finally{
    try{await prisma?.$disconnect?.()}catch{/* Do not leak connection data */}
  }
}

export default {
  async fetch(request,env) {
    if(!(request instanceof Request) || !tierIdentity(env))return locked();
    const url=new URL(request.url);
    if(url.search && ["/healthz","/readyz","/__vsn/database-health"].includes(url.pathname))return locked(404);
    if(url.pathname==="/healthz" && request.method==="GET")
      return safeJson({service:"VSN Builder",tier:env.APP_ENV,liveness:true,merchantAppReady:false});
    if(url.pathname==="/readyz" && request.method==="GET")
      // Shopify React Router SSR and billing remain unimplemented at the edge.
      // Return 503, never claim readiness from merely having a database.
      return locked();
    if(url.pathname==="/__vsn/database-health" && request.method==="GET")
      return databaseHealth(request,env);
    if(url.pathname==="/app/__vsn/verified-session" && request.method==="GET") {
      // A real Shopify SDK and durable Neon installation/session authorization
      // must succeed before returning any authenticated information.
      return acceptWorkerShopifyAdminRequest(request,env,{
        onAuthenticated:async ({shop})=>safeJson({authenticated:true,shop,tier:env.APP_ENV}),
      });
    }
    if(url.pathname==="/app/__vsn/page-summary" && request.method==="GET") {
      // An incremental REAL read-only hosted route (not the merchant UI).
      // Only the official Shopify SDK, persisted installation and the
      // request-scoped Neon session can authorize this capability.
      if([...url.searchParams.keys()].some(key=>key!=="shop") ||
         url.searchParams.getAll("shop").length>1)return locked(404);
      return acceptWorkerShopifyAdminRequest(request,env,{
        enablePageSummary:true,
        requireVerifiedPaidRead:true,
        onAuthenticated:async ({shop,pageSummary})=>{
          const pages=await pageSummary();
          return safeJson({shop,tier:env.APP_ENV,pages});
        },
      });
    }
    if(url.pathname.startsWith("/app/__vsn/pages/") && request.method==="GET") {
      // An exact-page metadata read, never content JSON or a write path.
      // The Shopify SDK + persisted installation and session are the ONLY
      // authority for the tenant-scoped Prisma lookup.
      const rawId=url.pathname.slice("/app/__vsn/pages/".length);
      if(!/^[a-zA-Z0-9_-]{1,64}$/.test(rawId) ||
         [...url.searchParams.keys()].some(key=>key!=="shop") ||
         url.searchParams.getAll("shop").length>1)return locked(404);
      return acceptWorkerShopifyAdminRequest(request,env,{
        enablePageMetadata:true,
        requireVerifiedPaidRead:true,
        onAuthenticated:async ({pageMetadata})=>{
          const record=await pageMetadata(rawId);
          return record===null?locked(404):safeJson({page:record});
        },
      });
    }
    if(url.pathname==="/webhooks/app/uninstalled") {
      try {
        return await acceptWorkerShopifyUninstallWebhook(request,env,{
          onVerified:revokeVerifiedWorkerShopifySessions,
        });
      }catch(error){
        return error instanceof Response ? error : locked();
      }
    }
    // No storefront, OAuth, merchant mutations, billing, or editor routes are
    // enabled until full Cloudflare React Router/Shopify integration is proved.
    if(url.pathname==="/app" || url.pathname.startsWith("/app/") ||
       url.pathname.startsWith("/auth/"))return locked();
    return locked(404);
  },
};
