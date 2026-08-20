import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fetchShopifySubscriptionState,
  getShopifySubscriptionSyncConfig,
  getShopifySubscriptionSyncPublicConfig,
  isRetryablePartnerStatus,
  subscriptionMirrorMatchesCurrentPlanHandles,
  syncShopifySubscription,
} from "../app/services/shopify-subscription.server.js";
import { getShopifyPlanHandleMap } from "../app/services/shopify-app-pricing.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
function versionAtLeast(value, floor){const a=String(value).split(".").map(Number),b=String(floor).split(".").map(Number);for(let i=0;i<3;i+=1){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false;}return true;}
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
async function withEnv(values,fn){const before={};for(const [key,value] of Object.entries(values)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=String(value);}try{return await fn();}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}
function headers(values={}){const map=Object.fromEntries(Object.entries(values).map(([k,v])=>[k.toLowerCase(),String(v)]));return {get:(name)=>map[String(name).toLowerCase()]??null};}
function response(data,{ok=true,status=200,headers:headerValues={}}={}){return {ok,status,headers:headers(headerValues),json:async()=>data};}
const now=new Date("2026-08-09T07:00:00.000Z");
const shop="cool-shop.myshopify.com";
const appId="gid://shopify/App/11";
const shopId="gid://shopify/Shop/22";
const baseEnv={NODE_ENV:"production",SHOPIFY_PARTNER_ORGANIZATION_ID:"123456",SHOPIFY_PARTNER_API_TOKEN:"partner-token",SHOPIFY_PARTNER_API_VERSION:"2026-07",SHOPIFY_PARTNER_API_RETRY_COUNT:"2",SHOPIFY_PARTNER_API_RETRY_BASE_MS:"0",SHOPIFY_APP_PRICING_PLAN_FREE_HANDLE:"free",SHOPIFY_APP_PRICING_PLAN_SILVER_HANDLE:"sliver",SHOPIFY_APP_PRICING_PLAN_GOLD_HANDLE:"gold",SHOPIFY_APP_PRICING_PLAN_PLATINUM_HANDLE:"platenium",SHOPIFY_APP_PRICING_PLAN_CORE_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_PRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_CRO_HANDLE:undefined,SHOPIFY_APP_PRICING_PLAN_AGENCY_HANDLE:undefined};
function active(handle,extra={}){return {shop:{id:shopId,myshopifyDomain:shop},billingPeriod:"EVERY_30_DAYS",cancelAtEndOfCycle:false,trialEndsAt:null,currentBillingCycle:{startTime:"2026-08-01T00:00:00Z",endTime:"2026-08-31T00:00:00Z"},items:[{handle}],pendingUpdate:null,legacySubscriptionId:null,...extra};}
function event(state,handle="sliver",extra={}){return {id:`event-${state}-${handle}`,occurredAt:"2026-08-09T06:00:00Z",eventType:`SUBSCRIPTION_${state}`,state,plan:{handle,billingPeriod:"EVERY_30_DAYS",trialDays:0,trialDaysRemaining:0},shop:{id:shopId,myshopifyDomain:shop},...extra};}
function payload(activeSubscription=null,eventNode=null){return {data:{activeSubscription,events:{edges:eventNode?[{node:eventNode}]:[]}}};}
async function stateFor(activeSubscription,eventNode=null,options={}){return withEnv(baseEnv,()=>fetchShopifySubscriptionState({appId,shopId,expectedShop:shop,now,fetchImpl:async()=>response(payload(activeSubscription,eventNode)),sleepImpl:async()=>{},...options}));}
function memoryDb(initial=null){let row=initial;return {get row(){return row;},builderSubscription:{findUnique:async()=>row,upsert:async({create,update})=>{row=row?{...row,...update}:{id:"sub-1",...create};return row;},update:async({data})=>{if(row)row={...row,...data};return row;}}};}
function adminIdentity(){return {graphql:async()=>response({data:{currentAppInstallation:{app:{id:appId}},shop:{id:shopId,myshopifyDomain:shop}}})};}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const service=read("app/services/shopify-subscription.server.js");
const appShell=read("app/routes/app.jsx");
const lifecycleDelete=read("app/services/shop-data-lifecycle.server.js");
const env=read(".env.example");
const docs=read("docs/developer/billing-production-qa.md");
const pricingService=read("app/services/shopify-app-pricing.server.js");

