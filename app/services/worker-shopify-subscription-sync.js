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
function errorChain(error){
  const queue=[error],seen=new Set(),chain=[];
  while(queue.length&&chain.length<8){
    const current=queue.shift();
    if(!current||typeof current!=="object"||seen.has(current))continue;
    seen.add(current);
    chain.push(current);
    for(const key of ["cause","originalError","error","response","body"])
      if(current[key]&&typeof current[key]==="object")queue.push(current[key]);
  }
  return chain;
}
function parseJson(value){
  if(typeof value!=="string"||value.length>65536)return null;
  try{return JSON.parse(value)}catch{return null}
}
async function responseJson(response){
  try{
    const reader=response.clone().body?.getReader();
    if(!reader)return null;
    const chunks=[];
    let size=0;
    while(size<=65536){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>65536){
        try{void reader.cancel().catch(()=>{})}catch{/* bounded diagnostic only */}
        return null;
      }
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    return parseJson(new TextDecoder().decode(bytes));
  }catch{return null}
}
async function gqlCode(error){
  const queue=[error],seen=new Set();
  let visited=0;
  while(queue.length&&visited<32){
    const current=queue.shift();
    if(!current||typeof current!=="object"||seen.has(current))continue;
    seen.add(current);visited++;
    if(current instanceof Response){
      const parsed=await responseJson(current);
      if(parsed)queue.push(parsed);
    }
    const body=parseJson(current.body)||current.body;
    if(body&&typeof body==="object"&&body!==current.body)queue.push(body);
    const code=String(current?.extensions?.code||"").toLowerCase().replace(/_/g,"-");
    if(/^[a-z0-9-]{1,20}$/.test(code))return code;
    for(const key of ["cause","originalError","error","response","body","errors",
      "graphQLErrors","graphqlErrors","extensions","data"]){
      let value;
      try{value=current[key]}catch{continue}
      if(Array.isArray(value))queue.push(...value.slice(0,16));
      else if(value&&typeof value==="object")queue.push(value);
      else if(key==="body"&&typeof value==="string"){
        const parsed=parseJson(value);
        if(parsed)queue.push(parsed);
      }
    }
    const errors=current?.body?.errors?.graphQLErrors||
      current?.body?.errors||current?.response?.errors||
      current?.errors?.graphQLErrors||current?.errors;
    const list=Array.isArray(errors)?errors:
      Array.isArray(errors?.graphQLErrors)?errors.graphQLErrors:[];
    for(const item of list){
      const candidate=String(item?.extensions?.code||"").toLowerCase().replace(/_/g,"-");
      if(/^[a-z0-9-]{1,20}$/.test(candidate))return candidate;
    }
  }
  return null;
}
function errorShape(error){
  const queue=[{value:error,label:"root"}],seen=new Set(),signatures=[];
  const nested=["cause","originalError","error","response","body","errors",
    "graphQLErrors","graphqlErrors","extensions"];
  let observedStatus=0;
  while(queue.length&&seen.size<8){
    const item=queue.shift();
    const current=item?.value;
    if(!current||typeof current!=="object"||seen.has(current))continue;
    seen.add(current);
    let type="object";
    try{
      type=current instanceof Response?"response":
        current?.name==="GraphqlQueryError"?"graphql":
        current?.constructor?.name==="ReadableStream"?"stream":"error";
    }catch{/* keep safe fallback */}
    const keys=Object.getOwnPropertyNames(current)
      .filter(key=>/^(cause|originalError|error|response|body|errors|graphQLErrors|graphqlErrors|extensions|code|name|status|statusCode)$/.test(key))
      .map(key=>key.toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,8))
      .slice(0,2);
    const status=Number(current?.status??current?.statusCode);
    if(Number.isInteger(status)&&status>=100&&status<=599)observedStatus=status;
    const label=item.label==="response"?"resp":item.label.slice(0,5);
    const compactType=type==="response"?"resp":type==="graphql"?"gql":type==="stream"?"stream":"error";
    signatures.push(label+"-"+compactType+(keys.length?"-"+keys.join("-"):""));
    for(const key of nested){
      let value;
      try{value=current[key]}catch{continue}
      if(Array.isArray(value)){
        for(const child of value.slice(0,2))queue.push({value:child,label:key.slice(0,6)});
      }else if(value&&typeof value==="object")queue.push({value,label:key.slice(0,6)});
    }
  }
  const terminal=signatures.at(-1)||"opaque";
  return (terminal+(observedStatus?"-s"+observedStatus:"")).slice(0,19).replace(/-+$/,"")||"opaque";
}
function httpStatus(error){
  for(const current of errorChain(error)){
    const status=Number(current?.status??current?.statusCode);
    if(Number.isInteger(status)&&status>=400&&status<=599)return status;
  }
  return 0;
}
async function graphql(admin,query,variables){
  const response=await admin.graphql(query,variables?{variables}:undefined);
  const json=await response.json();
  if(!response.ok)
    throw Object.assign(new Error("Shopify Admin identity query failed"),{status:Number(response.status)||0});
  if(json?.errors?.length)
    throw Object.assign(new Error("Shopify Admin identity query failed"),{
      name:"GraphqlQueryError",body:{errors:json.errors},
    });
  if(!json?.data)
    throw Object.assign(new Error("Shopify Admin identity query returned no data"),{
      name:"GraphqlQueryError",body:{errors:[]},
    });
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
    const graphqlErrorCode=await gqlCode(error);
    // Keep diagnostic metadata structural only. Never serialize error messages,
    // GraphQL payloads, tokens, request URLs, or merchant values.
    const status=httpStatus(error)||(error instanceof Response?Number(error.status)||0:0);
    const hasGraphqlError=errorChain(error).some(item=>item?.name==="GraphqlQueryError");
    // The legacy stage can come from this catch's fallback even when the SDK
    // exception itself has no code. Shape only that otherwise-opaque identity
    // failure; preserve explicit identity and downstream diagnostics.
    const legacyIdentityFallback=step==="admin-identity"&&!status&&!graphqlErrorCode&&!hasGraphqlError&&
      (!error?.code||error.code==="admin-identity-error");
    const shape=legacyIdentityFallback?errorShape(error):null;
    const stage=status?step+"-http-"+status:
      graphqlErrorCode?step+"-gql-"+graphqlErrorCode:
      hasGraphqlError?step+"-gql-error":
      shape?step+"-shape-"+shape:
      /^[a-z0-9-]{1,32}$/.test(String(error?.code||""))?error.code:
      step+"-"+(error?.name==="TimeoutError"?"timeout":
        error instanceof SyntaxError?"bad-json":
        error instanceof TypeError?"type-error":
        /^P\d{4}$/.test(String(error?.code||""))?error.code.toLowerCase():"error");
    return {ok:false,reason:"partner-verification-failed",stage,row:existing||null};
  }
}
