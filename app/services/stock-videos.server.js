import crypto from "node:crypto";
import { loadStockProviderCredentials, STOCK_VIDEO_IMPORT_PROVIDERS, STOCK_VIDEO_PROVIDERS } from "./stock-image-integrations.server.js";
import { trackedStockFetch } from "./stock-api-usage.server.js";
import { searchGetty, searchShutterstock } from "./stock-premium-providers.server.js";
import { createShopifyMediaFile, createStagedMediaUpload, deleteShopifyMediaFile, downloadStockMedia, updateShopifyMediaFile } from "./stock-media-shopify.server.js";

const CACHE_TTL_MS = Object.freeze({ pexels: 300_000, pixabay: 86_400_000, shutterstock:300_000, getty:300_000 });
const PROVIDER_LABELS = Object.freeze({ pexels: "Pexels", pixabay: "Pixabay", shutterstock:"Shutterstock", getty:"Getty/iStock" });
const VIDEO_HOSTS = Object.freeze({ pexels: ["videos.pexels.com", "player.vimeo.com", "vod-progressive.akamaized.net"], pixabay: ["cdn.pixabay.com"] });
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
// VSN keeps an application-side transfer ceiling because staged uploads are assembled in memory.
const MAX_SERVER_IMPORT_BYTES = 200 * 1024 * 1024;
const MAX_SHOPIFY_DURATION_SECONDS = 600;
const MAX_SHOPIFY_DIMENSION = 4096;

