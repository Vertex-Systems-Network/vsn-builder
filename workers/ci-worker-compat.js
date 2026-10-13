// CI-only Workers runtime compatibility probe. This MUST NOT be used as
// a Shopify app entry or deployed to any Cloudflare account.
import { inspectWorkerShopifyConfiguration } from "../app/services/shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment, createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { acceptWorkerShopifyUninstallWebhook } from "../app/services/worker-shopify-webhook-gate.js";
import { renderWorkerDocument } from "../app/services/worker-ssr-webstream.js";

const LOCKED={ "cache-control":"no-store", "content-type":"application/json; charset=utf-8", "x-content-type-options":"nosniff" };
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(env.APP_ENV!=="development" || url.pathname!=="/__vsn_local_workerd_check__" ||
       request.method!=="GET" || url.hostname!=="127.0.0.1") {
      return new Response(JSON.stringify({ready:false,reason:"NONDEPLOYABLE_CI_ONLY"}),{
        status:503,headers:LOCKED
      });
    }
    const checks={
      sdk:typeof createWorkerShopifySdkContext==="function",
      webhook:typeof acceptWorkerShopifyUninstallWebhook==="function",
      neon:typeof createWorkerNeonPrisma==="function",
      ssr:typeof renderWorkerDocument==="function",
      shopifyFailClosed:!inspectWorkerShopifyConfiguration(request,env).ready,
      neonFailClosed:!inspectWorkerNeonEnvironment(env).ready,
      workerRuntime:typeof caches!=="undefined" && typeof crypto.subtle?.verify==="function",
    };
    // Run an actual engine-less Prisma-Neon *construction* on workerd without
    // issuing any query, fetch, connect or migration. This synthetic non-existent
    // endpoint must never be replaced by a hosted credential.
    const fake={
      APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
      NEON_PROJECT_ID:"shiny-violet-61219572",
      SHOPIFY_BILLING_TEST_MODE:"true",
      DATABASE_URL:"postgresql://ci-no-network:synthetic-only@ep-invalid-no-network.aws.neon.tech/disposable?sslmode=require"
    };
    let prisma;
    try {
      prisma=createWorkerNeonPrisma(fake);
      checks.prismaClientConstructed=typeof prisma?.session?.findMany==="function" &&
        typeof prisma?.$disconnect==="function";
    } catch {
      checks.prismaClientConstructed=false;
    } finally {
      if (prisma) {
        try { await prisma.$disconnect(); } catch { checks.prismaClientConstructed=false; }
      }
    }
    try {
      createWorkerNeonPrisma({...fake,NEON_PROJECT_ID:"wrong-project"});
      checks.crossProjectBlocked=false;
    } catch(err) {
      checks.crossProjectBlocked=err?.code==="VSN_WORKER_DATABASE_NOT_READY";
    }
    return new Response(JSON.stringify({
      ciOnly:true,ready:false,modulesLoaded:Object.values(checks).every(Boolean),checks,
    }),{status:200,headers:LOCKED});
  }
};
