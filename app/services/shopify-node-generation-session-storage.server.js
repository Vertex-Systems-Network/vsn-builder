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
  const expiry=row=>{
    if(row?.expires===null || row?.expires===undefined)return null;
    return row.expires instanceof Date && Number.isFinite(row.expires.getTime())
      ? row.expires.getTime() : NaN;
  };
  const validPersisted=(row,id,shop)=>{
    if(!row || typeof id!=="string" || !id || row.id!==id ||
       row.shop!==shop || typeof row.accessToken!=="string" ||
       !row.accessToken || typeof row.isOnline!=="boolean")return false;
    const until=expiry(row);
    return until===null || (Number.isFinite(until)&&until>Date.now());
  };
  const samePersisted=(a,b)=>
    a?.id===b.id && a?.shop===b.shop &&
    a?.accessToken===b.accessToken && a?.isOnline===b.isOnline &&
    expiry(a)===expiry(b);
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
        if(!validPersisted(original,id,original?.shop))return undefined;
        const generation=await activeGeneration(original.shop);
        if(generation===null)return undefined;
        const session=await base.loadSession(id);
        if(!validPersisted(session,id,original.shop) ||
           !samePersisted(session,original))return undefined;
        const [latest,afterGeneration]=await Promise.all([
          database.session.findUnique({where:{id}}),
          activeGeneration(original.shop),
        ]);
        // A token rotation, deletion or changed install generation during
        // the asynchronous SDK read must never disclose the stale session.
        if(!validPersisted(latest,id,original.shop) ||
           !samePersisted(latest,original) ||
           afterGeneration!==generation)
          return undefined;
        return session;
      }catch{throw safeReadError()}
    },
    async findSessionsByShop(shop){
      try{
        const before=await activeGeneration(shop);
        if(before===null)return [];
        if(typeof database?.session?.findMany!=="function")
          throw safeReadError();
        // Pin persisted credentials before the official SDK's asynchronous
        // enumeration. installedAt alone cannot catch rotation/deletion in
        // the SAME installation generation.
        const originals=await database.session.findMany({where:{shop}});
        if(!Array.isArray(originals))throw safeReadError();
        const previouslyPersisted=new Map();
        for(const row of originals){
          if(!validPersisted(row,row?.id,shop) ||
             previouslyPersisted.has(row.id))throw safeReadError();
          previouslyPersisted.set(row.id,row);
        }
        const sessions=await base.findSessionsByShop(shop);
        if(!Array.isArray(sessions))throw safeReadError();
        // Read after SDK enumeration: deny a changed installation, a removed
        // SDK session, or a token that rotated while the query was pending.
        // This narrow read fence is not a serializable database snapshot and
        // does not create trusted webhook install-generation provenance.
        const [after,nowPersisted]=await Promise.all([
          activeGeneration(shop),
          database.session.findMany({where:{shop}}),
        ]);
        if(after!==before || !Array.isArray(nowPersisted))return [];
        const latest=new Map();
        for(const row of nowPersisted){
          if(!validPersisted(row,row?.id,shop) ||
             latest.has(row.id))throw safeReadError();
          latest.set(row.id,row);
        }
        const seen=new Set();
        for(const session of sessions){
          if(!validPersisted(session,session?.id,shop) ||
             seen.has(session.id) || !previouslyPersisted.has(session.id) ||
             !latest.has(session.id) ||
             !samePersisted(session,previouslyPersisted.get(session.id)) ||
             !samePersisted(session,latest.get(session.id)))
            return [];
          seen.add(session.id);
        }
        return sessions;
      }catch{throw safeReadError()}
    },
  };
}
