// Request-scoped Shopify SessionStorage that persists installation generation
// and OAuth offline sessions in ONE database transaction, using Shopify's
// official Prisma SessionStorage for token serialization.
//
// The SDK must authenticate OAuth before invoking storeSession. This adapter
// DOES NOT verify OAuth, sign tokens, expose secrets or deploy any Worker.
const SHOP=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const BLOCK_REASONS=new Set([
  "invalid-session-shop","invalid-session-id","invalid-session-online-flag",
  "invalid-session-storage-adapter","invalid-session-transaction",
  "invalid-session-access-token","offline-session-id-mismatch",
  "online-session-id-offline-format","invalid-clock","transaction-unavailable",
  "installation-model-unavailable","active-generation-missing",
  "offline-generation-read-failed","offline-session-read-failed",
  "orphaned-session-needs-install-migration","installation-generation-closed",
  "installation-generation-write-invalid","session-storage-not-ready",
  "session-storage-write-rejected","transaction-operation-failed",
]);
const blocked=(reason="transaction-operation-failed")=>{
  const safeReason=BLOCK_REASONS.has(reason)?reason:"transaction-operation-failed";
  const error=new Error(`Worker Shopify installation/session persistence unavailable (${safeReason})`);
  error.code="VSN_WORKER_INSTALL_SESSION_BLOCKED";
  error.safeReason=safeReason;
  return error;
};
const options={connectionRetries:1,connectionRetryIntervalMs:0};
const isDate=(v)=>v instanceof Date&&Number.isFinite(v.getTime());

export async function persistWorkerShopifySessionWithGeneration(session,db,{
  SessionStorage,clock=()=>new Date(),
}={}) {
  if(!SHOP.test(String(session?.shop||"")))
    throw blocked("invalid-session-shop");
  if(typeof session?.id!=="string" || !session.id)
    throw blocked("invalid-session-id");
  if(typeof session?.isOnline!=="boolean")
    throw blocked("invalid-session-online-flag");
  if(typeof SessionStorage!=="function")
    throw blocked("invalid-session-storage-adapter");
  if(typeof db?.$transaction!=="function")
    throw blocked("invalid-session-transaction");
  if(typeof session?.accessToken!=="string" || !session.accessToken)
    throw blocked("invalid-session-access-token");
  if(!session.isOnline && session.id!==`offline_${session.shop}`)
    throw blocked("offline-session-id-mismatch");
  if(session.isOnline && session.id.startsWith("offline_"))
    throw blocked("online-session-id-offline-format");
  const now=clock();
  if(!isDate(now))throw blocked("invalid-clock");
  let failurePoint="transaction-operation-failed";
  try {
    failurePoint="transaction-unavailable";
    return await db.$transaction(async(tx)=>{
      const lifecycle=tx?.builderShopInstallation;
      if(typeof lifecycle?.upsert!=="function" ||
         typeof lifecycle?.updateMany!=="function" ||
         typeof lifecycle?.findUnique!=="function" ||
         typeof tx?.session?.findUnique!=="function" ||
         typeof tx?.session?.upsert!=="function" ||
         typeof tx?.session?.count!=="function")
        throw blocked("installation-model-unavailable");

      if(session.isOnline){
        // Lock the active installation row before saving a user session.
        // An uninstall transaction cannot race between this claim and write.
        failurePoint="active-generation-missing";
        const active=await lifecycle.updateMany({
          where:{shop:session.shop,uninstalledAt:null},
          data:{updatedAt:now},
        });
        if(active?.count!==1)throw blocked("active-generation-missing");
      }else{
        // A no-op update deliberately locks this exact shop row; the uninstall
        // fence also updates the same row before Session.deleteMany.
        // A normal SDK refresh is not proof of a new Shopify installation.
        // In particular, an old token must NEVER resurrect sessions after
        // APP_UNINSTALLED or silently migrate an existing orphaned session.
        failurePoint="offline-generation-read-failed";
        const previousInstall=await lifecycle.findUnique({where:{shop:session.shop}});
        failurePoint="offline-session-read-failed";
        const prior=await tx.session.findUnique({where:{id:session.id}});
        if(!previousInstall && prior)
          throw blocked("orphaned-session-needs-install-migration");
        if(previousInstall?.uninstalledAt!==null &&
           previousInstall?.uninstalledAt!==undefined)
          throw blocked("installation-generation-closed");
        failurePoint="installation-generation-write-invalid";
        const installation=await lifecycle.upsert({
          where:{shop:session.shop},
          create:{
            shop:session.shop,installedAt:now,uninstalledAt:null,
            lastUninstallWebhookId:null,
          },
          update:{updatedAt:now},
        });
        // upsert acquires the shop row lock. It is the authoritative state:
        // an uninstall may have committed between findUnique and upsert.
        if(!isDate(installation?.installedAt) ||
           installation.uninstalledAt!==null)throw blocked("installation-generation-write-invalid");
        // Same-token refresh and token rotation both belong to the *current*
        // installation. Do NOT advance installedAt just because a token
        // changed; reinstallation requires a separate authenticated flow.
        // The real Shopify SDK still serializes the token via storeSession.
      }
      failurePoint="session-storage-not-ready";
      const inside=new SessionStorage(tx,options);
      // The official Prisma adapter starts an asynchronous session-table
      // readiness probe in its constructor. Await the PUBLIC isReady() API
      // while the transaction is still alive, including paths where a
      // subclass/driver rejects storeSession before ensureReady().
      if(typeof inside.isReady!=="function" ||
         await inside.isReady()!==true)throw blocked("session-storage-not-ready");
      failurePoint="session-storage-write-rejected";
      if(await inside.storeSession(session)!==true)throw blocked("session-storage-write-rejected");
      return true;
    });
  }catch(error){
    // Never send driver errors, DB connection strings or access tokens to SDK.
    throw blocked(error?.safeReason||failurePoint);
  }
}

