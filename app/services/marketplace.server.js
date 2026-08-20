import crypto from "node:crypto";
import { BUILTIN_MARKETPLACE_CATALOG, MARKETPLACE_INDUSTRIES, MARKETPLACE_LAYOUTS, MARKETPLACE_STYLES } from "../data/marketplaceCatalog.js";
import { getDefaultMarketplaceCatalogItems } from "./library-presets.server.js";
import { VSN_BASELINE } from "../config/baseline.js";

const REMOTE_TIMEOUT_MS = 3500;
function parseJson(value, fallback) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }
function clone(value) { return structuredClone(value); }
function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function semverParts(value) { return String(value || "0").split(".").map((part) => Number(part.replace(/\D.*$/, "")) || 0).slice(0, 3); }
function versionGte(a, b) { const aa=semverParts(a), bb=semverParts(b); for(let i=0;i<3;i++){if((aa[i]||0)>(bb[i]||0))return true;if((aa[i]||0)<(bb[i]||0))return false;} return true; }

export function isCatalogItemCompatible(item, currentVersion = VSN_BASELINE.version) {
  const min = item?.compatibility?.minBuilderVersion || "0.0.0";
  return versionGte(currentVersion, min);
}

function normalizeRemoteItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const catalogId=String(raw.catalogId||raw.id||"").trim();
  const kind=raw.kind === "section" ? "section" : raw.kind === "page" ? "page" : "";
  if(!catalogId||!kind||!raw.title||raw.content==null)return null;
  return {
    catalogId, id: catalogId, version: Math.max(1, Number(raw.version||1)), title:String(raw.title), kind, templateType:kind==="page"?String(raw.templateType||"page"):null,
    category:String(raw.category|| (kind==="page"?"Page Templates":"Sections")), industry:String(raw.industry||"general"), industryLabel:String(raw.industryLabel||raw.industry||"General"),
    style:String(raw.style||"modern"), layout:String(raw.layout||"centered"), planTier:raw.planTier==="pro"?"pro":"free",
    colorTags:Array.isArray(raw.colorTags)?raw.colorTags.map(String).slice(0,8):[], previewImage:typeof raw.previewImage==="string"?raw.previewImage:null,
    description:String(raw.description||"Remote VSN marketplace template."), qualityScore:Math.max(0,Math.min(100,Number(raw.qualityScore||80))),
    compatibility:raw.compatibility&&typeof raw.compatibility==="object"?raw.compatibility:{minBuilderVersion:"2.5.48",schemaVersion:1}, screenshot:raw.screenshot&&typeof raw.screenshot==="object"?raw.screenshot:{},
    source:"remote", content:clone(raw.content),
  };
}

async function fetchRemoteCatalog() {
  const url=String(process.env.VSN_TEMPLATE_CATALOG_URL||"").trim();
  if(!url)return { items:[], status:"not-configured", urlConfigured:false };
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),REMOTE_TIMEOUT_MS);
  try {
    const response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});
    if(!response.ok)throw new Error(`Remote catalog returned HTTP ${response.status}`);
    const payload=await response.json();
    const rawItems=Array.isArray(payload)?payload:Array.isArray(payload?.items)?payload.items:[];
    return {items:rawItems.map(normalizeRemoteItem).filter(Boolean).slice(0,2000),status:"ok",urlConfigured:true};
  } catch(error) {
    return {items:[],status:"error",urlConfigured:true,error:error instanceof Error?error.message:"Remote catalog failed."};
  } finally { clearTimeout(timer); }
}

function normalizeSuppliedCatalogItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const catalogId = String(raw.catalogId || raw.id || "").trim();
  const kind = raw.kind === "section" ? "section" : raw.kind === "page" ? "page" : "";
  const title = String(raw.title || "").trim();
  if (!catalogId || !kind || !title || raw.content == null) return null;
  return {
    ...raw,
    catalogId,
    id: String(raw.id || catalogId),
    version: Math.max(1, Number(raw.version || 1)),
    title,
    kind,
    category: String(raw.category || (kind === "page" ? "Page Templates" : "Sections")),
    industry: String(raw.industry || "general"),
    industryLabel: String(raw.industryLabel || raw.industry || "General"),
    style: String(raw.style || "modern"),
    layout: String(raw.layout || "centered"),
    planTier: raw.planTier === "pro" ? "pro" : "free",
    colorTags: Array.isArray(raw.colorTags) ? raw.colorTags.filter(Boolean).map(String).slice(0, 12) : [],
    source: String(raw.source || "builtin"),
    content: clone(raw.content),
  };
}

function validCatalogRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === "object" && String(row.catalogId || "").trim());
}


