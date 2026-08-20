function header(response,name){try{return response?.headers?.get?.(name)||null;}catch{return null;}}
function endpointName(value){try{const url=new URL(String(value||""));return `${url.hostname}${url.pathname}`.slice(0,500);}catch{return String(value||"").slice(0,500);}}

export async function recordStockApiUsage(db,{shop,provider,mediaKind="general",response=null,error=null,endpoint=""}={}){
  if(!db||!shop||!provider)return null;
  const status=Number(response?.status||0)||null;
  const success=Boolean(response?.ok&&!error);
  const data={
    requestCount:{increment:1}, successCount:{increment:success?1:0}, errorCount:{increment:success?0:1},
    lastStatus:status, providerLimit:header(response,"x-ratelimit-limit"), providerRemaining:header(response,"x-ratelimit-remaining"), providerReset:header(response,"x-ratelimit-reset"),
    lastEndpoint:endpointName(endpoint), lastUsedAt:new Date(),
  };
  return db.builderStockApiUsage.upsert({
    where:{shop_provider_mediaKind:{shop,provider,mediaKind}},
    create:{shop,provider,mediaKind,requestCount:1,successCount:success?1:0,errorCount:success?0:1,lastStatus:status,providerLimit:data.providerLimit,providerRemaining:data.providerRemaining,providerReset:data.providerReset,lastEndpoint:data.lastEndpoint,lastUsedAt:data.lastUsedAt},
    update:data,
  }).catch(()=>null);
}

export async function trackedStockFetch(db,{shop,provider,mediaKind="general",url,options}={}){
  let response;
  try{
    response=await fetch(url,options);
    await recordStockApiUsage(db,{shop,provider,mediaKind,response,endpoint:url});
    return response;
  }catch(error){
    await recordStockApiUsage(db,{shop,provider,mediaKind,error,endpoint:url});
    throw error;
  }
}

function serialize(row){return{provider:row.provider,mediaKind:row.mediaKind,requestCount:Number(row.requestCount||0),successCount:Number(row.successCount||0),errorCount:Number(row.errorCount||0),lastStatus:row.lastStatus,providerLimit:row.providerLimit,providerRemaining:row.providerRemaining,providerReset:row.providerReset,lastEndpoint:row.lastEndpoint,lastUsedAt:row.lastUsedAt?.toISOString?.()||null,updatedAt:row.updatedAt?.toISOString?.()||null};}

export async function loadStockApiUsageSummary(db,shop,{providers=null,mediaKinds=null}={}){
  const where={shop};if(Array.isArray(providers)&&providers.length)where.provider={in:providers};if(Array.isArray(mediaKinds)&&mediaKinds.length)where.mediaKind={in:mediaKinds};
  const rows=await db.builderStockApiUsage.findMany({where,orderBy:[{provider:"asc"},{mediaKind:"asc"}]});
  const items=rows.map(serialize),byProvider={};
  for(const item of items){const group=byProvider[item.provider]||{provider:item.provider,requestCount:0,successCount:0,errorCount:0,lastUsedAt:null,rateLimit:null,media:[]};group.requestCount+=item.requestCount;group.successCount+=item.successCount;group.errorCount+=item.errorCount;if(!group.lastUsedAt||String(item.lastUsedAt||"")>group.lastUsedAt)group.lastUsedAt=item.lastUsedAt;if(item.providerLimit||item.providerRemaining||item.providerReset)group.rateLimit={limit:item.providerLimit,remaining:item.providerRemaining,reset:item.providerReset};group.media.push(item);byProvider[item.provider]=group;}
  return{items,providers:byProvider,totalRequests:items.reduce((sum,row)=>sum+row.requestCount,0),generatedAt:new Date().toISOString()};
}
