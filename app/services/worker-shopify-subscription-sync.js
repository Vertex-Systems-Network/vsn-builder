// Shopify App Pricing verification for the protected Staging Worker.
// Credentials and tier identity are passed through Cloudflare bindings; this
// module never reads process.env, logs Partner payloads, or trusts URL claims.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const ORG=/^[A-Za-z0-9_-]{1,120}$/;
const VERSION=/^2026-(07|10)$|^unstable$/;
// The allowlisted private $0 Shopify test plan exists only to validate the
// protected Staging billing flow. It is not a commercial entitlement tier.
const HANDLES=new Set(["starter","sliver","gold","platinum","shopify-test"]);
const CACHE_TTL_MS=5*60*1000;
const QUERY=`query VsnStagingSubscription($appId: ID!, $shopId: ID!, $occurredAtMin: DateTime!) {
  activeSubscription(appId:$appId,shopId:$shopId) {
    shop { id myshopifyDomain }
    billingPeriod cancelAtEndOfCycle trialEndsAt
    currentBillingCycle { startTime endTime }
    items { handle }
    pendingUpdate { billingPeriod items { handle } }
    legacySubscriptionId
  }
  events(filter:{subjectId:$appId,shopId:$shopId,occurredAtMin:$occurredAtMin,eventTypes:[SUBSCRIPTION_CREATED,SUBSCRIPTION_UPDATED,SUBSCRIPTION_CANCELLATION_SCHEDULED,SUBSCRIPTION_CANCELED,SUBSCRIPTION_FROZEN,SUBSCRIPTION_UNFROZEN]},first:10,orderBy:OCCURRED_AT_DESC) {
    edges { node { occurredAt eventType ... on SubscriptionStatus { state cancelEffectiveOn plan { handle billingPeriod trialDays trialDaysRemaining } shop { id myshopifyDomain } } } }
  }
}`;

const text=value=>String(value??"").trim();
const date=value=>{if(!value)return null;const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed:null;};
function newestEvent(edges){
  return (edges||[]).map(edge=>edge?.node).filter(Boolean)
    .sort((a,b)=>new Date(b.occurredAt||0)-new Date(a.occurredAt||0))[0]||null;
}
function planFromHandles(items){
  const matches=[...new Set((items||[]).map(item=>text(item?.handle).toLowerCase()).filter(handle=>HANDLES.has(handle)))];
  return matches.length===1?matches[0]:null;
}
function validConfig(env){
  const org=text(env?.SHOPIFY_PARTNER_ORGANIZATION_ID);
  const token=text(env?.SHOPIFY_PARTNER_API_TOKEN);
  const version=text(env?.SHOPIFY_PARTNER_API_VERSION||"2026-07");
  if(env?.APP_ENV!=="staging"||env?.VSN_WORKER_NAME!=="vsn-builder-staging"||
     env?.VSN_STAGING_BILLING_SYNC_ENABLED!=="true"||
     env?.SHOPIFY_BILLING_TEST_MODE!=="true"||
     !ORG.test(org)||!token||!VERSION.test(version))return null;
  return {org,token,version};
}
function identityValue(json,shop){
  const appId=text(json?.data?.currentAppInstallation?.app?.id);
  const shopId=text(json?.data?.shop?.id);
  const domain=text(json?.data?.shop?.myshopifyDomain).toLowerCase();
  if(json?.errors?.length||!appId||!shopId||domain!==shop)
    throw Object.assign(new Error("Partner billing identity could not be verified"),{code:"identity-mismatch"});
  return {appId,shopId};
}
// The Shopify SDK throws a Response for HTTP errors and a GraphqlQueryError
// carrying Shopify's fixed extensions.code (e.g. ACCESS_DENIED) for GraphQL
// errors. Only that short code is reported, never the message or payload.
function gqlCode(error){
  const errors=error?.body?.errors?.graphQLErrors||error?.body?.errors||error?.response?.errors;
  const list=Array.isArray(errors)?errors:Array.isArray(errors?.graphQLErrors)?errors.graphQLErrors:[];
  const code=String(list[0]?.extensions?.code||"").toLowerCase().replace(/_/g,"-");
  return /^[a-z0-9-]{1,20}$/.test(code)?code:null;
}
async function graphql(admin,query,variables){
  const response=await admin.graphql(query,variables?{variables}:undefined);
  const json=await response.json();
  if(!response.ok||json?.errors?.length||!json?.data)
    throw Object.assign(new Error("Shopify Admin identity query failed"),{code:"admin-identity-failed"});
  return json;
}
async function partnerState({config,appId,shopId,shop,fetchImpl,now}){
  const occurredAtMin=new Date(now.getTime()-364*24*60*60*1000).toISOString();
  const response=await fetchImpl(`https://partners.shopify.com/${encodeURIComponent(config.org)}/api/${config.version}/graphql.json`,{
    method:"POST",
    headers:{"content-type":"application/json","x-shopify-access-token":config.token},
    body:JSON.stringify({query:QUERY,variables:{appId,shopId,occurredAtMin}}),
    signal:AbortSignal.timeout(8000),
  });
  if(!response.ok)throw Object.assign(new Error("Shopify Partner API request failed"),
    {code:"partner-http-"+(Number(response.status)||0)});
  const json=await response.json();
  if(json?.errors?.length||!json?.data)
    throw Object.assign(new Error("Shopify Partner API query failed"),{code:"partner-graphql-error"});

  const active=json.data.activeSubscription||null;
  const event=newestEvent(json.data.events?.edges);
  const activeShop=text(active?.shop?.myshopifyDomain).toLowerCase();
  const eventShop=text(event?.shop?.myshopifyDomain).toLowerCase();
  const activeShopId=text(active?.shop?.id);
  const eventShopId=text(event?.shop?.id);
  if((activeShop&&activeShop!==shop)||(eventShop&&eventShop!==shop)||
     (activeShopId&&activeShopId!==shopId)||(eventShopId&&eventShopId!==shopId))
    throw Object.assign(new Error("Shopify Partner API returned a different store"),{code:"partner-store-mismatch"});

  const activePlan=active?planFromHandles(active.items):null;
  const eventHandle=text(event?.plan?.handle).toLowerCase();
  const eventPlan=HANDLES.has(eventHandle)?eventHandle:null;
  const trialEndsAt=date(active?.trialEndsAt);
  const cycleEnd=date(active?.currentBillingCycle?.endTime);
  const eventCutoff=date(event?.cancelEffectiveOn);
  const canceledState=String(event?.state||"").toUpperCase();
  let planKey=active?activePlan:eventPlan;
  let planHandle=active?activePlan:eventPlan;
  let status="inactive";
  let cancelEffectiveOn=null;
  if(active&&planKey){
    status=active.cancelAtEndOfCycle?"canceling":
      trialEndsAt&&trialEndsAt>now?"trialing":"active";
    cancelEffectiveOn=status==="canceling"?(eventCutoff||cycleEnd):null;
  }else if(!active&&eventPlan&&canceledState==="CANCELLATION_SCHEDULED"&&
      eventCutoff&&eventCutoff>now){
    status="canceling";
    cancelEffectiveOn=eventCutoff;
  }else if(canceledState==="FROZEN")status="frozen";
  else if(canceledState==="CANCELED")status="canceled";
  if(!planKey||!HANDLES.has(planKey)||!planHandle){
    planKey="inactive";
    planHandle=null;
    status=["frozen","canceled"].includes(status)?status:"inactive";
  }
  const pending=planFromHandles(active?.pendingUpdate?.items);
  return {
    planKey,planHandle,status,
    billingPeriod:active?.billingPeriod||event?.plan?.billingPeriod||null,
    cancelAtEndOfCycle:Boolean(active?.cancelAtEndOfCycle||status==="canceling"),
    cancelEffectiveOn,
    currentCycleStart:date(active?.currentBillingCycle?.startTime),
    currentCycleEnd:cycleEnd,
    pendingPlanKey:pending,
    pendingPlanHandle:pending,
    pendingBillingPeriod:active?.pendingUpdate?.billingPeriod||null,
    trialEndsAt:status==="trialing"?trialEndsAt:null,
    legacySubscriptionId:active?.legacySubscriptionId||null,
  };
}

