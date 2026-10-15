import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { hasVerifiedWorkerPaidReadAccess } from "./worker-shopify-paid-read.js";
import { assertBoundedBuilderDraftDocument } from "./worker-shopify-draft-document.js";

// T020: dormant transaction-only editor draft persistence contract.
// This module deliberately defines NO HTTP route. A future POST integration
// must use acceptWorkerShopifyAdminMutation's locked transaction AND verify
// the paid subscription and the merchant's pages.edit role INSIDE that lock.
// Until then this is testable pre-integration logic, never a public write path.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PAGE_ID=/^[a-zA-Z0-9_-]{1,64}$/;
const MAX_DRAFT_BYTES=1024*1024;
const MAX_VERSION=2147483646;

export class BuilderDraftSaveError extends Error {
  constructor(status,code) {
    super(code);
    this.name="BuilderDraftSaveError";
    this.status=status;
    this.code=code;
  }
}

export function encodeVerifiedBuilderDraft(elements) {
  try { assertBoundedBuilderDraftDocument(elements); }
  catch { throw new BuilderDraftSaveError(400,"INVALID_DRAFT_NODES"); }
  let contentJson;
  try{contentJson=JSON.stringify(elements)}
  catch{throw new BuilderDraftSaveError(400,"INVALID_DRAFT_JSON")}
  if(typeof contentJson!=="string" ||
     new TextEncoder().encode(contentJson).byteLength>MAX_DRAFT_BYTES)
    throw new BuilderDraftSaveError(413,"DRAFT_TOO_LARGE");
  return contentJson;
}

// The transaction MUST come exclusively from the Worker SDK's verified,
// serialized merchant mutation callback, never from a raw global Prisma client.
export async function saveVerifiedBuilderPageDraft({
  transaction,shop,pageId,expectedVersion,elements,
}={}) {
  if(typeof shop!=="string" || !SHOP.test(shop) ||
     typeof pageId!=="string" || !PAGE_ID.test(pageId) ||
     !Number.isSafeInteger(expectedVersion) ||
     expectedVersion<1 || expectedVersion>MAX_VERSION)
    throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
  if(typeof transaction?.builderPage?.updateMany!=="function" ||
     typeof transaction?.builderPage?.findFirst!=="function")
    throw new BuilderDraftSaveError(503,"DRAFT_STORAGE_UNAVAILABLE");
  const contentJson=encodeVerifiedBuilderDraft(elements);
  // Atomic compare-and-swap: impossible to overwrite another actor's saved
  // draft using a stale version. Always scope by authenticated Shopify shop.
  const updated=await transaction.builderPage.updateMany({
    where:{id:pageId,shop,deletedAt:null,version:expectedVersion},
    data:{contentJson,version:{increment:1}},
  });
  if(updated?.count===1)
    return {ok:true,id:pageId,version:expectedVersion+1};
  if(updated?.count!==0)
    throw new BuilderDraftSaveError(503,"INVALID_DRAFT_WRITE_RESULT");
  // A different shop's ID and a trashed page are indistinguishable from a
  // non-existent page. Version conflicts return a safe status without content.
  const existing=await transaction.builderPage.findFirst({
    where:{id:pageId,shop,deletedAt:null},
    select:{id:true,version:true},
  });
  if(!existing)return {ok:false,status:404,code:"PAGE_NOT_FOUND"};
  if(existing.id!==pageId || !Number.isSafeInteger(existing.version))
    throw new BuilderDraftSaveError(503,"INVALID_DRAFT_STORAGE_ROW");
  return {ok:false,status:409,code:"DRAFT_VERSION_CONFLICT",
    currentVersion:existing.version};
}

// Only invoke from acceptWorkerShopifyAdminMutation's verified SDK callback,
// after the installation-row lock and persisted-session revalidation.
// No Worker HTTP write route is active.
export async function authorizeAndSaveVerifiedWorkerDraft({
  transaction,session,shop,pageId,expectedVersion,elements,
}={}) {
  if(!session || typeof shop!=="string" || !SHOP.test(shop) ||
     session.shop!==shop || typeof session.id!=="string" ||
     !session.id || typeof session.accessToken!=="string" ||
     !session.accessToken || typeof session.isOnline!=="boolean")
    throw new BuilderDraftSaveError(403,"DRAFT_SESSION_REQUIRED");
  // All authorization reads and optimistic write must stay within the same
  // uninstall-serialized transaction; neither URL shop nor plan is trusted.
  if(!await hasVerifiedWorkerPaidReadAccess(transaction,shop))
    throw new BuilderDraftSaveError(403,"DRAFT_SUBSCRIPTION_REQUIRED");
  if(!await canAccessBuilderAction(transaction,session,"pages","edit"))
    throw new BuilderDraftSaveError(403,"DRAFT_EDIT_PERMISSION_REQUIRED");
  return saveVerifiedBuilderPageDraft({
    transaction,shop,pageId,expectedVersion,elements,
  });
}
