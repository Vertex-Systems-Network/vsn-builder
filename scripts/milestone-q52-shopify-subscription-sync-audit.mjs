import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fetchShopifySubscriptionState,
  getShopifySubscriptionSyncConfig,
  getShopifySubscriptionSyncPublicConfig,
  resolveShopifyBillingIdentity,
  subscriptionMirrorIsFresh,
  subscriptionMirrorIsTrusted,
  subscriptionMirrorMatchesCurrentPlanHandles,
} from "../app/services/shopify-subscription.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
async function withEnv(values,fn){const before={};for(const [key,value] of Object.entries(values)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}try{return await fn();}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}
function response(data,{ok=true,status=200}={}){return {ok,status,json:async()=>data};}
const baseEnv={SHOPIFY_PARTNER_ORGANIZATION_ID:"123456",SHOPIFY_PARTNER_API_TOKEN:"partner-token",SHOPIFY_PARTNER_API_VERSION:"2026-07",SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE:"free",SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:"sliver",SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:"gold",SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE:"platenium",SHOPIFY_APP_PRICING_PLAN_CORE_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_CRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_AGENCY_HANDLE:undefined};
const now=new Date("2026-08-09T03:00:00.000Z");
const activePro={shop:{id:"gid://shopify/Shop/22",myshopifyDomain:"cool-shop.myshopify.com"},billingPeriod:"EVERY_30_DAYS",cancelAtEndOfCycle:false,trialEndsAt:null,currentBillingCycle:{startTime:"2026-08-01T00:00:00Z",endTime:"2026-08-31T00:00:00Z"},items:[{handle:"sliver"}],pendingUpdate:null,legacySubscriptionId:"gid://shopify/AppSubscription/9"};
function event(state,handle="sliver",extra={}){return {id:`event-${state}`,occurredAt:"2026-08-09T02:00:00Z",eventType:`SUBSCRIPTION_${state}`,state,plan:{handle,billingPeriod:"EVERY_30_DAYS",trialDays:0,trialDaysRemaining:0},shop:{id:"gid://shopify/Shop/22",myshopifyDomain:"cool-shop.myshopify.com"},...extra};}

const pkg=JSON.parse(read("package.json"));
const service=read("app/services/shopify-subscription.server.js");
const planServer=read("app/utils/plan.server.js");
const entitlementService=read("app/services/entitlements.server.js");
const rootRoute=read("app/routes/app.jsx");
const dashboardRoute=read("app/routes/app._index.jsx");
const plansRoute=read("app/routes/app.plans.jsx");
const license=read("app/components/dashboard/pages/License.jsx");
const schema=read("prisma/schema.prisma");
const migration=read("prisma/migrations/20260809030000_milestone_q52_subscription_sync/migration.sql");
const env=read(".env.example");
const prodRuntime=read("scripts/validate-production-runtime.mjs");

await check("Version is v2.5.94 or newer",()=>{const [a,b,c]=String(pkg.version).split(".").map(Number);assert.ok(a>2||(a===2&&(b>5||(b===5&&c>=94))))});
await check("Q5.2 audit is in release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q52-shopify-subscription-sync-audit.mjs")));
await check("Subscription sync service is packaged",()=>assert.equal(exists("app/services/shopify-subscription.server.js"),true));
await check("Q5.2 developer-mode report is packaged",()=>assert.equal(exists("MILESTONE_Q52_DEVELOPER_MODE.md"),true));
await check("Q5.2 milestone report is packaged",()=>assert.equal(exists("VSN_MILESTONE_Q52_SHOPIFY_SUBSCRIPTION_SYNC_REPORT_v2.5.94.md"),true));
await check("Subscription sync developer documentation is packaged",()=>assert.equal(exists("docs/developer/shopify-subscription-sync.md"),true));

await check("Partner API config rejects missing credentials",()=>withEnv({SHOPIFY_PARTNER_ORGANIZATION_ID:undefined,SHOPIFY_PARTNER_ORG_ID:undefined,SHOPIFY_PARTNER_API_TOKEN:undefined,SHOPIFY_PARTNER_ACCESS_TOKEN:undefined},()=>assert.equal(getShopifySubscriptionSyncConfig().configured,false)));
await check("Partner API endpoint is generated from org and version",()=>withEnv(baseEnv,()=>assert.equal(getShopifySubscriptionSyncConfig().endpoint,"https://partners.shopify.com/123456/api/2026-07/graphql.json")));
await check("Public sync config does not expose org ID, token or endpoint",()=>withEnv(baseEnv,()=>{const config=getShopifySubscriptionSyncPublicConfig();assert.equal(config.configured,true);assert.equal("organizationId" in config,false);assert.equal("endpoint" in config,false);assert.equal("accessToken" in config,false);}));

