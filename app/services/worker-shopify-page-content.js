import { assertBoundedBuilderDraftDocument } from "./worker-shopify-draft-document.js";

// T020: bounded, tenant-scoped Builder editor draft hydration.
// Deliberately not a storefront/published endpoint or a mutation capability.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PAGE_ID=/^[a-zA-Z0-9_-]{1,64}$/;
const MAX_CONTENT_BYTES=1024*1024;
const FIELDS=Object.freeze({
  id:true,shop:true,version:true,updatedAt:true,contentJson:true,
});

export function createVerifiedMerchantPageContentLease(database,verifiedShop) {
  if(!SHOP.test(String(verifiedShop||"")) ||
     typeof database?.builderPage?.findFirst!=="function")
    throw new TypeError("Verified page editor reader unavailable");
  let active=true;
  const ensureActive=()=>{
    if(!active)throw new Error("Merchant request context closed");
  };
  async function get(id) {
    ensureActive();
    if(typeof id!=="string" || !PAGE_ID.test(id))
      throw new TypeError("Invalid Builder page ID");
    const item=await database.builderPage.findFirst({
      where:{id,shop:verifiedShop,deletedAt:null},
      select:FIELDS,
    });
    ensureActive();
    if(item===null)return null;
    if(!item || item.id!==id || item.shop!==verifiedShop ||
       !Number.isSafeInteger(item.version) || item.version<1 ||
       !(item.updatedAt instanceof Date) ||
       !Number.isFinite(item.updatedAt.getTime()))
      throw new TypeError("Invalid verified Builder editor record");
    // A missing draft is a valid empty editor, but never silently accept
    // malformed or oversized nonempty JSON as an empty document.
    const raw=item.contentJson==null || item.contentJson===""?"[]":item.contentJson;
    if(typeof raw!=="string" || new TextEncoder().encode(raw).byteLength>MAX_CONTENT_BYTES)
      throw new RangeError("Builder editor draft is not safely bounded");
    let elements;
    try{elements=JSON.parse(raw)}catch{throw new TypeError("Invalid Builder editor JSON")}
    assertBoundedBuilderDraftDocument(elements);
    ensureActive();
    return {id:item.id,version:item.version,
      updatedAt:item.updatedAt.toISOString(),elements};
  }
  return Object.freeze({get,revoke(){active=false;}});
}