await check("Version retains the Q5.5 production baseline",()=>assert.equal(versionAtLeast(pkg.version,"2.5.97"),true));
await check("Baseline retains Q5.5 billing-production capability",()=>{assert.equal(versionAtLeast(baseline.version,"2.5.97"),true);const source=read("app/config/baseline.js");assert.match(source,/billingProductionQa:\s*1/)});
await check("Q5.5 audit is in release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q55-billing-production-lifecycle-audit.mjs")));
await check("Q5.5 dedicated command exists",()=>assert.equal(pkg.scripts?.["qa:q55"],"node scripts/milestone-q55-billing-production-lifecycle-audit.mjs"));
await check("Q5.5 developer-mode report is packaged",()=>assert.equal(exists("MILESTONE_Q55_DEVELOPER_MODE.md"),true));
await check("Q5.5 milestone report is packaged",()=>assert.equal(exists("VSN_MILESTONE_Q55_BILLING_PRODUCTION_LIFECYCLE_REPORT_v2.5.97.md"),true));
await check("Q5.5 production lifecycle documentation is packaged",()=>assert.equal(exists("docs/developer/billing-production-qa.md"),true));
await check("Exact Shopify plan handles remain unchanged",()=>withEnv(baseEnv,()=>assert.deepEqual(getShopifyPlanHandleMap(),{core:"free",pro:"sliver",cro:"gold",agency:"platenium"})));

await check("Partner sync defaults to two bounded retries",()=>withEnv({...baseEnv,SHOPIFY_PARTNER_API_RETRY_COUNT:undefined},()=>assert.equal(getShopifySubscriptionSyncConfig().retryCount,2)));
await check("Public sync config exposes retry count but no secret",()=>withEnv(baseEnv,()=>{const config=getShopifySubscriptionSyncPublicConfig();assert.equal(config.retryCount,2);assert.equal("accessToken" in config,false);assert.equal("endpoint" in config,false)}));
await check("HTTP 429 is retryable",()=>assert.equal(isRetryablePartnerStatus(429),true));
await check("HTTP 503 is retryable",()=>assert.equal(isRetryablePartnerStatus(503),true));
await check("HTTP 401 is not retryable",()=>assert.equal(isRetryablePartnerStatus(401),false));
await check("Retry count is capped to three",()=>withEnv({...baseEnv,SHOPIFY_PARTNER_API_RETRY_COUNT:"99"},()=>assert.equal(getShopifySubscriptionSyncConfig().retryCount,3)));

