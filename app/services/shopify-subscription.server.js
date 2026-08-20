import { getShopifyPlanHandleMap, normalizePricingHandle, normalizeShopDomain, resolveInternalPlanKeyFromHandle } from "./shopify-app-pricing.server.js";

const API_VERSION_RE=/^2026-(07|10)$|^unstable$/;
const ORG_RE=/^[A-Za-z0-9_-]{1,120}$/;
const syncLocks=new Map();
const RETRYABLE_HTTP=new Set([429,500,502,503,504]);
const RETRYABLE_GRAPHQL_CODES=new Set(["429","THROTTLED","INTERNAL_SERVER_ERROR","SERVICE_UNAVAILABLE"]);
const QUERY=`query VsnSubscriptionState($appId: ID!, $shopId: ID!, $occurredAtMin: DateTime!) {
  activeSubscription(appId:$appId,shopId:$shopId){shop{id myshopifyDomain} billingPeriod cancelAtEndOfCycle trialEndsAt currentBillingCycle{startTime endTime} items{handle description price{__typename active currency ... on FlatRatePrice{amount} ... on TieredPrice{tiersMode tiers{upTo amountPerUnit amount}}} discount{amount percentage originalDiscountCycles remainingDiscountCycles discountEndsAt} usage{quantity cost{amount currencyCode}}} pendingUpdate{billingPeriod items{handle price{__typename ... on FlatRatePrice{amount}}} legacySubscriptionId} legacySubscriptionId}
  events(filter:{subjectId:$appId,shopId:$shopId,occurredAtMin:$occurredAtMin,eventTypes:[SUBSCRIPTION_CREATED,SUBSCRIPTION_UPDATED,SUBSCRIPTION_CANCELLATION_SCHEDULED,SUBSCRIPTION_CANCELED,SUBSCRIPTION_FROZEN,SUBSCRIPTION_UNFROZEN]},first:10,orderBy:OCCURRED_AT_DESC){edges{node{id occurredAt eventType ... on SubscriptionStatus{state cancelEffectiveOn plan{handle billingPeriod trialDays trialDaysRemaining} shop{id myshopifyDomain}}}}}
}`;

