// Node/Local Shopify SDK SessionStorage adapter.
// Keep the officially supported PrismaSessionStorage read, delete and
// serialization logic; the generation-aware transactional writer intercepts
// ONLY storeSession. This is not a trusted reinstall-generation issuer.
import {PrismaSessionStorage} from "@shopify/shopify-app-session-storage-prisma";
import {createWorkerGenerationSessionStorage} from "./worker-shopify-install-session-storage.js";

export function createNodeShopifyGenerationSessionStorage(database,{
  SessionStorage=PrismaSessionStorage,clock,
}={}){
  if(!database || typeof database.$transaction!=="function" ||
     typeof SessionStorage!=="function"){
    const error=new Error("VSN_NODE_SHOPIFY_SESSION_STORAGE_BLOCKED");
    error.code="VSN_NODE_SHOPIFY_SESSION_STORAGE_BLOCKED";
    throw error;
  }
  if(typeof database?.builderShopInstallation?.findUnique!=="function"){
    const error=new Error("VSN_NODE_SHOPIFY_SESSION_STORAGE_BLOCKED");
    error.code="VSN_NODE_SHOPIFY_SESSION_STORAGE_BLOCKED";
    throw error;
  }
  const base=new SessionStorage(database);
  const writer=createWorkerGenerationSessionStorage(database,base,{
    SessionStorage,clock,
  });
  const allowed=async shop=>{
    if(typeof shop!=="string" ||
       !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(shop))
      return false;
    const row=await database.builderShopInstallation.findUnique({where:{shop}});
    return row?.shop===shop && row?.installedAt instanceof Date &&
      Number.isFinite(row.installedAt.getTime()) && row.uninstalledAt===null;
  };
  const safeReadError=()=>{
    const error=new Error("VSN_NODE_SHOPIFY_SESSION_READ_BLOCKED");
    error.code="VSN_NODE_SHOPIFY_SESSION_READ_BLOCKED";
    return error;
  };
  return {
    ...writer,
    async loadSession(id){
      try{
        const session=await base.loadSession(id);
        if(!session)return undefined;
        return await allowed(session.shop)?session:undefined;
      }catch{throw safeReadError()}
    },
    async findSessionsByShop(shop){
      try{
        if(!await allowed(shop))return [];
        const sessions=await base.findSessionsByShop(shop);
        if(!Array.isArray(sessions))throw safeReadError();
        // The installation can be uninstalled while the SDK enumerates
        // sessions. Revalidate AFTER that await, before returning any token.
        // This is a narrow read race guard, not trusted reinstall provenance.
        if(!await allowed(shop))return [];
        return sessions.filter(session=>session?.shop===shop);
      }catch{throw safeReadError()}
    },
  };
}
