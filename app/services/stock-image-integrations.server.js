import { decryptSecret, encryptSecret, maskSecret } from "./secret-vault.server.js";
import { trackedStockFetch } from "./stock-api-usage.server.js";
import {
  STOCK_AUDIO_IMPORT_PROVIDERS, STOCK_AUDIO_PROVIDERS, STOCK_IMAGE_IMPORT_PROVIDERS, STOCK_IMAGE_PROVIDERS,
  STOCK_PROVIDER_NAMES, STOCK_PROVIDERS, STOCK_VIDEO_IMPORT_PROVIDERS, STOCK_VIDEO_PROVIDERS,
} from "../config/stock-media.js";

export {
  STOCK_AUDIO_IMPORT_PROVIDERS, STOCK_AUDIO_PROVIDERS, STOCK_IMAGE_IMPORT_PROVIDERS, STOCK_IMAGE_PROVIDERS,
  STOCK_PROVIDERS, STOCK_VIDEO_IMPORT_PROVIDERS, STOCK_VIDEO_PROVIDERS,
} from "../config/stock-media.js";

const PROVIDER_NAMES = STOCK_PROVIDER_NAMES;
const ENV_KEYS = Object.freeze({ unsplash: "UNSPLASH_ACCESS_KEY", pexels: "PEXELS_API_KEY", pixabay: "PIXABAY_API_KEY", freesound: "FREESOUND_API_KEY", getty: "GETTY_API_KEY" });
const UNSPLASH_SECRET_ENV = "UNSPLASH_SECRET_KEY";

const DEFAULT_CONFIG = Object.freeze({
  unsplash: { enabled: true, orderBy: "relevant", contentFilter: "high", imagePageSize: 24 },
  pexels: { enabled: true, size: "large", locale: "en-US", imagePageSize: 24, videoPageSize: 18 },
  pixabay: { enabled: true, imageType: "photo", safeSearch: true, editorsChoice: false, order: "popular", lang: "en", imagePageSize: 24, videoPageSize: 18 },
  freesound: { enabled: false, audioPageSize: 24, pageSize: 24, sort: "score", commercialOnly: true, commercialApiLicensed: false },
  shutterstock: { enabled: false, imagePageSize: 24, videoPageSize: 18, audioPageSize: 24, sort: "popular" },
  getty: { enabled: false, imagePageSize: 24, videoPageSize: 18, locale: "en-US" },
});

function parseObject(raw, fallback = {}) { try { const value = JSON.parse(String(raw || "{}")); return value && typeof value === "object" && !Array.isArray(value) ? value : fallback; } catch { return fallback; } }
function pageSize(value,fallback,max=100){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(1,Math.min(max,n)):fallback;}
function providerConfig(provider, input = {}) {
  const base = DEFAULT_CONFIG[provider] || {}, source = input && typeof input === "object" ? input : {};
  if (provider === "unsplash") return { enabled: source.enabled !== false, orderBy: ["relevant", "latest"].includes(source.orderBy) ? source.orderBy : base.orderBy, contentFilter: ["low", "high"].includes(source.contentFilter) ? source.contentFilter : base.contentFilter, imagePageSize:pageSize(source.imagePageSize,base.imagePageSize,30) };
  if (provider === "pexels") return { enabled: source.enabled !== false, size: ["large", "medium", "small"].includes(source.size) ? source.size : base.size, locale: String(source.locale || base.locale).slice(0, 12), imagePageSize:pageSize(source.imagePageSize,base.imagePageSize,80), videoPageSize:pageSize(source.videoPageSize,base.videoPageSize,80) };
  if (provider === "pixabay") return { enabled: source.enabled !== false, imageType: ["all", "photo", "illustration", "vector"].includes(source.imageType) ? source.imageType : base.imageType, safeSearch: source.safeSearch !== false, editorsChoice: source.editorsChoice === true, order: ["popular", "latest"].includes(source.order) ? source.order : base.order, lang: String(source.lang || base.lang).slice(0, 5), imagePageSize:pageSize(source.imagePageSize,base.imagePageSize,200), videoPageSize:pageSize(source.videoPageSize,base.videoPageSize,200) };
  if (provider === "freesound") { const audio=pageSize(source.audioPageSize ?? source.pageSize,base.audioPageSize,100); return { enabled: source.enabled === true, audioPageSize:audio, pageSize:audio, sort: ["score", "duration_asc", "duration_desc", "created_desc", "downloads_desc", "rating_desc"].includes(source.sort) ? source.sort : base.sort, commercialOnly: source.commercialOnly !== false, commercialApiLicensed: source.commercialApiLicensed === true }; }
  if (provider === "shutterstock") return { enabled: source.enabled === true, imagePageSize:pageSize(source.imagePageSize,base.imagePageSize,100), videoPageSize:pageSize(source.videoPageSize,base.videoPageSize,100), audioPageSize:pageSize(source.audioPageSize,base.audioPageSize,100), sort:["popular","newest","relevance","random"].includes(source.sort)?source.sort:base.sort };
  return { enabled: source.enabled === true, imagePageSize:pageSize(source.imagePageSize,base.imagePageSize,100), videoPageSize:pageSize(source.videoPageSize,base.videoPageSize,100), locale:String(source.locale||base.locale).slice(0,12) };
}