await check("First install without a contract fails closed to Free",async()=>{const state=await stateFor(null);assert.equal(state.planKey,"core");assert.equal(state.status,"inactive")});
await check("Verified Free contract stays Free and active",async()=>{const state=await stateFor(active("free"),event("CREATED","free"));assert.equal(state.planKey,"core");assert.equal(state.planHandle,"free");assert.equal(state.status,"active")});
await check("Silver Shopify key maps to internal Pro",async()=>{const state=await stateFor(active("sliver"),event("CREATED","sliver"));assert.equal(state.planKey,"pro");assert.equal(state.planHandle,"sliver")});
await check("Gold Shopify key maps to internal CRO",async()=>{const state=await stateFor(active("gold"),event("CREATED","gold"));assert.equal(state.planKey,"cro");assert.equal(state.planHandle,"gold")});
await check("Platinum Shopify key maps to internal Agency",async()=>{const state=await stateFor(active("platenium"),event("CREATED","platenium"));assert.equal(state.planKey,"agency");assert.equal(state.planHandle,"platenium")});
await check("Active Gold overrides stale Silver history after immediate upgrade",async()=>{const state=await stateFor(active("gold"),event("UPDATED","sliver"));assert.equal(state.planKey,"cro");assert.equal(state.planHandle,"gold");assert.equal(state.diagnostics.historicalPlanHandle,"sliver")});
await check("Active Gold ignores stale canceled history for plan authority",async()=>{const state=await stateFor(active("gold"),event("CANCELED","sliver"));assert.equal(state.status,"active");assert.equal(state.planKey,"cro")});
await check("Active Free can follow a canceled paid history",async()=>{const state=await stateFor(active("free"),event("CANCELED","sliver"));assert.equal(state.status,"active");assert.equal(state.planKey,"core");assert.equal(state.planHandle,"free")});
await check("Pending Platinum to Gold change is exposed as Gold",async()=>{const current=active("platenium",{pendingUpdate:{billingPeriod:"EVERY_30_DAYS",items:[{handle:"gold"}],legacySubscriptionId:null}});const state=await stateFor(current,event("UPDATED","platenium"));assert.equal(state.planKey,"agency");assert.equal(state.pendingPlanKey,"cro");assert.equal(state.pendingPlanHandle,"gold")});
await check("Pending Silver to Platinum upgrade is exposed",async()=>{const current=active("sliver",{pendingUpdate:{billingPeriod:"EVERY_30_DAYS",items:[{handle:"platenium"}],legacySubscriptionId:null}});const state=await stateFor(current,event("UPDATED","sliver"));assert.equal(state.planKey,"pro");assert.equal(state.pendingPlanKey,"agency")});
await check("Billing-period-only pending update preserves current plan",async()=>{const current=active("sliver",{pendingUpdate:{billingPeriod:"ANNUAL",items:[{handle:"sliver"}],legacySubscriptionId:null}});const state=await stateFor(current,event("UPDATED","sliver"));assert.equal(state.planKey,"pro");assert.equal(state.pendingPlanKey,"pro");assert.equal(state.pendingBillingPeriod,"ANNUAL")});
await check("Scheduled cancellation keeps paid access until effective date",async()=>{const current=active("sliver",{cancelAtEndOfCycle:true});const state=await stateFor(current,event("CANCELLATION_SCHEDULED","sliver",{cancelEffectiveOn:"2026-08-31"}));assert.equal(state.status,"canceling");assert.equal(state.planKey,"pro");assert.equal(state.pendingPlanKey,"core");assert.equal(state.pendingPlanHandle,"free")});
await check("Effective cancellation without active contract becomes Free",async()=>{const state=await stateFor(null,event("CANCELLATION_SCHEDULED","sliver",{cancelEffectiveOn:"2026-08-01"}));assert.equal(state.status,"canceled");assert.equal(state.planKey,"core")});
await check("Canceled contract without active subscription becomes Free",async()=>{const state=await stateFor(null,event("CANCELED","gold"));assert.equal(state.status,"canceled");assert.equal(state.planKey,"core")});
await check("Frozen paid subscription immediately fails closed to Free",async()=>{const state=await stateFor(active("gold"),event("FROZEN","gold"));assert.equal(state.status,"frozen");assert.equal(state.planKey,"core")});
await check("Unfrozen Gold subscription restores paid entitlement",async()=>{const state=await stateFor(active("gold"),event("UNFROZEN","gold"));assert.equal(state.status,"active");assert.equal(state.planKey,"cro")});
await check("Silver trial remains Silver while trial is active",async()=>{const state=await stateFor(active("sliver",{trialEndsAt:"2026-08-15T00:00:00Z",currentBillingCycle:null}),event("CREATED","sliver"));assert.equal(state.status,"trialing");assert.equal(state.planKey,"pro")});
await check("Unknown active handle never inherits a paid historical handle",async()=>{const state=await stateFor(active("mystery"),event("UPDATED","platenium"));assert.equal(state.planKey,"core");assert.equal(state.planHandle,null);assert.equal(state.diagnostics.historicalPlanKey,"agency")});
await check("Ambiguous active paid handles fail closed to Free",async()=>{const state=await stateFor(active("sliver",{items:[{handle:"sliver"},{handle:"gold"}]}),event("UPDATED","gold"));assert.equal(state.planKey,"core");assert.equal(state.planHandle,null);assert.equal(state.diagnostics.activePlanAmbiguous,true)});
await check("Historical paid event without an active contract cannot grant paid access",async()=>{const state=await stateFor(null,event("UPDATED","platenium"));assert.equal(state.status,"inactive");assert.equal(state.planKey,"core")});
await check("Partner API shop mismatch remains rejected",()=>withEnv(baseEnv,async()=>{const wrong=active("gold",{shop:{id:"gid://shopify/Shop/99",myshopifyDomain:"other.myshopify.com"}});await assert.rejects(()=>fetchShopifySubscriptionState({appId,shopId,expectedShop:shop,now,fetchImpl:async()=>response(payload(wrong,event("UPDATED","gold"))),sleepImpl:async()=>{}}),/did not match/)}));

