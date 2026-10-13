import { createElement } from "react";
// CI-only Workers runtime compatibility probe. This MUST NOT be used as
// a Shopify app entry or deployed to any Cloudflare account.
import { inspectWorkerShopifyConfiguration } from "../app/services/shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment, createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { acceptWorkerShopifyUninstallWebhook } from "../app/services/worker-shopify-webhook-gate.js";
import { revokeVerifiedWorkerShopifySessions } from "../app/services/worker-shopify-uninstall-session-revoke.js";
import { renderWorkerDocument } from "../app/services/worker-ssr-webstream.js";
import { SHOPIFY_EXPECTED_SCOPES } from "../app/config/shopifyIntegration.js";

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
    // issuing any query, fetch, connect or migration. The public expected
    // hostname is used with fake credentials; no network request is made.
    const fake={
      APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
      NEON_PROJECT_ID:"shiny-violet-61219572",
      SHOPIFY_BILLING_TEST_MODE:"true",
      DATABASE_URL:"postgresql://ci-no-network:synthetic-only@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/disposable?sslmode=require"
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
    // Exercise real React 19 Web Streams rendering inside local Cloudflare Workerd.
    // The CSP callback below is synthetic CI input, NOT a production Shopify
    // authentication/header provider. Never promote this CI-only Worker.
    try {
      const document=await renderWorkerDocument({
        request,
        reactElement:createElement("main",{"data-vsn-ci-ssr":"yes"},"VSN Builder synthetic Workerd SSR"),
        addShopifyHeaders(_request,headers) {
          headers.set("content-security-policy","frame-ancestors https://admin.shopify.com; default-src 'none'");
        },
      });
      const markup=await document.text();
      checks.reactWebStreamRendered=document.status===200 &&
        markup.includes("VSN Builder synthetic Workerd SSR") &&
        document.headers.get("content-type")==="text/html; charset=utf-8" &&
        document.headers.get("cache-control")==="no-store" &&
        document.headers.get("x-content-type-options")==="nosniff" &&
        document.headers.get("content-security-policy")?.includes("frame-ancestors https://admin.shopify.com");
    } catch {
      checks.reactWebStreamRendered=false;
    }
    try {
      await renderWorkerDocument({request,reactElement:createElement("p",null,"blocked")});
      checks.missingShopifyCspCallbackBlocked=false;
    } catch (error) {
      checks.missingShopifyCspCallbackBlocked=String(error?.message||"").includes("Shopify document security headers");
    }
    try {
      await renderWorkerDocument({
        request,reactElement:createElement("p",null,"blocked"),
        addShopifyHeaders(_request,headers) {headers.set("content-security-policy","default-src 'none'");},
      });
      checks.missingFrameAncestorsBlocked=false;
    } catch (error) {
      checks.missingFrameAncestorsBlocked=String(error?.message||"").includes("frame-ancestors is missing");
    }
    // Integration acceptance: let the real Shopify React Router SDK supply
    // merchant-scoped CSP inside actual workerd, not a handwritten callback.
    // All app credentials, session data, and rendered HTML are synthetic.
    const sdkEnv={
      ...fake,
      SHOPIFY_API_KEY:"a".repeat(32),
      SHOPIFY_API_SECRET:"synthetic-only-workerd-sdk-secret",
      SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
      SHOPIFY_APP_URL:"https://staging.builder.example.org",
      SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
    };
    const merchantRequest=new Request(sdkEnv.SHOPIFY_APP_URL+"/app?shop=ci-merchant.myshopify.com");
    let storageOpened=false,storageClosed=false,scoped;
    const sessionStorage={
      async storeSession(){return true;},
      async loadSession(){return undefined;},
      async deleteSession(){return true;},
      async deleteSessions(){return true;},
      async findSessionsByShop(){return [];},
    };
    try {
      scoped=await createWorkerShopifySdkContext(merchantRequest,sdkEnv,{
        async createSessionContext(){
          storageOpened=true;
          return {sessionStorage,async close(){storageClosed=true;}};
        },
      });
      const document=await renderWorkerDocument({
        request:merchantRequest,
        reactElement:createElement("main",null,"VSN official Shopify Workerd CSP probe"),
        addShopifyHeaders:scoped.shopify.addDocumentResponseHeaders,
      });
      const html=await document.text();
      const csp=document.headers.get("content-security-policy")||"";
      checks.realShopifySdkCspRendered=storageOpened && document.status===200 &&
        html.includes("VSN official Shopify Workerd CSP probe") &&
        csp.includes("frame-ancestors https://ci-merchant.myshopify.com") &&
        csp.includes("https://admin.shopify.com");
    } catch {
      checks.realShopifySdkCspRendered=false;
    } finally {
      if(scoped){
        try{await scoped.close();}catch{storageClosed=false;}
      }
    }
    checks.shopifySdkSessionClosed=storageOpened && storageClosed;
    let touchedForbiddenStorage=false;
    try {
      await createWorkerShopifySdkContext(merchantRequest,{
        ...sdkEnv,
        DATABASE_URL:sdkEnv.DATABASE_URL.replace(
          "ep-little-dream-b3g6puj2","ep-jolly-truth-b3xbibzp"
        ),
      },{
        createSessionContext(){touchedForbiddenStorage=true;},
      });
      checks.wrongProjectUrlDeniedBeforeSdkStorage=false;
    }catch(error){
      checks.wrongProjectUrlDeniedBeforeSdkStorage=!touchedForbiddenStorage &&
        error?.code==="VSN_WORKER_SHOPIFY_BOOTSTRAP_BLOCKED";
    }
    // Synthetic signed webhook, verified by both WebCrypto and the actual
    // official Shopify SDK inside real Cloudflare Workerd. This never touches
    // a Neon database or an actual merchant.
    try {
      const body=JSON.stringify({id:12345,name:"CI Dev Shop",myshopify_domain:null});
      const key=await crypto.subtle.importKey(
        "raw",new TextEncoder().encode(sdkEnv.SHOPIFY_API_SECRET),
        {name:"HMAC",hash:"SHA-256"},false,["sign"]
      );
      const signature= btoa(String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)))
      ));
      const makeWebhook=(payload=body)=>new Request(
        sdkEnv.SHOPIFY_APP_URL+"/webhooks/app/uninstalled",{
          method:"POST",
          headers:{
            "X-Shopify-Shop-Domain":"ci-merchant.myshopify.com",
            "X-Shopify-Topic":"app/uninstalled",
            "X-Shopify-API-Version":"2026-07",
            "X-Shopify-Webhook-Id":"ci-workerd-webhook-1",
            "X-Shopify-Triggered-At":"2026-10-13T09:00:00.000000Z",
            "X-Shopify-Hmac-Sha256":signature,
          },
          body:payload,
        }
      );
      let opened=0,closed=0,verified=0,deletes=0;
      const sessions=[
        {id:"ci-shop-one",shop:"ci-merchant.myshopify.com"},
        {id:"ci-shop-two",shop:"ci-merchant.myshopify.com"},
        {id:"ci-other",shop:"other-merchant.myshopify.com"},
      ];
      const installed={shop:"ci-merchant.myshopify.com",
        installedAt:new Date("2026-10-13T08:00:00Z"),uninstalledAt:null,
        lastUninstallWebhookId:null};
      const ciDatabase={
        async $transaction(callback){
          return callback({
            builderShopInstallation:{
              async updateMany({where,data}){
                if(installed.shop!==where.shop || installed.uninstalledAt ||
                   installed.installedAt>where.installedAt.lte)return {count:0};
                installed.uninstalledAt=data.uninstalledAt;
                installed.lastUninstallWebhookId=data.lastUninstallWebhookId;
                return {count:1};
              },
              async findUnique({where}){
                return where.shop===installed.shop?installed:null;
              },
            },
            session:{
              async deleteMany({where}){
                deletes++;
                const selected=sessions.filter(record=>record.shop===where.shop);
                for(let i=sessions.length-1;i>=0;i--){
                  if(sessions[i].shop===where.shop)sessions.splice(i,1);
                }
                return {count:selected.length};
              },
            },
          });
        },
      };
      const createSdkContext=(signedRequest,settings)=>
        createWorkerShopifySdkContext(signedRequest,settings,{
          async createSessionContext(){
            opened++;
            return {sessionStorage,database:ciDatabase,async close(){closed++;}};
          },
        });
      const accepted=await acceptWorkerShopifyUninstallWebhook(
        makeWebhook(),sdkEnv,{
          createSdkContext,
          async onVerified({event,context,triggeredAt}){
            if(event.shop==="ci-merchant.myshopify.com" &&
              event.topic==="APP_UNINSTALLED" &&
              event.webhookId==="ci-workerd-webhook-1")verified++;
            return revokeVerifiedWorkerShopifySessions({event,context,triggeredAt});
          },
        }
      );
      checks.realSignedWebhookAccepted=accepted.status===204 && verified===1 &&
        opened===1 && closed===1;
      checks.uninstallRevokedOnlyMerchantSessions=deletes===1 &&
        sessions.length===1 && sessions[0].shop==="other-merchant.myshopify.com";
      const replay=await acceptWorkerShopifyUninstallWebhook(
        makeWebhook(),sdkEnv,{
          createSdkContext,
          async onVerified({event,context,triggeredAt}){
            verified++;
            return revokeVerifiedWorkerShopifySessions({event,context,triggeredAt});
          },
        }
      );
      checks.uninstallReplayIsIdempotent=replay.status===204 &&
        deletes===1 && opened===2 && closed===2 &&
        sessions.length===1 && sessions[0].id==="ci-other";
      // Simulate an authentic newer installation generation that commits
      // before Shopify retries an older, still signed uninstall delivery.
      installed.installedAt=new Date("2026-10-13T10:00:00Z");
      installed.uninstalledAt=null;
      installed.lastUninstallWebhookId=null;
      sessions.push({id:"ci-new-install",shop:"ci-merchant.myshopify.com"});
      const delayed=await acceptWorkerShopifyUninstallWebhook(
        makeWebhook(),sdkEnv,{
          createSdkContext,
          async onVerified({event,context,triggeredAt}){
            verified++;
            return revokeVerifiedWorkerShopifySessions({event,context,triggeredAt});
          },
        }
      );
      checks.delayedOldUninstallCannotDeleteReinstall=delayed.status===204 &&
        deletes===1 && opened===3 && closed===3 &&
        sessions.some(record=>record.id==="ci-new-install");
      let tamperedStatus=0;
      try {
        await acceptWorkerShopifyUninstallWebhook(
          makeWebhook(body+"tampered"),sdkEnv,{
            createSdkContext,
            async onVerified(){verified++;return new Response(null,{status:204});},
          }
        );
      }catch(error){
        if(error instanceof Response)tamperedStatus=error.status;
      }
      checks.tamperedWebhookDeniedBeforeStorage=tamperedStatus===401 &&
        verified===3 && deletes===1 && opened===3 && closed===3 &&
        sessions.length===2;
    }catch{
      checks.realSignedWebhookAccepted=false;
      checks.uninstallRevokedOnlyMerchantSessions=false;
      checks.uninstallReplayIsIdempotent=false;
      checks.delayedOldUninstallCannotDeleteReinstall=false;
      checks.tamperedWebhookDeniedBeforeStorage=false;
    }
    return new Response(JSON.stringify({
      ciOnly:true,ready:false,modulesLoaded:Object.values(checks).every(Boolean),checks,
    }),{status:200,headers:LOCKED});
  }
};