export async function syncStagingShopifySubscription({
  database,admin,shop,env,now=new Date(),fetchImpl=fetch,force=false,
}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||
     !SHOP.test(text(shop).toLowerCase())||
     typeof database?.builderSubscription?.findUnique!=="function"||
     typeof database?.builderSubscription?.upsert!=="function"||
     typeof admin?.graphql!=="function")return {ok:false,reason:"invalid-input"};
  const normalizedShop=text(shop).toLowerCase();
  const config=validConfig(env);
  if(!config)return {ok:false,reason:"not-configured"};
  const existing=await database.builderSubscription.findUnique({where:{shop:normalizedShop}});
  const age=existing?.verifiedAt instanceof Date?now.getTime()-existing.verifiedAt.getTime():Infinity;
  if(!force&&existing?.provider==="shopify-app-pricing"&&age>=0&&age<CACHE_TTL_MS)
    return {ok:true,skipped:true,row:existing};
  let step="admin-identity";
  try{
    const identityJson=await graphql(admin,`#graphql
      query VsnStagingBillingIdentity {
        currentAppInstallation { app { id } }
        shop { id myshopifyDomain }
      }`);
    const {appId,shopId}=identityValue(identityJson,normalizedShop);
    step="partner";
    const state=await partnerState({config,appId,shopId,shop:normalizedShop,fetchImpl,now});
    const data={
      planKey:state.planKey,status:state.status,provider:"shopify-app-pricing",
      planHandle:state.planHandle,billingPeriod:state.billingPeriod,
      cancelAtEndOfCycle:state.cancelAtEndOfCycle,
      cancelEffectiveOn:state.cancelEffectiveOn,
      currentCycleStart:state.currentCycleStart,currentCycleEnd:state.currentCycleEnd,
      pendingPlanKey:state.pendingPlanKey,pendingPlanHandle:state.pendingPlanHandle,
      pendingBillingPeriod:state.pendingBillingPeriod,
      shopifyAppId:appId,shopifyShopId:shopId,
      legacySubscriptionId:state.legacySubscriptionId,
      verifiedAt:now,lastSyncAt:now,lastSyncError:null,lastSyncErrorAt:null,
      snapshotJson:JSON.stringify({source:"shopify-partner-api",verified:true}),
      trialEndsAt:state.trialEndsAt,
    };
    step="mirror-write";
    const row=await database.builderSubscription.upsert({
      where:{shop:normalizedShop},
      create:{shop:normalizedShop,startedAt:now,...data},
      update:data,
    });
    return {ok:true,verified:true,row};
  }catch(error){
    // Fixed, credential-free stage codes only; never the Partner payload.
    const stage=/^[a-z0-9-]{1,32}$/.test(String(error?.code||""))?error.code:
      step+"-"+(error instanceof Response?"http-"+(Number(error.status)||0):
        gqlCode(error)?"gql-"+gqlCode(error):
        error?.name==="TimeoutError"?"timeout":
        error instanceof SyntaxError?"bad-json":
        error instanceof TypeError?"type-error":
        /^P\d{4}$/.test(String(error?.code||""))?error.code.toLowerCase():"error");
    return {ok:false,reason:"partner-verification-failed",stage,row:existing||null};
  }
}