async function findProviderRow(db, shop, provider) { return db.builderIntegration.findFirst({ where: { shop, provider: `stock:${provider}` }, orderBy: { updatedAt: "desc" } }).catch(() => null); }
function decode(shop,value){if(!value)return"";try{return decryptSecret(shop,value);}catch{return"";}}

export async function loadStockProviderCredentials(db, shop, provider) {
  if (!STOCK_PROVIDERS.includes(provider)) throw new Error("Unknown stock media provider.");
  const row = await findProviderRow(db, shop, provider), config = providerConfig(provider, parseObject(row?.configJson, DEFAULT_CONFIG[provider])), secretObj = parseObject(row?.secretJson, {});
  const result={provider,name:PROVIDER_NAMES[provider],config,updatedAt:row?.updatedAt||null};
  if(provider==="unsplash"){
    let accessKey=decode(shop,secretObj.accessKey||secretObj.apiKey)||String(process.env.UNSPLASH_ACCESS_KEY||"").trim(),secretKey=decode(shop,secretObj.secretKey)||String(process.env[UNSPLASH_SECRET_ENV]||"").trim();
    Object.assign(result,{apiKey:accessKey,accessKey,secretKey,configured:Boolean(accessKey),secretConfigured:Boolean(secretKey),source:secretObj.accessKey||secretObj.apiKey?"store":accessKey?"environment":"none",secretSource:secretObj.secretKey?"store":secretKey?"environment":"none"});
  }else if(provider==="shutterstock"){
    const consumerKey=decode(shop,secretObj.consumerKey)||String(process.env.SHUTTERSTOCK_CONSUMER_KEY||"").trim(),consumerSecret=decode(shop,secretObj.consumerSecret)||String(process.env.SHUTTERSTOCK_CONSUMER_SECRET||"").trim(),oauthToken=decode(shop,secretObj.oauthToken)||String(process.env.SHUTTERSTOCK_API_TOKEN||"").trim();
    Object.assign(result,{consumerKey,consumerSecret,oauthToken,apiKey:consumerKey,configured:Boolean(oauthToken||(consumerKey&&consumerSecret)),source:secretObj.consumerKey||secretObj.oauthToken?"store":(oauthToken||consumerKey)?"environment":"none"});
  }else if(provider==="getty"){
    const apiKey=decode(shop,secretObj.apiKey)||String(process.env.GETTY_API_KEY||"").trim(),apiSecret=decode(shop,secretObj.apiSecret)||String(process.env.GETTY_API_SECRET||"").trim();
    Object.assign(result,{apiKey,apiSecret,configured:Boolean(apiKey),secretConfigured:Boolean(apiSecret),source:secretObj.apiKey?"store":apiKey?"environment":"none",secretSource:secretObj.apiSecret?"store":apiSecret?"environment":"none"});
  }else{
    const apiKey=decode(shop,secretObj.apiKey)||String(process.env[ENV_KEYS[provider]]||"").trim();Object.assign(result,{apiKey,configured:Boolean(apiKey),source:secretObj.apiKey?"store":apiKey?"environment":"none"});
  }
  result.enabled=row?row.enabled!==false&&config.enabled!==false:config.enabled!==false;
  return result;
}

function publicProviderSettings(row) {
  const base={provider:row.provider,name:row.name,enabled:row.enabled,configured:row.configured,maskedKey:row.configured?maskSecret(row.apiKey||row.consumerKey||row.oauthToken):"",config:row.config,source:row.source,updatedAt:row.updatedAt?.toISOString?.()||null};
  if(row.provider==="unsplash")return{...base,maskedAccessKey:row.configured?maskSecret(row.accessKey):"",secretConfigured:row.secretConfigured===true,maskedSecretKey:row.secretConfigured?maskSecret(row.secretKey):"",secretSource:row.secretSource};
  if(row.provider==="shutterstock")return{...base,consumerKeyConfigured:Boolean(row.consumerKey),consumerSecretConfigured:Boolean(row.consumerSecret),oauthTokenConfigured:Boolean(row.oauthToken),maskedConsumerKey:row.consumerKey?maskSecret(row.consumerKey):"",maskedConsumerSecret:row.consumerSecret?maskSecret(row.consumerSecret):"",maskedOauthToken:row.oauthToken?maskSecret(row.oauthToken):""};
  if(row.provider==="getty")return{...base,secretConfigured:Boolean(row.apiSecret),maskedApiSecret:row.apiSecret?maskSecret(row.apiSecret):"",secretSource:row.secretSource};
  return base;
}
export async function loadStockProviderPublicSettings(db, shop) { const rows=await Promise.all(STOCK_PROVIDERS.map((provider)=>loadStockProviderCredentials(db,shop,provider)));return Object.fromEntries(rows.map((row)=>[row.provider,publicProviderSettings(row)])); }

