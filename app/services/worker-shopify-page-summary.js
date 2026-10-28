// T020 read-only Shopify merchant dashboard slice for the hosted Worker.
// Scoped by the *verified Shopify SDK session*, never a shop URL parameter.
// It does not implement full editor routing, OAuth, billing, or mutation access.
const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PROJECTION=Object.freeze({
  id:true,title:true,template:true,status:true,updatedAt:true,
});
const MAX_RECENT=5;
const PAGE_ID=/^[a-zA-Z0-9_-]{1,64}$/;
// Match the existing staging dashboard's safe text projection bounds.
// This lease also feeds a JSON endpoint, so don't defer validation to HTML.
const MAX_TITLE=256,MAX_TEMPLATE=120,MAX_STATUS=40;

export function createVerifiedMerchantPageSummaryLease(database,shop){
  if(!SHOP.test(String(shop||"")) ||
    typeof database?.builderPage?.count!=="function" ||
    typeof database?.builderPage?.findMany!=="function")
    throw new TypeError("Verified merchant page reader unavailable");
  let active=true;
  const allowed=()=>{if(!active)throw new Error("Merchant request context closed");};
  async function load(){
    allowed();
    // Fixed shop filters and fixed scalar projection: route callers cannot
    // inject a different tenant, raw SQL, nested relation or contentJson.
    const where={shop,deletedAt:null};
    const [total,draft,published,recent]=await Promise.all([
      database.builderPage.count({where}),
      database.builderPage.count({where:{...where,status:"draft"}}),
      database.builderPage.count({where:{...where,status:"published"}}),
      database.builderPage.findMany({
        where,orderBy:{updatedAt:"desc"},take:MAX_RECENT,select:PROJECTION,
      }),
    ]);
    // A Promise may resolve after a caller has already closed the scope.
    allowed();
    if(![total,draft,published].every(x=>Number.isSafeInteger(x)&&x>=0) ||
       draft>total || published>total || draft+published>total ||
       !Array.isArray(recent)||recent.length>MAX_RECENT)
      throw new TypeError("Invalid merchant page summary");
    const rows=recent.map(row=>{
      if(typeof row?.id!=="string" || !PAGE_ID.test(row.id) ||
         typeof row.title!=="string" || row.title.length>MAX_TITLE ||
         typeof row.template!=="string" || row.template.length>MAX_TEMPLATE ||
         typeof row.status!=="string" || row.status.length>MAX_STATUS ||
         !(row.updatedAt instanceof Date) ||
         !Number.isFinite(row.updatedAt.getTime()))
        throw new TypeError("Invalid merchant page record");
      return {id:row.id,title:row.title,template:row.template,
        status:row.status,updatedAt:row.updatedAt.toISOString()};
    });
    allowed();
    return {total,draft,published,recent:rows};
  }
  return Object.freeze({load,revoke(){active=false;}});
}
