import { createElement } from "react";
// CI-only Workers runtime compatibility probe. This MUST NOT be used as
// a Shopify app entry or deployed to any Cloudflare account.
import { inspectWorkerShopifyConfiguration } from "../app/services/shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment, createWorkerNeonPrisma } from "../app/services/db-worker-neon.js";
import { createWorkerShopifySdkContext } from "../app/services/shopify-worker-sdk-context.js";
import { acceptWorkerShopifyAdminRequest, acceptWorkerShopifyAdminMutation } from "../app/services/worker-shopify-admin-gate.js";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { persistWorkerShopifySessionWithGeneration } from "../app/services/worker-shopify-install-session-storage.js";
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
    // Package and exercise the future Admin request authorization gate in
    // actual workerd. Authentication responses here are synthetic: the
    // real Shopify SDK is separately probed for rejecting untrusted requests.
    try {
      const sdkSession={
        id:"offline_ci-merchant.myshopify.com",
        shop:"ci-merchant.myshopify.com",
        isOnline:false,accessToken:"workerd-ci-fake-access",
      };
      const adminRequest=new Request(sdkEnv.SHOPIFY_APP_URL+
        "/app?shop=ci-merchant.myshopify.com");
      let privileged=0,closed=0;
      const createAdminContext=async()=>({
        shopify:{authenticate:{async admin(){
          return {session:sdkSession};
        }}},
        database:{
          builderShopInstallation:{async findUnique(){
            return {shop:sdkSession.shop,installedAt:new Date("2026-10-13T10:00:00Z"),
              uninstalledAt:null};
          }},
          session:{async findUnique(){return {...sdkSession};}},
        },
        async close(){closed++},
      });
      const accepted=await acceptWorkerShopifyAdminRequest(adminRequest,sdkEnv,{
        createSdkContext:createAdminContext,
        async onAuthenticated({shop}){
          if(shop===sdkSession.shop)privileged++;
          return new Response(null,{status:204});
        },
      });
      const forged=await acceptWorkerShopifyAdminRequest(new Request(
        sdkEnv.SHOPIFY_APP_URL+"/app?shop=other.myshopify.com"),sdkEnv,{
        createSdkContext:createAdminContext,
        async onAuthenticated(){privileged++;return new Response(null,{status:200})},
      });
      const missing=await acceptWorkerShopifyAdminRequest(adminRequest,sdkEnv,{
        createSdkContext:async()=>({
          ...(await createAdminContext()),
          database:{
            builderShopInstallation:{async findUnique(){return null}},
            session:{async findUnique(){return sdkSession}},
          },
        }),
        async onAuthenticated(){privileged++;return new Response(null,{status:200})},
      });
      checks.adminSdkShopIsolationGate=accepted.status===204 && forged.status===401 &&
        missing.status===403 && privileged===1 && closed===3;
    }catch{
      checks.adminSdkShopIsolationGate=false;
    }
    // The atomic POST contract must also execute under real Workerd globals.
    // All SDK auth, rows, and transactions here are synthetic CI fixtures;
    // genuine PostgreSQL row-lock behavior is certified separately.
    try{
      const merchant="ci-mutating.myshopify.com";
      const active={id:"offline_"+merchant,shop:merchant,
        isOnline:false,accessToken:"synthetic-locked-session"};
      let lockClaims=0,performed=0,closed=0,committed=0;
      const req=new Request(sdkEnv.SHOPIFY_APP_URL+"/app/pages?shop="+merchant,{
        method:"POST"
      });
      const factory=({revoked=false,expired=false}={})=>async()=>({
        shopify:{authenticate:{async admin(){return {session:active}}}},
        database:{
          builderShopInstallation:{async findUnique(){
            return {shop:merchant,installedAt:new Date("2026-10-13T09:00:00Z"),
              uninstalledAt:null};
          }},
          session:{async findUnique(){return expired?{...active,expires:new Date("2020-01-01T00:00:00Z")}:active}},
          async $transaction(fn){
            const result=await fn({
              builderShopInstallation:{async updateMany(){
                lockClaims++;
                return {count:revoked?0:1};
              }},
              session:{async findUnique(){return active}},
            });
            committed++;
            return result;
          },
        },
        async close(){closed++},
      });
      const good=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory(),
        async onAuthenticated({transaction,shop}){
          if(shop===merchant && transaction)performed++;
          return new Response(null,{status:204});
        },
      });
      const stale=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory({revoked:true}),
        async onAuthenticated(){performed++;return new Response(null,{status:204})},
      });
      const rejectedBusiness=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory(),
        async onAuthenticated(){return new Response("no-change",{status:422})},
      });
      const expired=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory({expired:true}),
        async onAuthenticated(){performed++;return new Response(null,{status:204})},
      });
      checks.adminMutationRequiresLockedSession=good.status===204 &&
        stale.status===403 && performed===1 && lockClaims===3 &&
        closed===4;
      checks.adminFailedMutationRollback=rejectedBusiness.status===422 &&
        committed===1;
      checks.adminExpiredOfflineSessionDenied=expired.status===403 &&
        performed===1 && committed===1;
      const deniedRedirect=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory(),
        async onAuthenticated(){return Response.redirect(
          "https://admin.shopify.com/store/test/apps/vsn-builder",303);
        },
      });
      checks.adminReturnedRedirectRollback=deniedRedirect.status===503 &&
        performed===1 && committed===1 && lockClaims===4 && closed===5;
      const broken=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory(),
        async onAuthenticated(){return new Response(new ReadableStream({
          start(controller){
            controller.enqueue(new TextEncoder().encode("partial"));
            controller.error(new Error("stream-failed"));
          },
        }),{status:200})},
      });
      const afterBroken=committed===1 && broken.status===503;
      const goodStream=await acceptWorkerShopifyAdminMutation(req,sdkEnv,{
        createSdkContext:factory(),
        async onAuthenticated(){return new Response(new ReadableStream({
          start(controller){
            controller.enqueue(new TextEncoder().encode("done"));
            controller.close();
          },
        }),{status:200})},
      });
      checks.adminPostResponseStreamAtomic=afterBroken &&
        goodStream.status===200 && (await goodStream.text())==="done" &&
        goodStream.headers.get("cache-control")==="no-store" &&
        committed===2 && lockClaims===6 && closed===7;
    }catch{checks.adminMutationRequiresLockedSession=false;
      checks.adminFailedMutationRollback=false;
      checks.adminExpiredOfflineSessionDenied=false;
      checks.adminReturnedRedirectRollback=false;
      checks.adminPostResponseStreamAtomic=false}
    // The exact official PrismaSessionStorage implementation persists an
    // offline Shopify session and its installation generation in a single
    // synthetic transaction INSIDE workerd (no Neon query/merchant API).
    try {
      let savedRow=null,savedInstall=null,transactionCommits=0;
      const syntheticDb={
        async $transaction(work) {
          let row=savedRow?{...savedRow}:null;
          let generation=savedInstall?{...savedInstall}:null;
          const tx={
            builderShopInstallation:{
              async upsert({where,create,update}){
                generation=generation?{...generation,...update}:{...create};
                return {...generation};
              },
              async updateMany({where,data}){
                if(!generation || generation.shop!==where.shop)return {count:0};
                generation={...generation,...data};return {count:1};
              },
              async findUnique({where}){
                return generation?.shop===where.shop?{...generation}:null;
              },
            },
            session:{
              async count(){return row?1:0},
              async findUnique({where}){return row?.id===where.id?{...row}:null},
              async upsert({where,update,create}){
                row=row?.id===where.id?{...update}:{...create};
                return {...row};
              },
            },
          };
          const result=await work(tx);
          savedRow=row;savedInstall=generation;transactionCommits++;
          return result;
        },
      };
      const shop="ci-offline-install.myshopify.com";
      const session={
        id:"offline_"+shop,shop,state:"",isOnline:false,
        scope:"read_products",accessToken:"synthetic-workerd-only-access-token",
        toObject(){return {};},
      };
      const saved=await persistWorkerShopifySessionWithGeneration(
        session,syntheticDb,{
          SessionStorage:PrismaSessionStorage,
          clock:()=>new Date("2026-10-13T10:00:00Z"),
        }
      );
      checks.officialShopifyOfflineSessionFenced=saved===true &&
        transactionCommits===1 && savedInstall?.shop===shop &&
        savedInstall?.uninstalledAt===null &&
        savedRow?.id===session.id &&
        savedRow?.accessToken===session.accessToken;
    }catch{
      checks.officialShopifyOfflineSessionFenced=false;
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
      // The real hosted SDK does NOT offer any independent event-generation
      // attestor. Forge a signed-body event plus a future unsigned header:
      // it must be refused BEFORE a destructive transaction starts.
      const unsafe=await revokeVerifiedWorkerShopifySessions({
        event:{
          shop:"ci-merchant.myshopify.com",topic:"APP_UNINSTALLED",
          webhookId:"ci-workerd-webhook-1",payload:JSON.parse(body),
        },
        context:{database:ciDatabase},
        triggeredAt:new Date("2030-01-01T00:00:00Z"),
      });
      checks.unsignedTimestampCannotDeleteMerchant=unsafe.status===503 &&
        deletes===0 && sessions.length===3;
      // All below are CI-only synthetic attestations, deliberately NOT a
      // hosted Shopify App SDK feature or proof of genuine event provenance.
      const withSyntheticCiAttestation=context=>({
        ...context,
        verifyTrustedUninstallGeneration:async({shop})=>
          shop==="ci-merchant.myshopify.com",
      });
      const accepted=await acceptWorkerShopifyUninstallWebhook(
        makeWebhook(),sdkEnv,{
          createSdkContext,
          async onVerified({event,context,triggeredAt}){
            if(event.shop==="ci-merchant.myshopify.com" &&
              event.topic==="APP_UNINSTALLED" &&
              event.webhookId==="ci-workerd-webhook-1")verified++;
            return revokeVerifiedWorkerShopifySessions({event,context:withSyntheticCiAttestation(context),triggeredAt});
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
            return revokeVerifiedWorkerShopifySessions({event,context:withSyntheticCiAttestation(context),triggeredAt});
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
            return revokeVerifiedWorkerShopifySessions({event,context:withSyntheticCiAttestation(context),triggeredAt});
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
      checks.unsignedTimestampCannotDeleteMerchant=false;
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