function clean(v){return String(v||"").trim();}
function intEnv(name,fallback,min=1,max=86400*30){const n=Number(process.env[name]);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;}
function isoDate(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
function serializeError(error){return String(error?.message||error||"Unknown Partner API error").replace(/\s+/g," ").slice(0,500);}
function newestLifecycle(edges=[]){return edges.map((e)=>e?.node).filter(Boolean).sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))[0]||null;}
function mapPlanHandle(handle){return resolveInternalPlanKeyFromHandle(handle);}
function planFromItems(items=[]){const matches=[];for(const item of items||[]){const key=mapPlanHandle(item?.handle);if(key&&!matches.includes(key))matches.push(key);}return matches.length===1?{key:matches[0],handle:normalizePricingHandle((items||[]).find(i=>mapPlanHandle(i?.handle)===matches[0])?.handle),ambiguous:false}:{key:null,handle:null,ambiguous:matches.length>1};}
function wait(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function retryAfterMs(response){const raw=response?.headers?.get?.("retry-after");if(!raw)return null;const seconds=Number(raw);if(Number.isFinite(seconds))return Math.max(0,Math.min(5000,Math.round(seconds*1000)));const date=new Date(raw);if(Number.isNaN(date.getTime()))return null;return Math.max(0,Math.min(5000,date.getTime()-Date.now()));}
function graphqlRetryable(errors=[]){return (errors||[]).some((error)=>RETRYABLE_GRAPHQL_CODES.has(String(error?.extensions?.code||"").toUpperCase())||/throttl|temporar|service unavailable|internal server/i.test(String(error?.message||"")));}
function statusFrom(active,event,now=new Date()){
  if(event?.state==="FROZEN")return "frozen";
  if(event?.state==="CANCELED"&&!active)return "canceled";
  if(event?.state==="CANCELLATION_SCHEDULED"){
    const effective=isoDate(event?.cancelEffectiveOn);
    if(!active&&effective&&effective.getTime()<=now.getTime())return "canceled";
    return "canceling";
  }
  if(active?.cancelAtEndOfCycle)return "canceling";
  const trialEnd=isoDate(active?.trialEndsAt);
  if(active&&trialEnd&&trialEnd.getTime()>now.getTime())return "trialing";
  if(active)return "active";
  return "inactive";
}

export function getShopifySubscriptionSyncConfig(){
  const organizationId=clean(process.env.SHOPIFY_PARTNER_ORGANIZATION_ID||process.env.SHOPIFY_PARTNER_ORG_ID);
  const accessToken=clean(process.env.SHOPIFY_PARTNER_API_TOKEN||process.env.SHOPIFY_PARTNER_ACCESS_TOKEN);
  const apiVersion=clean(process.env.SHOPIFY_PARTNER_API_VERSION||"2026-07");
  const issues=[];
  if(!ORG_RE.test(organizationId))issues.push("SHOPIFY_PARTNER_ORGANIZATION_ID is required and must be a valid Partner organization identifier.");
  if(!accessToken)issues.push("SHOPIFY_PARTNER_API_TOKEN is required for verified Shopify subscription sync.");
  if(!API_VERSION_RE.test(apiVersion))issues.push("SHOPIFY_PARTNER_API_VERSION must be 2026-07, 2026-10, or unstable.");
  return {configured:issues.length===0,organizationId,apiVersion,endpoint:issues.length?"":`https://partners.shopify.com/${encodeURIComponent(organizationId)}/api/${apiVersion}/graphql.json`,cacheTtlSeconds:intEnv("SHOPIFY_SUBSCRIPTION_CACHE_TTL_SECONDS",300,30,3600),maxStaleSeconds:intEnv("SHOPIFY_SUBSCRIPTION_MAX_STALE_SECONDS",86400,300,604800),timeoutMs:intEnv("SHOPIFY_PARTNER_API_TIMEOUT_MS",8000,1000,20000),retryCount:intEnv("SHOPIFY_PARTNER_API_RETRY_COUNT",2,0,3),retryBaseMs:intEnv("SHOPIFY_PARTNER_API_RETRY_BASE_MS",250,0,2000),issues};
}

export function getShopifySubscriptionSyncPublicConfig(){
  const config=getShopifySubscriptionSyncConfig();
  return {configured:config.configured,apiVersion:config.apiVersion,cacheTtlSeconds:config.cacheTtlSeconds,maxStaleSeconds:config.maxStaleSeconds,retryCount:config.retryCount,issues:config.issues};
}

export function isRetryablePartnerStatus(status){return RETRYABLE_HTTP.has(Number(status));}

export async function resolveShopifyBillingIdentity(admin, expectedShop){
  const response=await admin.graphql(`#graphql\nquery VsnBillingIdentity { currentAppInstallation { app { id } } shop { id myshopifyDomain } }`);
  const json=await response.json();
  if(json.errors?.length)throw new Error(`Admin identity lookup failed: ${json.errors.map(e=>e.message).join("; ")}`);
  const appId=clean(json.data?.currentAppInstallation?.app?.id),shopId=clean(json.data?.shop?.id),domain=normalizeShopDomain(json.data?.shop?.myshopifyDomain);
  if(!appId||!shopId)throw new Error("Shopify billing identity did not return app and shop IDs.");
  if(domain&&normalizeShopDomain(expectedShop)!==domain)throw new Error("Shopify billing identity shop did not match the authenticated session.");
  return {appId,shopId,shop:domain||normalizeShopDomain(expectedShop)};
}

async function partnerRequest({config,body,fetchImpl,sleepImpl}){
  let lastError=null;
  for(let attempt=0;attempt<=config.retryCount;attempt+=1){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),config.timeoutMs);
    let response;
    try{
      response=await fetchImpl(config.endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":clean(process.env.SHOPIFY_PARTNER_API_TOKEN||process.env.SHOPIFY_PARTNER_ACCESS_TOKEN)},body:JSON.stringify(body),signal:controller.signal});
    }catch(error){
      lastError=error;
      if(attempt>=config.retryCount)throw error;
      await sleepImpl(Math.min(5000,config.retryBaseMs*(2**attempt)));
      continue;
    }finally{clearTimeout(timer);}

    if(!response.ok){
      const error=new Error(`Partner API HTTP ${response.status}.`);
      if(!isRetryablePartnerStatus(response.status)||attempt>=config.retryCount)throw error;
      lastError=error;
      await sleepImpl(retryAfterMs(response)??Math.min(5000,config.retryBaseMs*(2**attempt)));
      continue;
    }

    let json;
    try{json=await response.json();}catch{throw new Error("Partner API returned an invalid JSON response.");}
    if(json.errors?.length){
      const error=new Error(`Partner API: ${json.errors.map(e=>e.message).join("; ")}`);
      if(!graphqlRetryable(json.errors)||attempt>=config.retryCount)throw error;
      lastError=error;
      await sleepImpl(Math.min(5000,config.retryBaseMs*(2**attempt)));
      continue;
    }
    return json;
  }
  throw lastError||new Error("Partner API request failed.");
}