// The official SDK performs asynchronous PostgreSQL reads. Unlike the
// transactional storeSession, loading or enumerating a session is NOT an
// implicit authorization to use credentials after uninstall/reinstall.
const EXACT_SHOP=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const readBlocked=()=>{
  const error=new Error("VSN_WORKER_SESSION_READ_BLOCKED");
  error.code="VSN_WORKER_SESSION_READ_BLOCKED";
  return error;
};
const expiresAt=row=>{
  if(row?.expires==null)return null;
  return isDate(row.expires)?row.expires.getTime():NaN;
};
const validPersisted=(row,id,shop)=>{
  if(!row || typeof id!=="string" || !id || row.id!==id ||
     row.shop!==shop || !EXACT_SHOP.test(String(shop||"")) ||
     typeof row.accessToken!=="string" || !row.accessToken ||
     typeof row.isOnline!=="boolean")return false;
  const expiry=expiresAt(row);
  return expiry===null || (Number.isFinite(expiry)&&expiry>Date.now());
};
const samePersisted=(a,b)=>
  a.id===b.id && a.shop===b.shop && a.accessToken===b.accessToken &&
  a.isOnline===b.isOnline && expiresAt(a)===expiresAt(b);

export function createWorkerGenerationSessionStorage(database,baseStorage,{
  SessionStorage,clock,
}={}) {
  const methods=["loadSession","deleteSession","deleteSessions","findSessionsByShop","isReady"];
  if(!baseStorage || methods.some(name=>typeof baseStorage[name]!=="function") ||
     typeof SessionStorage!=="function")throw blocked();

  const activeGeneration=async shop=>{
    if(typeof shop!=="string" || !EXACT_SHOP.test(shop))return null;
    if(typeof database?.builderShopInstallation?.findUnique!=="function")
      throw readBlocked();
    const row=await database.builderShopInstallation.findUnique({where:{shop}});
    if(row?.shop!==shop || !isDate(row.installedAt) ||
       row.uninstalledAt!==null)return null;
    return row.installedAt.getTime();
  };
  const persisted=async id=>{
    if(typeof database?.session?.findUnique!=="function")
      throw readBlocked();
    return database.session.findUnique({where:{id}});
  };
  return {
    storeSession:session=>persistWorkerShopifySessionWithGeneration(session,database,{
      SessionStorage,clock,
    }),
    // Keep official Shopify SDK serialization and database deletion, but
    // never expose credentials without EXACT before/after persistent token
    // and installation-generation checks around its asynchronous loader.
    async loadSession(id){
      try{
        if(typeof id!=="string" || !id)return undefined;
        const original=await persisted(id);
        if(!original || !validPersisted(original,id,original.shop))return undefined;
        const generation=await activeGeneration(original.shop);
        if(generation===null)return undefined;
        const session=await baseStorage.loadSession(id);
        if(!session || !samePersisted(session,original))return undefined;
        const [latest,after]=await Promise.all([
          persisted(id),activeGeneration(original.shop),
        ]);
        if(!validPersisted(latest,id,original.shop) ||
           !samePersisted(latest,original) || after!==generation)return undefined;
        return session;
      }catch{throw readBlocked()}
    },
    async findSessionsByShop(shop){
      try{
        const before=await activeGeneration(shop);
        if(before===null)return [];
        if(typeof database?.session?.findMany!=="function")
          throw readBlocked();
        const originals=await database.session.findMany({where:{shop}});
        if(!Array.isArray(originals))throw readBlocked();
        const originalById=new Map();
        for(const row of originals){
          if(!validPersisted(row,row?.id,shop) || originalById.has(row.id))
            throw readBlocked();
          originalById.set(row.id,row);
        }
        const sessions=await baseStorage.findSessionsByShop(shop);
        if(!Array.isArray(sessions))throw readBlocked();
        const [after,latest]=await Promise.all([
          activeGeneration(shop),database.session.findMany({where:{shop}}),
        ]);
        if(after!==before || !Array.isArray(latest))return [];
        const latestById=new Map();
        for(const row of latest){
          if(!validPersisted(row,row?.id,shop) || latestById.has(row.id))
            throw readBlocked();
          latestById.set(row.id,row);
        }
        const seen=new Set();
        for(const session of sessions){
          if(typeof session?.id!=="string" || seen.has(session.id) ||
             !originalById.has(session.id) || !latestById.has(session.id) ||
             !samePersisted(session,originalById.get(session.id)) ||
             !samePersisted(session,latestById.get(session.id)))
            return [];
          seen.add(session.id);
        }
        return sessions;
      }catch{throw readBlocked()}
    },
    deleteSession:(...args)=>baseStorage.deleteSession(...args),
    deleteSessions:(...args)=>baseStorage.deleteSessions(...args),
    isReady:(...args)=>baseStorage.isReady(...args),
  };
}
