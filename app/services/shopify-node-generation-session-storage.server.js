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
  const base=new SessionStorage(database);
  return createWorkerGenerationSessionStorage(database,base,{
    SessionStorage,clock,
  });
}