export async function fetchShopifySubscriptionState({appId,shopId,expectedShop,fetchImpl=fetch,sleepImpl=wait,now=new Date()}){
  const config=getShopifySubscriptionSyncConfig();if(!config.configured)throw new Error(config.issues.join(" "));
  const occurredAtMin=new Date(now.getTime()-364*24*60*60*1000).toISOString();
  const json=await partnerRequest({config,body:{query:QUERY,variables:{appId,shopId,occurredAtMin}},fetchImpl,sleepImpl});
  const active=json.data?.activeSubscription||null,event=newestLifecycle(json.data?.events?.edges||[]);
  const activeDomain=normalizeShopDomain(active?.shop?.myshopifyDomain);const eventDomain=normalizeShopDomain(event?.shop?.myshopifyDomain);const expectedDomain=normalizeShopDomain(expectedShop);
  if((activeDomain&&activeDomain!==expectedDomain)||(eventDomain&&eventDomain!==expectedDomain))throw new Error("Partner API subscription shop did not match the authenticated store.");

  // Q5.5 authority rule: activeSubscription is the canonical current contract.
  // Historical events describe lifecycle state but never override an active plan item.
  const activePlan=planFromItems(active?.items||[]);const eventHandle=normalizePricingHandle(event?.plan?.handle);const eventKey=mapPlanHandle(eventHandle);
  const status=statusFrom(active,event,now);
  let planKey=active?activePlan.key:eventKey;
  let planHandle=active?activePlan.handle:eventHandle;
  if(["inactive","canceled","frozen"].includes(status)){planKey="core";planHandle=planHandle||eventHandle||null;}
  if(!planKey)planKey="core";

  const pending=planFromItems(active?.pendingUpdate?.items||[]);
  const pendingEvent=status==="canceling"&&event?.cancelEffectiveOn?{planKey:"core",planHandle:getShopifyPlanHandleMap().core,billingPeriod:null}:null;
  return {active,event,status,planKey,planHandle,billingPeriod:active?.billingPeriod||event?.plan?.billingPeriod||null,trialEndsAt:active?.trialEndsAt||null,currentCycleStart:active?.currentBillingCycle?.startTime||null,currentCycleEnd:active?.currentBillingCycle?.endTime||null,cancelAtEndOfCycle:Boolean(active?.cancelAtEndOfCycle||status==="canceling"),cancelEffectiveOn:event?.cancelEffectiveOn||null,pendingPlanKey:pendingEvent?.planKey||pending.key||null,pendingPlanHandle:pendingEvent?.planHandle||pending.handle||null,pendingBillingPeriod:active?.pendingUpdate?.billingPeriod||null,legacySubscriptionId:active?.legacySubscriptionId||null,verifiedShopId:active?.shop?.id||shopId,verifiedShop:activeDomain||eventDomain||expectedDomain,snapshot:json.data,diagnostics:{activePlanAmbiguous:Boolean(activePlan.ambiguous),pendingPlanAmbiguous:Boolean(pending.ambiguous),historicalPlanKey:eventKey||null,historicalPlanHandle:eventHandle||null}};
}