await check("HTTP 429 retries and then recovers",()=>withEnv(baseEnv,async()=>{
  let attempts=0;const sleeps=[];
  const state=await fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,
    sleepImpl:async(ms)=>sleeps.push(ms),
    fetchImpl:async()=>{
      attempts+=1;
      return attempts===1
        ? response({}, {ok:false,status:429,headers:{"Retry-After":"0"}})
        : response(payload(active("sliver"),event("UPDATED","sliver")));
    },
  });
  assert.equal(attempts,2);assert.equal(state.planKey,"pro");assert.equal(sleeps.length,1);
}));
await check("HTTP 503 retries and then recovers",()=>withEnv(baseEnv,async()=>{
  let attempts=0;
  const state=await fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,sleepImpl:async()=>{},
    fetchImpl:async()=>{
      attempts+=1;
      return attempts===1?response({}, {ok:false,status:503}):response(payload(active("gold"),event("UPDATED","gold")));
    },
  });
  assert.equal(attempts,2);assert.equal(state.planKey,"cro");
}));
await check("Transient network failure retries and then recovers",()=>withEnv(baseEnv,async()=>{
  let attempts=0;
  const state=await fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,sleepImpl:async()=>{},
    fetchImpl:async()=>{
      attempts+=1;
      if(attempts===1)throw new TypeError("temporary network failure");
      return response(payload(active("platenium"),event("UPDATED","platenium")));
    },
  });
  assert.equal(attempts,2);assert.equal(state.planKey,"agency");
}));
await check("GraphQL throttling retries and then recovers",()=>withEnv(baseEnv,async()=>{
  let attempts=0;
  const state=await fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,sleepImpl:async()=>{},
    fetchImpl:async()=>{
      attempts+=1;
      return attempts===1
        ? response({errors:[{message:"Throttled",extensions:{code:"THROTTLED"}}]})
        : response(payload(active("free"),event("UPDATED","free")));
    },
  });
  assert.equal(attempts,2);assert.equal(state.planKey,"core");
}));
await check("GraphQL permission failure is not retried",()=>withEnv(baseEnv,async()=>{
  let attempts=0;
  await assert.rejects(()=>fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,sleepImpl:async()=>{},
    fetchImpl:async()=>{attempts+=1;return response({errors:[{message:"Access denied",extensions:{code:"FORBIDDEN"}}]});},
  }),/Access denied/);
  assert.equal(attempts,1);
}));
await check("HTTP 401 is never retried",()=>withEnv(baseEnv,async()=>{
  let attempts=0;
  await assert.rejects(()=>fetchShopifySubscriptionState({
    appId,shopId,expectedShop:shop,now,sleepImpl:async()=>{},
    fetchImpl:async()=>{attempts+=1;return response({}, {ok:false,status:401});},
  }),/HTTP 401/);
  assert.equal(attempts,1);
}));
await check("Invalid Partner JSON fails explicitly",()=>withEnv(baseEnv,async()=>{
  const broken={ok:true,status:200,headers:headers(),json:async()=>{throw new SyntaxError("bad json");}};
  await assert.rejects(()=>fetchShopifySubscriptionState({appId,shopId,expectedShop:shop,now,fetchImpl:async()=>broken,sleepImpl:async()=>{}}),/invalid JSON/);
}));

