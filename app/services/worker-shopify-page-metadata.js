// T020: exact-page, read-only capability for a verified Shopify merchant.
// No editor JSON, revisions, private content, arbitrary Prisma delegates,
// or cross-tenant lookup can escape to the hosted Worker route.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PAGE_ID=/^[a-zA-Z0-9_-]{1,64}$/;
const FIELDS=Object.freeze({
 id:true,shop:true,title:true,handle:true,template:true,
 status:true,version:true,updatedAt:true,
});

export function isSafeMerchantPageId(value) {
 return typeof value==="string" && PAGE_ID.test(value);
}

export function createVerifiedMerchantPageMetadataLease(database,verifiedShop) {
 if(!SHOP.test(String(verifiedShop||"")) ||
    typeof database?.builderPage?.findFirst!=="function")
  throw new TypeError("Verified page metadata reader unavailable");
 let active=true;
 const check=()=>{if(!active)throw new Error("Merchant request context closed");};
 async function get(id) {
  check();
  if(!isSafeMerchantPageId(id))throw new TypeError("Invalid Builder page ID");
  // Perform filtering in PostgreSQL, never filter a potentially leaked
  // cross-shop record in JavaScript after a global id-only read.
  const item=await database.builderPage.findFirst({
   where:{id,shop:verifiedShop,deletedAt:null},
   select:FIELDS,
  });
  check();
  if(item===null)return null;
  // Defensive validation before returning the fixed safe scalar projection.
  if(!item || item.id!==id || item.shop!==verifiedShop ||
     typeof item.title!=="string" || typeof item.handle!=="string" ||
     typeof item.template!=="string" || typeof item.status!=="string" ||
     !Number.isSafeInteger(item.version) || item.version<1 ||
     !(item.updatedAt instanceof Date) || !Number.isFinite(item.updatedAt.getTime()))
   throw new TypeError("Invalid verified Builder page metadata");
  return {id:item.id,title:item.title,handle:item.handle,
    template:item.template,status:item.status,version:item.version,
    updatedAt:item.updatedAt.toISOString()};
 }
 return Object.freeze({get,revoke(){active=false;}});
}