await check("Admin identity resolves current app and shop IDs",async()=>{const admin={graphql:async(q)=>{assert.match(q,/currentAppInstallation\s*\{\s*app\s*\{\s*id/);return response({data:{currentAppInstallation:{app:{id:"gid://shopify/App/11"}},shop:{id:"gid://shopify/Shop/22",myshopifyDomain:"cool-shop.myshopify.com"}}});}};assert.deepEqual(await resolveShopifyBillingIdentity(admin,"cool-shop.myshopify.com"),{appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",shop:"cool-shop.myshopify.com"});});
await check("Admin identity rejects authenticated-shop mismatch",async()=>{const admin={graphql:async()=>response({data:{currentAppInstallation:{app:{id:"gid://shopify/App/11"}},shop:{id:"gid://shopify/Shop/22",myshopifyDomain:"other.myshopify.com"}}})};await assert.rejects(()=>resolveShopifyBillingIdentity(admin,"cool-shop.myshopify.com"),/did not match/);});

await check("Active Silver Shopify key maps to internal Pro entitlement",()=>withEnv(baseEnv,async()=>{const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async(_url,init)=>{assert.equal(init.headers["X-Shopify-Access-Token"],"partner-token");const body=JSON.parse(init.body);assert.match(body.query,/activeSubscription/);assert.match(body.query,/events\(/);return response({data:{activeSubscription:activePro,events:{edges:[{node:event("UPDATED")}]}}});}});assert.equal(state.planKey,"pro");assert.equal(state.status,"active");assert.equal(state.billingPeriod,"EVERY_30_DAYS");assert.equal(state.currentCycleEnd,"2026-08-31T00:00:00Z");}));
await check("Future trial end maps active contract to trialing",()=>withEnv(baseEnv,async()=>{const active={...activePro,trialEndsAt:"2026-08-20T00:00:00Z"};const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:active,events:{edges:[{node:event("CREATED")}]}}})});assert.equal(state.status,"trialing");assert.equal(state.planKey,"pro");}));
await check("Scheduled cancellation preserves Silver entitlement and exposes Free pending",()=>withEnv(baseEnv,async()=>{const active={...activePro,cancelAtEndOfCycle:true};const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:active,events:{edges:[{node:event("CANCELLATION_SCHEDULED","sliver",{cancelEffectiveOn:"2026-08-31"})}]}}})});assert.equal(state.status,"canceling");assert.equal(state.planKey,"pro");assert.equal(state.pendingPlanKey,"core");assert.equal(state.cancelEffectiveOn,"2026-08-31");}));
await check("Expired scheduled cancellation without active contract fails closed to Core",()=>withEnv(baseEnv,async()=>{const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:null,events:{edges:[{node:event("CANCELLATION_SCHEDULED","sliver",{cancelEffectiveOn:"2026-08-01"})}]}}})});assert.equal(state.status,"canceled");assert.equal(state.planKey,"core");}));
await check("Canceled subscription fails closed to Core",()=>withEnv(baseEnv,async()=>{const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:null,events:{edges:[{node:event("CANCELED")}]}}})});assert.equal(state.status,"canceled");assert.equal(state.planKey,"core");}));
await check("Frozen subscription fails closed to Core",()=>withEnv(baseEnv,async()=>{const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:activePro,events:{edges:[{node:event("FROZEN")}]}}})});assert.equal(state.status,"frozen");assert.equal(state.planKey,"core");}));
await check("Unrecognized paid handle never grants a paid internal tier",()=>withEnv(baseEnv,async()=>{const active={...activePro,items:[{handle:"unknown-enterprise"}]};const state=await fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:active,events:{edges:[]}}})});assert.equal(state.planKey,"core");assert.equal(state.planHandle,null);}));
await check("Partner API shop mismatch is rejected even from historical event",()=>withEnv(baseEnv,async()=>{const wrong={...event("UPDATED"),shop:{id:"gid://shopify/Shop/99",myshopifyDomain:"other.myshopify.com"}};await assert.rejects(()=>fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({data:{activeSubscription:null,events:{edges:[{node:wrong}]}}})}),/did not match/);}));
await check("Partner GraphQL errors reject verification",()=>withEnv(baseEnv,async()=>{await assert.rejects(()=>fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({errors:[{message:"denied"}]})}),/Partner API: denied/);}));
await check("Partner HTTP errors reject verification",()=>withEnv(baseEnv,async()=>{await assert.rejects(()=>fetchShopifySubscriptionState({appId:"gid://shopify/App/11",shopId:"gid://shopify/Shop/22",expectedShop:"cool-shop.myshopify.com",now,fetchImpl:async()=>response({}, {ok:false,status:401})}),/HTTP 401/);}));