export function subscriptionMirrorIsFresh(row,now=new Date()){if(!row?.verifiedAt)return false;return now.getTime()-new Date(row.verifiedAt).getTime()<=getShopifySubscriptionSyncConfig().cacheTtlSeconds*1000;}
export function subscriptionMirrorMatchesCurrentPlanHandles(row){if(!row)return false;const status=String(row.status||"").toLowerCase();if(["inactive","canceled","frozen"].includes(status))return true;const mapped=resolveInternalPlanKeyFromHandle(row.planHandle);return Boolean(mapped&&mapped===String(row.planKey||"").toLowerCase());}
export function subscriptionMirrorIsTrusted(row,now=new Date()){if(!row?.verifiedAt||row?.provider!=="shopify-app-pricing")return false;return now.getTime()-new Date(row.verifiedAt).getTime()<=getShopifySubscriptionSyncConfig().maxStaleSeconds*1000;}

async function syncInner({db,admin,shop,force=false,fetchImpl=fetch,sleepImpl=wait,now=new Date()}){
  if(process.env.NODE_ENV!=="production"&&!/^(1|true|yes|on)$/i.test(clean(process.env.VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT)))return {ok:true,skipped:true,reason:"developer-mode"};
  const config=getShopifySubscriptionSyncConfig();if(!config.configured)return {ok:false,skipped:true,reason:"unconfigured",issues:config.issues};
  const existing=await db.builderSubscription.findUnique({where:{shop}}).catch(()=>null);
  if(!force&&subscriptionMirrorIsFresh(existing,now)&&subscriptionMirrorMatchesCurrentPlanHandles(existing))return {ok:true,skipped:true,reason:"fresh-cache",row:existing};
  try{
    const identity=await resolveShopifyBillingIdentity(admin,shop);
    const state=await fetchShopifySubscriptionState({...identity,expectedShop:shop,fetchImpl,sleepImpl,now});
    const data={planKey:state.planKey,status:state.status,provider:"shopify-app-pricing",planHandle:state.planHandle,billingPeriod:state.billingPeriod,cancelAtEndOfCycle:state.cancelAtEndOfCycle,cancelEffectiveOn:isoDate(state.cancelEffectiveOn),currentCycleStart:isoDate(state.currentCycleStart),currentCycleEnd:isoDate(state.currentCycleEnd),pendingPlanKey:state.pendingPlanKey,pendingPlanHandle:state.pendingPlanHandle,pendingBillingPeriod:state.pendingBillingPeriod,shopifyAppId:identity.appId,shopifyShopId:identity.shopId,legacySubscriptionId:state.legacySubscriptionId,verifiedAt:now,lastSyncAt:now,lastSyncError:null,lastSyncErrorAt:null,snapshotJson:JSON.stringify({data:state.snapshot,diagnostics:state.diagnostics}),trialEndsAt:isoDate(state.trialEndsAt)};
    const row=await db.builderSubscription.upsert({where:{shop},create:{shop,startedAt:now,...data},update:data});
    return {ok:true,verified:true,row,state};
  }catch(error){
    const message=serializeError(error);
    if(existing)await db.builderSubscription.update({where:{shop},data:{lastSyncAt:now,lastSyncError:message,lastSyncErrorAt:now}}).catch(()=>{});
    return {ok:false,error:message,row:existing||null};
  }
}

export async function syncShopifySubscription(args){const key=normalizeShopDomain(args.shop)||String(args.shop);if(syncLocks.has(key))return syncLocks.get(key);const task=syncInner(args).finally(()=>syncLocks.delete(key));syncLocks.set(key,task);return task;}