await check("Current exact Silver mirror remains cache-compatible",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"sliver"}),true)));
await check("Legacy Pro mirror forces re-verification",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"active",planKey:"pro",planHandle:"pro"}),false)));
await check("Inactive mirror cannot grant paid access based on its old handle",()=>withEnv(baseEnv,()=>assert.equal(subscriptionMirrorMatchesCurrentPlanHandles({status:"inactive",planKey:"core",planHandle:"platenium"}),true)));

await check("Uninstall lifecycle deletes the disposable subscription mirror",()=>assert.ok(lifecycleDelete.includes("db.builderSubscription.deleteMany({ where: { shop } })")));
await check("App shell always attempts subscription sync before loading the plan",()=>assert.ok(appShell.indexOf("syncShopifySubscription")<appShell.indexOf("getPlan(db, session.shop)")));
await check("Reinstall with no local mirror rebuilds Platinum from Shopify",()=>withEnv(baseEnv,async()=>{const db=memoryDb(null);let partnerCalls=0;const result=await syncShopifySubscription({db,admin:adminIdentity(),shop,force:false,now,sleepImpl:async()=>{},fetchImpl:async()=>{partnerCalls+=1;return response(payload(active("platenium"),event("CREATED","platenium")))} });assert.equal(result.ok,true);assert.equal(result.verified,true);assert.equal(partnerCalls,1);assert.equal(db.row.planKey,"agency");assert.equal(db.row.planHandle,"platenium")}));
await check("Reinstall mirror is marked Shopify-authoritative",()=>withEnv(baseEnv,async()=>{const db=memoryDb(null);await syncShopifySubscription({db,admin:adminIdentity(),shop,force:true,now,sleepImpl:async()=>{},fetchImpl:async()=>response(payload(active("gold"),event("CREATED","gold")))});assert.equal(db.row.provider,"shopify-app-pricing");assert.equal(db.row.status,"active");assert.equal(new Date(db.row.verifiedAt).toISOString(),now.toISOString())}));
await check("Successful verification stores authority diagnostics snapshot",()=>withEnv(baseEnv,async()=>{const db=memoryDb(null);await syncShopifySubscription({db,admin:adminIdentity(),shop,force:true,now,sleepImpl:async()=>{},fetchImpl:async()=>response(payload(active("gold"),event("UPDATED","sliver")))});const snapshot=JSON.parse(db.row.snapshotJson);assert.equal(snapshot.diagnostics.historicalPlanHandle,"sliver");assert.equal(snapshot.diagnostics.activePlanAmbiguous,false)}));

await check("Environment documents Partner retry count",()=>assert.ok(env.includes("SHOPIFY_PARTNER_API_RETRY_COUNT=2")));
await check("Environment documents Partner retry backoff",()=>assert.ok(env.includes("SHOPIFY_PARTNER_API_RETRY_BASE_MS=250")));
await check("Production QA docs preserve exact sliver spelling",()=>assert.ok(docs.includes("`sliver`")));
await check("Production QA docs preserve exact platenium spelling",()=>assert.ok(docs.includes("`platenium`")));
await check("Production QA docs cover reinstall",()=>assert.ok(/reinstall/i.test(docs)&&/local `BuilderSubscription` mirror/i.test(docs)));
await check("Active subscription is explicitly documented as canonical authority",()=>assert.ok(service.includes("activeSubscription is the canonical current contract")));
await check("Historical plan cannot override active item in implementation",()=>assert.ok(service.includes("let planKey=active?activePlan.key:eventKey")));
await check("No legacy Billing API create/cancel mutation was introduced",()=>assert.doesNotMatch(service+pricingService,/appSubscription(Create|Cancel)\s*\(/));
await check("Q5.5 adds no Prisma migration",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q55|billing_production|lifecycle_qa/i.test(name)),false));

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q5.5 Billing Production Lifecycle audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