await check("Fresh verified mirror is cacheable",()=>withEnv({...baseEnv,SHOPIFY_SUBSCRIPTION_CACHE_TTL_SECONDS:"300"},()=>assert.equal(subscriptionMirrorIsFresh({verifiedAt:new Date(now.getTime()-60_000)},now),true)));
await check("Expired cache is not fresh",()=>withEnv({...baseEnv,SHOPIFY_SUBSCRIPTION_CACHE_TTL_SECONDS:"300"},()=>assert.equal(subscriptionMirrorIsFresh({verifiedAt:new Date(now.getTime()-400_000)},now),false)));
await check("Current Silver handle is compatible with cached internal Pro mirror",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"sliver"}),true)));
await check("Legacy Pro handle forces cache re-verification after Shopify-key remap",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"pro"}),false)));
await check("Verified Shopify mirror is trusted inside stale window",()=>withEnv({...baseEnv,SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"3600"},()=>assert.equal(subscriptionMirrorIsTrusted({provider:"shopify-app-pricing",verifiedAt:new Date(now.getTime()-3_000_000)},now),true)));
await check("Local/dev mirror cannot become production authority",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorIsTrusted({provider:null,verifiedAt:now},now),false)));
await check("Over-stale verified mirror loses authority",()=>withEnv({...baseEnv,SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS:"300"},()=>assert.equal(subscriptionMirrorIsTrusted({provider:"shopify-app-pricing",verifiedAt:new Date(now.getTime()-400_000)},now),false)));

await check("Schema persists verified subscription mirror lifecycle",()=>["provider","planHandle","billingPeriod","cancelAtEndOfCycle","cancelEffectiveOn","currentCycleEnd","pendingPlanKey","shopifyAppId","shopifyShopId","verifiedAt","lastSyncError","snapshotJson"].forEach((field)=>assert.match(schema,new RegExp(`\\b${field}\\b`))));
await check("Schema indexes provider/status/verification freshness",()=>assert.match(schema,/@@index\(\[provider, status, verifiedAt\]\)/));
await check("Q5.2 migration is additive and indexed",()=>{assert.match(migration,/ALTER TABLE "BuilderSubscription" ADD COLUMN "provider"/);assert.match(migration,/CREATE INDEX "BuilderSubscription_provider_status_verifiedAt_idx"/);assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM|TRUNCATE/i);});
await check("Production plan authority requires verified Shopify mirror",()=>{
  const authoritySource=entitlementService||planServer;
  assert.ok(service.includes('provider!=="shopify-app-pricing"')&&authoritySource.includes('subscriptionMirrorIsTrusted(row')&&authoritySource.includes('["active", "trialing", "canceling"]'));
});
await check("Inactive/canceled/frozen mirrors cannot retain paid entitlement",()=>assert.match(service,/\["inactive","canceled","frozen"\]\.includes\(status\)/));
await check("Sync failure records error without overwriting plan fields",()=>assert.ok(service.includes("lastSyncError:message")&&!/lastSyncError:message[^}]*planKey/.test(service)));
await check("Concurrent per-shop syncs are deduplicated",()=>assert.ok(service.includes("syncLocks.has(key)")&&service.includes("syncLocks.set(key,task)")));
await check("Developer Mode avoids live Partner calls by default",()=>assert.ok(service.includes("VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT")&&service.includes('reason:"developer-mode"')));
await check("App shell refreshes subscription mirror before entitlement loading",()=>assert.ok(rootRoute.includes("syncShopifySubscription")&&rootRoute.indexOf("syncShopifySubscription")<rootRoute.indexOf("getPlan(db, session.shop)")));
await check("Dashboard forces verification after Shopify pricing return",()=>assert.ok(dashboardRoute.includes("force: Boolean(pricingReturn?.pendingVerification)")));
await check("Plans route forces verification after Shopify pricing return",()=>assert.ok(plansRoute.includes("force:Boolean(pricingReturn?.pendingVerification)")));
await check("Client payload receives redacted sync configuration",()=>assert.ok(dashboardRoute.includes("getShopifySubscriptionSyncPublicConfig")&&plansRoute.includes("getShopifySubscriptionSyncPublicConfig")));
await check("License UI exposes verified lifecycle and pending state",()=>assert.ok(license.includes("Refresh Shopify status")&&license.includes("pendingKind")&&license.includes("cancelEffectiveOn")));
await check("Environment documents Partner API credentials and cache controls",()=>["SHOPIFY_PARTNER_ORGANIZATION_ID=","SHOPIFY_PARTNER_API_TOKEN=","SHOPIFY_PARTNER_API_VERSION=2026-07","SHOPIFY_SUBSCRIPTION_CACHE_TTL_SECONDS=300","SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS=86400"].forEach((row)=>assert.ok(env.includes(row))));
await check("Production validator requires Partner API verification credentials",()=>assert.ok(prodRuntime.includes("SHOPIFY_PARTNER_ORGANIZATION_ID")&&prodRuntime.includes("SHOPIFY_PARTNER_API_TOKEN")));
await check("Q5.2 does not create Billing API subscription charges",()=>assert.doesNotMatch(service+plansRoute,/appSubscriptionCreate\s*\(/));

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q5.2 verified Shopify subscription sync audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
