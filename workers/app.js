// VSN Builder hosted Worker entry — gated Staging integration boundary.
// This is NOT the React Router merchant UI and is not authorized for Live.
// Staging draft-save is gated OFF; no billing, public editor or Shopify review.
import { inspectWorkerNeonEnvironment, createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";
import { inspectWorkerShopifyConfiguration } from "../app/services/shopify-worker-configuration.js";
import { isVerifiedWorkerSchemaMetadata } from "../app/services/worker-schema-metadata-health.js";
import { acceptWorkerShopifyAdminRequest, acceptWorkerShopifyAdminMutation } from "../app/services/worker-shopify-admin-gate.js";
import { handleVerifiedWorkerDraftSave } from "../app/services/worker-shopify-draft-save-request.js";
import { handleVerifiedWorkerPageCreate } from "../app/services/worker-shopify-page-create.js";
import { handleVerifiedStagingMerchantDashboard, handleVerifiedStagingPageInspection } from "../app/services/worker-shopify-staging-dashboard.js";
import { handleVerifiedStagingShopifyAuth } from "../app/services/worker-shopify-staging-auth.js";
import { handleVerifiedStagingShopifyLogin } from "../app/services/worker-shopify-staging-login.js";
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
    // A canonical database with 52+ arbitrary tables and two unrelated
    // finished migrations is NOT the reviewed Builder cloud schema.
    // Inspect fixed PostgreSQL/Prisma metadata only; never query merchant rows.
    const [metrics,records]=await Promise.all([
      prisma.$queryRawUnsafe(
        "SELECT current_database() AS database, "+
        "(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables, "+
        "(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Session','BuilderPage','BuilderSubscription','BuilderShopInstallation')) AS essential_tables"
      ),
      prisma.$queryRawUnsafe(
        'SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name'
      ),
    ]);
    if(!isVerifiedWorkerSchemaMetadata({summary:metrics?.[0],records}))
      return locked();
    return safeJson({database:"healthy",tier:env.APP_ENV,schemaVerified:true,sourceChecksumAttested:false,merchantAppReady:false});
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
    // Stage-only real Shopify App Bridge overview. Every request reuses the
    // official SDK + verified session + Partner-paid + pages/view gates.
    // Production and unconfigured Staging always return 503.
    // Stage-only official Shopify SDK OAuth/callback bridge. The SDK verifies
    // signatures/tokens and stores sessions through a generation-fenced Neon
    // adapter. Disabled by default; GET /auth/login remains blocked until a
    // a matching SDK-owned /auth/login request is explicitly authorized.
    // Official Shopify SDK login owns OAuth state/redirect generation.
    // GET-only form and callback both require explicit Staging opt-in.
    if(url.pathname==="/auth/login" && request.method==="GET")
      return handleVerifiedStagingShopifyLogin(request,env);
    if(/^\/auth\/(?!login(?:\/|$))[a-z0-9-]{1,64}$/.test(url.pathname) &&
       request.method==="GET")
      return handleVerifiedStagingShopifyAuth(request,env);
    if(url.pathname==="/app" && request.method==="GET")
      return handleVerifiedStagingMerchantDashboard(request,env);
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
        requirePageViewPermission:true,
        onAuthenticated:async ({shop,pageSummary})=>{
          const pages=await pageSummary();
          return safeJson({shop,tier:env.APP_ENV,pages});
        },
      });
    }
    if(url.pathname==="/app/__vsn/pages/create" && request.method==="POST") {
      // MVP blank-draft create is exposed ONLY after an explicit Staging
      // enablement; paid-page quotas and pages.create RBAC execute in the
      // same uninstall-serialized Shopify SDK mutation transaction.
      if(env.APP_ENV!=="staging" ||
         env.VSN_STAGING_DRAFT_SAVE_ENABLED!=="true")return locked();
      if([...url.searchParams.keys()].some(key=>key!=="shop") ||
         url.searchParams.getAll("shop").length>1)return locked(404);
      return acceptWorkerShopifyAdminMutation(request,env,{
        onAuthenticated:({request:authorizedRequest,session,shop,transaction})=>
          handleVerifiedWorkerPageCreate({
            request:authorizedRequest,session,shop,transaction,
          }),
      });
    }
    if(url.pathname.startsWith("/app/__vsn/pages/") && request.method==="POST") {
      // Source-integrated save contract is intentionally unavailable without
      // an EXPLICIT Staging-only activation. Never enable for Production.
      // The current Staging Worker has no secret/binding for this switch.
      if(env.APP_ENV!=="staging" ||
         env.VSN_STAGING_DRAFT_SAVE_ENABLED!=="true")return locked();
      const match=/^\/app\/__vsn\/pages\/([a-zA-Z0-9_-]{1,64})\/content$/.exec(url.pathname);
      if(!match || [...url.searchParams.keys()].some(key=>key!=="shop") ||
         url.searchParams.getAll("shop").length>1)return locked(404);
      return acceptWorkerShopifyAdminMutation(request,env,{
        onAuthenticated:({request:authorizedRequest,session,shop,transaction})=>
          handleVerifiedWorkerDraftSave({
            request:authorizedRequest,session,shop,transaction,pageId:match[1],
          }),
      });
    }
    // Staging-only read-only HTML inspection of persisted page metadata
    // and bounded editor draft. The verified paid/RBAC Shopify SDK guard
    // re-authenticates every request before either tenant-scoped read.
    if(/^\/app\/__vsn\/pages\/[a-zA-Z0-9_-]{1,64}\/view$/.test(url.pathname) &&
       request.method==="GET")
      return handleVerifiedStagingPageInspection(request,env);
    if(url.pathname.startsWith("/app/__vsn/pages/") && request.method==="GET") {
      // Authenticated, paid, RBAC-protected page metadata or editor hydration.
      // No public draft contents are exposed; POST stays Staging flag-locked.
      const rawPath=url.pathname.slice("/app/__vsn/pages/".length);
      const isContent=rawPath.endsWith("/content");
      const rawId=isContent?rawPath.slice(0,-"/content".length):rawPath;
      if(!/^[a-zA-Z0-9_-]{1,64}$/.test(rawId) ||
         [...url.searchParams.keys()].some(key=>key!=="shop") ||
         url.searchParams.getAll("shop").length>1)return locked(404);
      if(isContent) {
        return acceptWorkerShopifyAdminRequest(request,env,{
          enablePageContent:true,
          requireVerifiedPaidRead:true,
          requirePageViewPermission:true,
          onAuthenticated:async ({pageContent})=>{
            const record=await pageContent(rawId);
            return record===null?locked(404):safeJson({page:record});
          },
        });
      }
      return acceptWorkerShopifyAdminRequest(request,env,{
        enablePageMetadata:true,
        requireVerifiedPaidRead:true,
        requirePageViewPermission:true,
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
    // No storefront, OAuth, public merchant editor, or billing routes are
    // enabled until full Cloudflare React Router/Shopify integration is proved.
    if(url.pathname==="/app" || url.pathname.startsWith("/app/") ||
       url.pathname.startsWith("/auth/"))return locked();
    return locked(404);
  },
};