export function getLocalMarketplaceCatalogCount() {
  let starterItems = [];
  try { starterItems = getDefaultMarketplaceCatalogItems(); } catch {}
  const merged = new Map();
  for (const raw of [...(Array.isArray(starterItems) ? starterItems : []), ...(Array.isArray(BUILTIN_MARKETPLACE_CATALOG) ? BUILTIN_MARKETPLACE_CATALOG : [])]) {
    const item = normalizeSuppliedCatalogItem(raw);
    if (item?.catalogId) merged.set(item.catalogId, item);
  }
  return merged.size;
}

export async function getMarketplaceCatalog({ db, shop, currentVersion = VSN_BASELINE.version }) {
  const [remote, favoritesRaw, installsRaw] = await Promise.all([
    fetchRemoteCatalog(),
    db.builderMarketplaceFavorite.findMany({where:{shop}}).catch(()=>[]),
    db.builderMarketplaceInstall.findMany({where:{shop},orderBy:{updatedAt:"desc"}}).catch(()=>[]),
  ]);

  let starterItems = [];
  try {
    starterItems = getDefaultMarketplaceCatalogItems();
  } catch (error) {
    // Marketplace must remain usable even if one optional starter source is malformed.
    console.error("VSN marketplace starter catalog could not be prepared:", error);
  }

  const rawSuppliedCatalog = [
    ...(Array.isArray(starterItems) ? starterItems : []),
    ...(Array.isArray(BUILTIN_MARKETPLACE_CATALOG) ? BUILTIN_MARKETPLACE_CATALOG : []),
  ];
  const suppliedCatalog = rawSuppliedCatalog.map(normalizeSuppliedCatalogItem).filter(Boolean);
  const rejectedCount = rawSuppliedCatalog.length - suppliedCatalog.length;
  if (rejectedCount > 0) console.warn(`VSN marketplace skipped ${rejectedCount} invalid supplied catalog record(s).`);

  const merged = new Map();
  for (const item of suppliedCatalog) merged.set(item.catalogId, item);
  for (const item of (Array.isArray(remote.items) ? remote.items : [])) {
    if (!item?.catalogId) continue;
    const existing=merged.get(item.catalogId);
    if(!existing||Number(item.version||1)>Number(existing.version||1))merged.set(item.catalogId,item);
  }

  const favorites = validCatalogRows(favoritesRaw);
  const installs = validCatalogRows(installsRaw);
  const favoriteSet=new Set(favorites.map((row)=>String(row.catalogId)));
  const installMap=new Map(installs.map((row)=>[String(row.catalogId),row]));
  const items=[...merged.values()].filter((item)=>item?.catalogId).map((item)=>({
    ...item,
    compatible:isCatalogItemCompatible(item,currentVersion),
    isFavorite:favoriteSet.has(item.catalogId),
    installed:installMap.has(item.catalogId),
    installedVersion:installMap.get(item.catalogId)?.catalogVersion||null,
    installedAt:installMap.get(item.catalogId)?.installedAt||null,
  }));
  const categories=[...new Set(items.map((item)=>item.category).filter(Boolean))].sort();
  const colors=[...new Set(items.flatMap((item)=>Array.isArray(item.colorTags)?item.colorTags:[]).filter(Boolean))].sort();
  const pageCount=items.filter((item)=>item.kind==="page").length;
  const sectionCount=items.filter((item)=>item.kind==="section").length;
  return {items, remote:{status:remote.status,urlConfigured:remote.urlConfigured,error:remote.error||null,count:remote.items.length}, counts:{pages:pageCount,sections:sectionCount,total:items.length,available:items.length,remote:remote.items.length}, filters:{industries:[...MARKETPLACE_INDUSTRIES,{key:"general",label:"General"}].filter((item,index,list)=>list.findIndex((entry)=>entry.key===item.key)===index),styles:[...new Set([...MARKETPLACE_STYLES,...items.map((item)=>item.style).filter(Boolean)])].sort(),layouts:[...new Set([...MARKETPLACE_LAYOUTS,...items.map((item)=>item.layout).filter(Boolean)])].sort(),categories,colors}};
}

function assetManifest(content) {
  const assets=new Set();
  const walk=(nodes)=>{for(const node of Array.isArray(nodes)?nodes:[nodes]){if(!node||typeof node!=="object")continue;const props=node.props||{};for(const value of [props.src,props.externalUrl,props.url,props.fallbackSrc,props.poster?.url,props.media?.url])if(typeof value==="string"&&value.trim())assets.add(value.trim());walk(node.children);}};
  walk(Array.isArray(content)?content:[content]);
  return [...assets].sort();
}