function safeJson(raw, fallback = {}) { try { return JSON.parse(String(raw || "")); } catch { return fallback; } }
function int(value, fallback, min, max) { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function cacheKey(input) { return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex"); }
function rateMeta(response) { return { limit: response.headers.get("x-ratelimit-limit"), remaining: response.headers.get("x-ratelimit-remaining"), reset: response.headers.get("x-ratelimit-reset") }; }
function providerPage(provider, value) { try { const url = new URL(String(value || "")); const allowed = provider === "pexels" ? ["pexels.com"] : provider === "pixabay" ? ["pixabay.com"] : provider === "shutterstock" ? ["shutterstock.com"] : ["gettyimages.com","istockphoto.com"]; if (url.protocol !== "https:" || !allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return ""; return url.toString(); } catch { return ""; } }

function pexelsVideo(video) {
  const files = (video.video_files || []).filter((file) => file?.link && VIDEO_MIMES.has(String(file.file_type || "").toLowerCase())).map((file) => ({ id:String(file.id||""), quality:file.quality||"", mimeType:String(file.file_type||"video/mp4").toLowerCase(), width:Number(file.width||0), height:Number(file.height||0), fps:Number(file.fps||0), size:Number(file.file_size||0), url:file.link }));
  return { provider:"pexels", providerLabel:"Pexels", providerId:String(video.id), title:`Pexels video ${video.id}`, previewUrl:video.image||"", sourceUrl:providerPage("pexels", video.url), author:video.user?.name||"Pexels contributor", authorUrl:providerPage("pexels", video.user?.url), duration:Number(video.duration||0), width:Number(video.width||0), height:Number(video.height||0), files };
}
function pixabayVideo(video) {
  const files = Object.entries(video.videos || {}).map(([quality, file]) => ({ id:quality, quality, mimeType:"video/mp4", width:Number(file?.width||0), height:Number(file?.height||0), fps:0, size:Number(file?.size||0), url:file?.url||"", thumbnail:file?.thumbnail||"" })).filter((file)=>file.url);
  const preview = files.find((file)=>file.quality==="medium") || files.find((file)=>file.quality==="small") || files[0] || {};
  return { provider:"pixabay", providerLabel:"Pixabay", providerId:String(video.id), title:String(video.tags||`Pixabay video ${video.id}`).split(",")[0]?.trim()||`Pixabay video ${video.id}`, previewUrl:preview.thumbnail||"", sourceUrl:providerPage("pixabay", video.pageURL), author:video.user||"Pixabay contributor", authorUrl:providerPage("pixabay", video.user&&video.user_id?`https://pixabay.com/users/${encodeURIComponent(video.user)}-${video.user_id}/`:""), duration:Number(video.duration||0), width:Number(preview.width||0), height:Number(preview.height||0), files };
}

async function cached(db, shop, provider, key, loader) {
  const cacheProvider=`video:${provider}`, now=new Date();
  const found=await db.builderStockSearchCache.findUnique({where:{shop_provider_cacheKey:{shop,provider:cacheProvider,cacheKey:key}}}).catch(()=>null);
  if(found&&found.expiresAt>now)return {...safeJson(found.responseJson,{}),cached:true};
  const value=await loader(),expiresAt=new Date(Date.now()+CACHE_TTL_MS[provider]);
  await db.builderStockSearchCache.upsert({where:{shop_provider_cacheKey:{shop,provider:cacheProvider,cacheKey:key}},create:{shop,provider:cacheProvider,cacheKey:key,responseJson:JSON.stringify(value),expiresAt},update:{responseJson:JSON.stringify(value),expiresAt}}).catch(()=>null);
  return {...value,cached:false};
}

async function searchProvider(db, shop, provider, input) {
  if(provider==="shutterstock")return searchShutterstock(db,shop,"video",input);
  if(provider==="getty")return searchGetty(db,shop,"video",input);
  const auth=await loadStockProviderCredentials(db,shop,provider); if(!auth.enabled||!auth.apiKey)return{provider,results:[],total:0,skipped:true,reason:!auth.enabled?"disabled":"not-configured"};
  const page=int(input.page,1,1,1000),perPage=int(input.perPage,auth.config?.videoPageSize||18,3,provider==="pexels"?80:200),query=String(input.query||"").trim().slice(0,100);
  const normalized={query,page,perPage,orientation:String(input.orientation||"any"),size:String(input.size||"medium"),minDuration:int(input.minDuration,0,0,600),maxDuration:int(input.maxDuration,600,1,600),videoType:String(input.videoType||"all"),category:String(input.category||""),order:String(input.order||"popular"),safeSearch:input.safeSearch!==false,editorsChoice:input.editorsChoice===true,minWidth:int(input.minWidth,0,0,4096),minHeight:int(input.minHeight,0,0,4096)};
  return cached(db,shop,provider,cacheKey(normalized),async()=>{
    let response,payload;
    if(provider==="pexels"){
      const headers={Authorization:auth.apiKey,Accept:"application/json"};
      const params=new URLSearchParams({page:String(page),per_page:String(perPage)});
      if(normalized.minDuration)params.set("min_duration",String(normalized.minDuration)); if(normalized.maxDuration<600)params.set("max_duration",String(normalized.maxDuration));
      if(!query){if(normalized.minWidth)params.set("min_width",String(normalized.minWidth));if(normalized.minHeight)params.set("min_height",String(normalized.minHeight));}
      if(query){params.set("query",query); if(normalized.orientation!=="any")params.set("orientation",normalized.orientation); if(["large","medium","small"].includes(normalized.size))params.set("size",normalized.size); const locale=String(auth.config.locale||""); if(locale)params.set("locale",locale);}
      const endpoint=query?"search":"popular";
      response=await trackedStockFetch(db,{shop,provider:"pexels",mediaKind:"video",url:`https://api.pexels.com/v1/videos/${endpoint}?${params}`,options:{headers,signal:AbortSignal.timeout?.(12000)}}); payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(`Pexels video search failed (${response.status}): ${payload?.error||"API error"}`);
      return{provider,results:(payload.videos||[]).map(pexelsVideo),total:Number(payload.total_results||0),totalPages:Math.max(1,Math.ceil(Number(payload.total_results||0)/perPage)),rateLimit:rateMeta(response)};
    }
    const params=new URLSearchParams({key:auth.apiKey,q:query,page:String(page),per_page:String(perPage),video_type:["all","film","animation"].includes(normalized.videoType)?normalized.videoType:"all",safesearch:String(normalized.safeSearch),editors_choice:String(normalized.editorsChoice),order:["popular","latest"].includes(normalized.order)?normalized.order:"popular",lang:String(auth.config.lang||"en")});
    if(normalized.category)params.set("category",normalized.category); if(normalized.minWidth)params.set("min_width",String(normalized.minWidth)); if(normalized.minHeight)params.set("min_height",String(normalized.minHeight));
    response=await trackedStockFetch(db,{shop,provider:"pixabay",mediaKind:"video",url:`https://pixabay.com/api/videos/?${params}`,options:{headers:{Accept:"application/json"},signal:AbortSignal.timeout?.(12000)}}); payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`Pixabay video search failed (${response.status}).`);
    return{provider,results:(payload.hits||[]).map(pixabayVideo),total:Number(payload.totalHits||payload.total||0),totalPages:Math.max(1,Math.ceil(Number(payload.totalHits||0)/perPage)),rateLimit:rateMeta(response)};
  });
}

function roundRobin(groups,limit){const lists=groups.map((row)=>[...(row.results||[])]),out=[];while(out.length<limit&&lists.some((list)=>list.length))for(const list of lists){if(out.length>=limit)break;if(list.length)out.push(list.shift());}return out;}
export async function searchStockVideos(db,shop,input={}){
  await db.builderStockSearchCache.deleteMany({where:{shop,expiresAt:{lt:new Date()}}}).catch(()=>null);
  const provider=STOCK_VIDEO_PROVIDERS.includes(String(input.provider))?String(input.provider):"all",page=int(input.page,1,1,1000),perPage=int(input.perPage,18,3,100),providers=provider==="all"?STOCK_VIDEO_PROVIDERS:[provider],share=provider==="all"?Math.max(3,Math.ceil(perPage/providers.length)):perPage;
  const settled=await Promise.all(providers.map(async(name)=>{try{return await searchProvider(db,shop,name,{...input,page,perPage:share});}catch(error){return{provider:name,results:[],total:0,error:error instanceof Error?error.message:String(error)};}}));
  return{query:String(input.query||""),provider,page,perPage,results:provider==="all"?roundRobin(settled,perPage):(settled[0]?.results||[]),sourceStates:Object.fromEntries(settled.map((row)=>[row.provider,{total:row.total||0,totalPages:row.totalPages||1,error:row.error||null,skipped:row.skipped||false,reason:row.reason||null,cached:row.cached===true,rateLimit:row.rateLimit||null}])),hasMore:settled.some((row)=>page<Number(row.totalPages||1))};
}

function safeRendition(files=[],quality="auto"){
  const valid=files.filter((file)=>file.url&&file.width>=100&&file.height>=100&&file.width<=MAX_SHOPIFY_DIMENSION&&file.height<=MAX_SHOPIFY_DIMENSION&&(!file.fps||file.fps<=120)&&(!file.size||file.size<=MAX_SERVER_IMPORT_BYTES));
  if(!valid.length)throw new Error("No Shopify-safe video rendition is available for this stock video.");
  const target=quality==="4k"?2160:quality==="1080p"?1080:quality==="720p"?720:1080;
  return valid.sort((a,b)=>{const ad=Math.abs(Math.max(a.width,a.height)-target),bd=Math.abs(Math.max(b.width,b.height)-target);if(ad!==bd)return ad-bd;return (b.size||0)-(a.size||0);})[0];
}

async function providerVideo(db,shop,provider,id,quality="auto"){
  if(!STOCK_VIDEO_IMPORT_PROVIDERS.includes(provider))throw new Error(`${PROVIDER_LABELS[provider]||provider} search is available, but licensed final-download import is not enabled.`);
  const auth=await loadStockProviderCredentials(db,shop,provider);if(!auth.enabled||!auth.apiKey)throw new Error(`${PROVIDER_LABELS[provider]} API is not configured.`);let response,payload,result;
  if(provider==="pexels"){
    response=await trackedStockFetch(db,{shop,provider:"pexels",mediaKind:"video",url:`https://api.pexels.com/v1/videos/videos/${encodeURIComponent(id)}`,options:{headers:{Authorization:auth.apiKey,Accept:"application/json"},signal:AbortSignal.timeout?.(12000)}});payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Pexels video lookup failed (${response.status}).`);result=pexelsVideo(payload);
  }else{
    response=await trackedStockFetch(db,{shop,provider:"pixabay",mediaKind:"video",url:`https://pixabay.com/api/videos/?key=${encodeURIComponent(auth.apiKey)}&id=${encodeURIComponent(id)}`,options:{headers:{Accept:"application/json"},signal:AbortSignal.timeout?.(12000)}});payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Pixabay video lookup failed (${response.status}).`);const video=payload.hits?.[0];if(!video)throw new Error("Pixabay video no longer exists.");result=pixabayVideo(video);
  }
  if(result.duration<0.25||result.duration>MAX_SHOPIFY_DURATION_SECONDS)throw new Error("Video duration is outside Shopify's supported 0.25 second to 10 minute range.");
  const rendition=safeRendition(result.files,quality);return{result:{...result,selectedRendition:{...rendition,url:undefined}},downloadUrl:rendition.url,expectedSize:rendition.size||0};
}

function mediaKey(provider,id){return`stock-video:${provider}:${id}`;}
function serialize(row){const data=safeJson(row.contentJson,{});return{id:row.id,provider:data.provider||row.source?.replace(/^stock-video:/,"")||"",providerId:data.providerId||"",title:row.title,thumbnail:row.thumbnail||data.previewUrl||"",isFavorite:row.isFavorite===true,imported:Boolean(data.shopifyFileId),shopifyFileId:data.shopifyFileId||"",shopifyUrl:data.shopifyUrl||"",fileStatus:data.fileStatus||"",author:data.author||"",sourceUrl:data.sourceUrl||"",updatedAt:row.updatedAt?.toISOString?.()||null,data};}
async function find(db,shop,provider,id){return db.builderLibraryItem.findFirst({where:{shop,kind:"stock-video",sourceKey:mediaKey(provider,id),deletedAt:null}});}
export async function listStockVideoLibrary(db,shop){const rows=await db.builderLibraryItem.findMany({where:{shop,kind:"stock-video",deletedAt:null},orderBy:[{isFavorite:"desc"},{updatedAt:"desc"}],take:300});const items=rows.map(serialize);return{favorites:items.filter((r)=>r.isFavorite),imports:items.filter((r)=>r.imported)};}
export async function toggleStockVideoFavorite(db,shop,provider,id,favorite,metadata={}){if(!STOCK_VIDEO_PROVIDERS.includes(provider))throw new Error("Unknown stock video provider.");const existing=await find(db,shop,provider,id);const clean={provider,providerId:id,title:String(metadata.title||"Stock video").slice(0,180),previewUrl:String(metadata.previewUrl||"").slice(0,1200),author:String(metadata.author||"").slice(0,180),sourceUrl:providerPage(provider,metadata.sourceUrl||""),duration:Number(metadata.duration||0),importAllowed:metadata.importAllowed!==false,licenseRequired:metadata.licenseRequired===true,licenseMessage:String(metadata.licenseMessage||"").slice(0,400)};if(existing){const current=safeJson(existing.contentJson,{});return serialize(await db.builderLibraryItem.update({where:{id:existing.id},data:{isFavorite:favorite===true,title:clean.title||existing.title,thumbnail:clean.previewUrl||existing.thumbnail,contentJson:JSON.stringify({...current,...clean})}}));}if(!favorite)return null;return serialize(await db.builderLibraryItem.create({data:{shop,title:clean.title,kind:"stock-video",category:"Stock Videos",syncMode:"local",contentJson:JSON.stringify(clean),thumbnail:clean.previewUrl||null,isFavorite:true,sourceKey:mediaKey(provider,id),source:`stock-video:${provider}`,description:`${PROVIDER_LABELS[provider]} stock video reference`}}));}

function filename(result,mime){const ext=mime==="video/webm"?"webm":mime==="video/quicktime"?"mov":"mp4",slug=String(result.title||"stock-video").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"video";return`${result.provider}-${result.providerId}-${slug}.${ext}`;}
export async function importStockVideo({db,admin,shop,provider,providerId,actor=null,update=false,quality="auto"}){if(!STOCK_VIDEO_IMPORT_PROVIDERS.includes(provider))throw new Error(`${PROVIDER_LABELS[provider]||provider} requires a licensed final-download workflow before Shopify import.`);const{result,downloadUrl}=await providerVideo(db,shop,provider,providerId,quality);const downloaded=await downloadStockMedia({url:downloadUrl,allowedHosts:VIDEO_HOSTS[provider],allowedMimeTypes:VIDEO_MIMES,maxBytes:MAX_SERVER_IMPORT_BYTES,label:"stock video",timeoutMs:90_000});const fileName=filename(result,downloaded.contentType),stagedUrl=await createStagedMediaUpload(admin,{filename:fileName,contentType:downloaded.contentType,bytes:downloaded.bytes,resource:"VIDEO"});const existing=await find(db,shop,provider,providerId),current=safeJson(existing?.contentJson,{});let file;if(update){if(!existing||!current.shopifyFileId)throw new Error("Import this video before updating it.");file=await updateShopifyMediaFile(admin,{fileId:current.shopifyFileId,stagedUrl,filename:fileName,alt:result.title});}else file=await createShopifyMediaFile(admin,{stagedUrl,filename:fileName,alt:result.title,contentType:"VIDEO"});const content={...current,...result,shopifyFileId:file.id,shopifyUrl:file.url||current.shopifyUrl||"",fileStatus:file.fileStatus,filename:fileName,importedAt:new Date().toISOString()};const data={title:result.title,kind:"stock-video",category:"Stock Videos",syncMode:"local",contentJson:JSON.stringify(content),thumbnail:file.previewUrl||result.previewUrl||existing?.thumbnail||null,sourceKey:mediaKey(provider,providerId),source:`stock-video:${provider}`,createdBy:actor};return serialize(existing?await db.builderLibraryItem.update({where:{id:existing.id},data}):await db.builderLibraryItem.create({data:{shop,isFavorite:false,...data}}));}
export async function deleteImportedStockVideo({db,admin,shop,provider,providerId}){const existing=await find(db,shop,provider,providerId);if(!existing)throw new Error("Stock video record was not found.");const content=safeJson(existing.contentJson,{});if(!content.shopifyFileId)throw new Error("This video is not imported to Shopify Files.");await deleteShopifyMediaFile(admin,content.shopifyFileId);const next={...content,shopifyFileId:"",shopifyUrl:"",fileStatus:"DELETED",deletedFromShopifyAt:new Date().toISOString()};if(!existing.isFavorite){await db.builderLibraryItem.update({where:{id:existing.id},data:{deletedAt:new Date(),contentJson:JSON.stringify(next)}});return null;}return serialize(await db.builderLibraryItem.update({where:{id:existing.id},data:{contentJson:JSON.stringify(next)}}));}
