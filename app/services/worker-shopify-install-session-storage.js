// Request-scoped Shopify SessionStorage that persists installation generation
// and OAuth offline sessions in ONE database transaction, using Shopify's
// official Prisma SessionStorage for token serialization.
//
// The SDK must authenticate OAuth before invoking storeSession. This adapter
// DOES NOT verify OAuth, sign tokens, expose secrets or deploy any Worker.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const blocked=()=>{
  const error=new Error("Worker Shopify installation/session persistence unavailable");
  error.code="VSN_WORKER_INSTALL_SESSION_BLOCKED";
  return error;
};
const options={connectionRetries:1,connectionRetryIntervalMs:0};
const isDate=(v)=>v instanceof Date&&Number.isFinite(v.getTime());

export async function persistWorkerShopifySessionWithGeneration(session,db,{
  SessionStorage,clock=()=>new Date(),
}={}) {
  if(!SHOP.test(String(session?.shop||"")) || typeof session?.id!=="string" ||
     typeof session?.isOnline!=="boolean" || typeof SessionStorage!=="function" ||
     typeof db?.$transaction!=="function" ||
     typeof session?.accessToken!=="string" || !session.accessToken ||
     (!session.isOnline && session.id!==`offline_${session.shop}`))
    throw blocked();
  const now=clock();
  if(!isDate(now))throw blocked();
  try {
    return await db.$transaction(async(tx)=>{
      const lifecycle=tx?.builderShopInstallation;
      if(typeof lifecycle?.upsert!=="function" ||
         typeof lifecycle?.updateMany!=="function" ||
         typeof lifecycle?.findUnique!=="function" ||
         typeof tx?.session?.findUnique!=="function" ||
         typeof tx?.session?.upsert!=="function" ||
         typeof tx?.session?.count!=="function")
        throw blocked();

      if(session.isOnline){
        // Lock the active installation row before saving a user session.
        // An uninstall transaction cannot race between this claim and write.
        const active=await lifecycle.updateMany({
          where:{shop:session.shop,uninstalledAt:null},
          data:{updatedAt:now},
        });
        if(active?.count!==1)throw blocked();
      }else{
        // A no-op update deliberately locks this exact shop row; the uninstall
        // fence also updates the same row before Session.deleteMany.
        const installation=await lifecycle.upsert({
          where:{shop:session.shop},
          create:{
            shop:session.shop,installedAt:now,uninstalledAt:null,
            lastUninstallWebhookId:null,
          },
          update:{updatedAt:now},
        });
        const prior=await tx.session.findUnique({where:{id:session.id}});
        const changed=prior?.accessToken!==session.accessToken;
        // Keep installedAt stable across retries/identical token refreshes.
        // Reinstalls following confirmed uninstall, or token replacement,
        // advance the generation atomically with the SDK's Session.upsert.
        if(!isDate(installation?.installedAt))throw blocked();
        if(installation.uninstalledAt!==null || changed){
          const next=new Date(Math.max(
            now.getTime(),installation.installedAt.getTime()+1
          ));
          const updated=await lifecycle.updateMany({
            where:{shop:session.shop},
            data:{
              installedAt:next,uninstalledAt:null,
              lastUninstallWebhookId:null,
            },
          });
          if(updated?.count!==1)throw blocked();
        }
      }
      const inside=new SessionStorage(tx,options);
      if(await inside.storeSession(session)!==true)throw blocked();
      return true;
    });
  }catch{
    // Never send driver errors, DB connection strings or access tokens to SDK.
    throw blocked();
  }
}

export function createWorkerGenerationSessionStorage(database,baseStorage,{
  SessionStorage,clock,
}={}) {
  const methods=["loadSession","deleteSession","deleteSessions","findSessionsByShop","isReady"];
  if(!baseStorage || methods.some(name=>typeof baseStorage[name]!=="function") ||
     typeof SessionStorage!=="function")throw blocked();
  return {
    storeSession:session=>persistWorkerShopifySessionWithGeneration(session,database,{
      SessionStorage,clock,
    }),
    ...Object.fromEntries(methods.map(method=>[
      method,(...args)=>baseStorage[method](...args),
    ])),
  };
}