function libraryContent(item) {
  const content=clone(item.content);
  const root=Array.isArray(content)?content[0]:content;
  if(root&&typeof root==="object")root.meta={...(root.meta||{}),marketplaceCatalogId:item.catalogId,marketplaceVersion:item.version,marketplaceSource:item.source,marketplaceManaged:true};
  return content;
}

export async function installMarketplaceItem({ db, shop, item, actor = "system" }) {
  if(!item?.catalogId)throw new Error("Marketplace item is missing its catalog ID.");
  if(!isCatalogItemCompatible(item))throw new Error("This template requires a newer VSN builder version.");
  const existingInstall=await db.builderMarketplaceInstall.findUnique({where:{shop_catalogId:{shop,catalogId:item.catalogId}}}).catch(()=>null);
  const existingLibrary=existingInstall?.libraryItemId?await db.builderLibraryItem.findFirst({where:{id:existingInstall.libraryItemId,shop}}):await db.builderLibraryItem.findFirst({where:{shop,sourceKey:item.catalogId}}).catch(()=>null);
  const content=libraryContent(item); const contentJson=JSON.stringify(content); const manifest=assetManifest(content);
  const rollbackJson=existingLibrary?JSON.stringify({libraryItem:{...existingLibrary}}):null;
  let libraryItem;
  if(existingLibrary){
    libraryItem=await db.builderLibraryItem.update({where:{id:existingLibrary.id},data:{title:item.title,kind:item.kind,category:item.category,contentJson,thumbnail:item.previewImage||null,templateType:item.kind==="page"?(item.templateType||"page"):null,sourceKey:item.catalogId,sourceVersion:item.version,industry:item.industry,style:item.style,planTier:item.planTier,colorTags:JSON.stringify(item.colorTags||[]),layoutTags:JSON.stringify([item.layout].filter(Boolean)),description:item.description,qualityScore:item.qualityScore,compatibilityJson:JSON.stringify(item.compatibility||{}),screenshotJson:JSON.stringify(item.screenshot||{}),source:item.source||"builtin",deletedAt:null}});
  } else {
    libraryItem=await db.builderLibraryItem.create({data:{shop,title:item.title,kind:item.kind,category:item.category,syncMode:"local",contentJson,thumbnail:item.previewImage||null,templateType:item.kind==="page"?(item.templateType||"page"):null,createdBy:actor,sourceKey:item.catalogId,sourceVersion:item.version,industry:item.industry,style:item.style,planTier:item.planTier,colorTags:JSON.stringify(item.colorTags||[]),layoutTags:JSON.stringify([item.layout].filter(Boolean)),description:item.description,qualityScore:item.qualityScore,compatibilityJson:JSON.stringify(item.compatibility||{}),screenshotJson:JSON.stringify(item.screenshot||{}),source:item.source||"builtin"}});
  }
  const install=await db.builderMarketplaceInstall.upsert({where:{shop_catalogId:{shop,catalogId:item.catalogId}},create:{shop,catalogId:item.catalogId,catalogVersion:item.version,libraryItemId:libraryItem.id,source:item.source||"builtin",rollbackJson,assetManifestJson:JSON.stringify(manifest),contentHash:hash(content)},update:{catalogVersion:item.version,libraryItemId:libraryItem.id,source:item.source||"builtin",rollbackJson,assetManifestJson:JSON.stringify(manifest),contentHash:hash(content),updatedAt:new Date()}});
  return {libraryItem,install,assetCount:manifest.length,updated:!!existingLibrary};
}

export async function rollbackMarketplaceInstall({ db, shop, catalogId }) {
  const install=await db.builderMarketplaceInstall.findUnique({where:{shop_catalogId:{shop,catalogId}}});
  if(!install)throw new Error("Install record was not found.");
  const snapshot=parseJson(install.rollbackJson,null)?.libraryItem;
  if(snapshot){
    const {id,shop:ignoredShop,createdAt,updatedAt,...data}=snapshot;
    await db.builderLibraryItem.update({where:{id:install.libraryItemId},data:{...data,deletedAt:data.deletedAt?new Date(data.deletedAt):null}});
  } else {
    await db.builderLibraryItem.updateMany({where:{id:install.libraryItemId,shop},data:{deletedAt:new Date()}});
  }
  await db.builderMarketplaceInstall.delete({where:{id:install.id}});
  return {rolledBack:true};
}

export async function toggleMarketplaceFavorite({ db, shop, catalogId, favorite }) {
  if(favorite){await db.builderMarketplaceFavorite.upsert({where:{shop_catalogId:{shop,catalogId}},create:{shop,catalogId},update:{}});}
  else await db.builderMarketplaceFavorite.deleteMany({where:{shop,catalogId}});
  return {favorite};
}

export function findCatalogItem(catalog, catalogId) { return (catalog?.items||[]).find((item)=>item.catalogId===catalogId)||null; }