export async function saveStockProviderSettings(db, shop, input = {}) {
  const result={};
  for(const provider of STOCK_PROVIDERS){
    const incoming=input?.[provider]&&typeof input[provider]==="object"?input[provider]:{},credentials=incoming.credentials&&typeof incoming.credentials==="object"?incoming.credentials:{},existing=await findProviderRow(db,shop,provider),nextSecrets={...parseObject(existing?.secretJson,{})};
    if(provider==="unsplash"){const a=String(credentials.accessKey??incoming.accessKey??incoming.apiKey??"").trim(),s=String(credentials.secretKey??incoming.secretKey??"").trim();if(a)nextSecrets.accessKey=encryptSecret(shop,a);if(s)nextSecrets.secretKey=encryptSecret(shop,s);}
    else if(provider==="shutterstock"){for(const key of ["consumerKey","consumerSecret","oauthToken"]){const v=String(credentials[key]??incoming[key]??"").trim();if(v)nextSecrets[key]=encryptSecret(shop,v);}}
    else if(provider==="getty"){const k=String(credentials.apiKey??incoming.apiKey??"").trim(),s=String(credentials.apiSecret??incoming.apiSecret??"").trim();if(k)nextSecrets.apiKey=encryptSecret(shop,k);if(s)nextSecrets.apiSecret=encryptSecret(shop,s);}
    else{const k=String(credentials.apiKey??incoming.apiKey??"").trim();if(k)nextSecrets.apiKey=encryptSecret(shop,k);}
    const config=providerConfig(provider,incoming.config||incoming),data={name:`${PROVIDER_NAMES[provider]} Stock Media`,formKey:"stock-media",enabled:incoming.enabled!==false,configJson:JSON.stringify({...config,enabled:incoming.enabled!==false}),secretJson:JSON.stringify(nextSecrets)};
    if(existing)await db.builderIntegration.update({where:{id:existing.id},data});else await db.builderIntegration.create({data:{shop,provider:`stock:${provider}`,...data}});
    result[provider]=await loadStockProviderCredentials(db,shop,provider);
  }
  return Object.fromEntries(Object.entries(result).map(([provider,row])=>[provider,publicProviderSettings(row)]));
}

function shutterstockHeaders(row){if(row.oauthToken)return{Authorization:`Bearer ${row.oauthToken}`,Accept:"application/json","User-Agent":"VSN-Builder"};const encoded=Buffer.from(`${row.consumerKey||""}:${row.consumerSecret||""}`).toString("base64");return{Authorization:`Basic ${encoded}`,Accept:"application/json","User-Agent":"VSN-Builder"};}
export async function testStockProviderCredential(db, shop, provider) {
  const row=await loadStockProviderCredentials(db,shop,provider);if(!row.enabled)return{ok:false,provider,error:`${row.name} is disabled.`};if(provider==="freesound"&&row.config?.commercialApiLicensed!==true)return{ok:false,provider,error:"Freesound commercial API permission/license must be confirmed before this Shopify integration can be tested or used."};if(!row.configured)return{ok:false,provider,error:provider==="unsplash"?`${row.name} Access Key is not configured.`:`${row.name} API credentials are not configured.`};
  let url,headers={Accept:"application/json"};
  if(provider==="unsplash"){url="https://api.unsplash.com/photos?per_page=1";headers.Authorization=`Client-ID ${row.apiKey}`;headers["Accept-Version"]="v1";}
  else if(provider==="pexels"){url="https://api.pexels.com/v1/curated?per_page=1";headers.Authorization=row.apiKey;}
  else if(provider==="pixabay")url=`https://pixabay.com/api/?key=${encodeURIComponent(row.apiKey)}&per_page=3&safesearch=true`;
  else if(provider==="freesound"){url="https://freesound.org/apiv2/search/?query=click&page_size=1&fields=id,name,license";headers.Authorization=`Token ${row.apiKey}`;}
  else if(provider==="shutterstock"){url="https://api.shutterstock.com/v2/images/search?query=business&per_page=1";headers=shutterstockHeaders(row);}
  else{url="https://api.gettyimages.com/v3/search/images/creative?phrase=business&page_size=1";headers={"Api-Key":row.apiKey,Accept:"application/json"};}
  const response=await trackedStockFetch(db,{shop,provider,mediaKind:"test",url,options:{headers,signal:AbortSignal.timeout?.(10000)}});if(!response.ok)return{ok:false,provider,status:response.status,error:`${row.name} returned HTTP ${response.status}.`};return{ok:true,provider,status:response.status,rateLimit:{limit:response.headers.get("x-ratelimit-limit"),remaining:response.headers.get("x-ratelimit-remaining"),reset:response.headers.get("x-ratelimit-reset")}};
}
