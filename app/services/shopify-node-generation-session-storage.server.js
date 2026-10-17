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
  const activeGeneration=async shop=>{
    if(typeof shop!=="string" ||
       !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(shop))
      return null;
    const row=await database.builderShopInstallation.findUnique({where:{shop}});
    if(row?.shop!==shop || !(row.installedAt instanceof Date) ||
       !Number.isFinite(row.installedAt.getTime()) || row.uninstalledAt!==null)
      return null;
    return row.installedAt.getTime();
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
        if(typeof id!=="string" || !id ||
           typeof database?.session?.findUnique!=="function")
          return undefined;
        // Pin both the actual persisted SDK session and installation
        // generation BEFORE calling the official SDK session loader. The
        // older read-only guard checked only after that await; uninstall
        // followed by reinstall could reactivate a stale already-read token.
        const original=await database.session.findUnique({where:{id}});
        if(!original || original.id!==id || typeof original.accessToken!=="string")
          return undefined;
        const generation=await activeGeneration(original.shop);
        if(generation===null)return undefined;
        const session=await base.loadSession(id);
        if(!session || session.id!==id ||
           session.shop!==original.shop ||
           session.accessToken!==original.accessToken)
          return undefined;
        const [latest,afterGeneration]=await Promise.all([
          database.session.findUnique({where:{id}}),
          activeGeneration(original.shop),
        ]);
        // A token rotation, deletion or changed install generation during
        // the asynchronous SDK read must never disclose the stale session.
        if(!latest || latest.id!==id ||
           latest.shop!==original.shop ||
           latest.accessToken!==original.accessToken ||
           afterGeneration!==generation)
          return undefined;
        return session;
      }catch{throw safeReadError()}
    },
    async findSessionsByShop(shop){
      try{
        const before=await activeGeneration(shop);
        if(before===null)return [];
        const sessions=await base.findSessionsByShop(shop);
        if(!Array.isArray(sessions))throw safeReadError();
        // A successful uninstall AND reinstall between two boolean active
        // checks must NOT release credentials from a prior generation.
        if(await activeGeneration(shop)!==before)return [];
        return sessions.filter(session=>session?.shop===shop);
      }catch{throw safeReadError()}
    },
  };
}
