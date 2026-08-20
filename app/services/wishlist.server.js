const MAX_WISHLIST_ITEMS = 500;
const MAX_LIVE_RESOLVE = 60;

function safeJson(value, fallback = []) { try { const parsed=JSON.parse(String(value||"")); return parsed ?? fallback; } catch { return fallback; } }
function cleanText(value,max=500){return String(value??"").trim().slice(0,max);}
function gid(type,id){const raw=cleanText(id,120);if(!raw)return"";return raw.startsWith("gid://")?raw:`gid://shopify/${type}/${raw}`;}
function numericId(value){return cleanText(value,160).split("/").pop();}
export function wishlistItemKey(item={}) {
  const productId=cleanText(item.productId||item.handle,180); const variantId=cleanText(item.variantId,180);
  return cleanText(item.key || (variantId?`${productId}::${variantId}`:productId),360);
}
export function normalizeWishlistItems(input=[]) {
  const rows=Array.isArray(input)?input:[]; const out=[]; const seen=new Set();
  for(const raw of rows){
    if(!raw||typeof raw!=="object")continue;
    const productId=numericId(raw.productId); const handle=cleanText(raw.handle,255); const variantId=numericId(raw.variantId);
    const key=wishlistItemKey({key:raw.key,productId:productId||handle,handle,variantId});
    if(!key||(!productId&&!handle)||seen.has(key))continue; seen.add(key);
    const date=Date.parse(raw.addedAt||"");
    out.push({key,productId,variantId,handle,title:cleanText(raw.title||"Product",240)||"Product",url:cleanText(raw.url||(handle?`/products/${handle}`:""),700),image:cleanText(raw.image,1400),price:cleanText(raw.price,80),currency:cleanText(raw.currency,20),available:raw.available!==false,addedAt:Number.isFinite(date)?new Date(date).toISOString():new Date().toISOString()});
    if(out.length>=MAX_WISHLIST_ITEMS)break;
  }
  return out;
}
export function mergeWishlistItems(local=[],server=[]) {
  const rows=[...normalizeWishlistItems(local),...normalizeWishlistItems(server)].sort((a,b)=>Date.parse(b.addedAt||0)-Date.parse(a.addedAt||0));
  return normalizeWishlistItems(rows);
}
export async function getCustomerWishlist(db,shop,customerId){
  if(!shop||!customerId)return[];
  const row=await db.builderWishlist.findUnique({where:{shop_customerId:{shop,customerId:String(customerId)}}}).catch(()=>null);
  return normalizeWishlistItems(safeJson(row?.itemsJson,"[]"));
}
export async function saveCustomerWishlist(db,shop,customerId,items){
  const normalized=normalizeWishlistItems(items);
  if(!shop||!customerId)return normalized;
  await db.builderWishlist.upsert({where:{shop_customerId:{shop,customerId:String(customerId)}},create:{shop,customerId:String(customerId),itemsJson:JSON.stringify(normalized),itemCount:normalized.length},update:{itemsJson:JSON.stringify(normalized),itemCount:normalized.length}});
  return normalized;
}
export async function syncCustomerWishlist(db,{shop,customerId,items=[],mode="merge"}={}){
  const local=normalizeWishlistItems(items); const existing=await getCustomerWishlist(db,shop,customerId);
  const next=mode==="replace"?local:mode==="clear"?[]:mergeWishlistItems(local,existing);
  return saveCustomerWishlist(db,shop,customerId,next);
}

function variantMap(product){return new Map((product?.variants?.nodes||[]).map(v=>[numericId(v.id),v]));}
function productToLive(item,product){
  if(!product)return{...item,available:false,live:false};
  const variants=variantMap(product); const variant=item.variantId?variants.get(String(item.variantId)):null; const first=(product.variants?.nodes||[]).find(v=>v?.availableForSale!==false)||(product.variants?.nodes||[])[0]||null; const chosen=variant||first;
  const price=chosen?.price ?? product.priceRangeV2?.minVariantPrice?.amount ?? item.price;
  const currency=product.priceRangeV2?.minVariantPrice?.currencyCode || item.currency;
  return {...item,productId:numericId(product.id)||item.productId,variantId:item.variantId||numericId(chosen?.id),handle:product.handle||item.handle,title:product.title||item.title,url:product.handle?`/products/${product.handle}`:item.url,image:chosen?.image?.url||product.featuredImage?.url||item.image,price:price==null?item.price:String(price),currency:cleanText(currency,20),available:chosen?chosen.availableForSale!==false:true,live:true};
}
export async function resolveWishlistLive(admin,items,{limit=MAX_LIVE_RESOLVE}={}){
  const normalized=normalizeWishlistItems(items); if(!admin||!normalized.length)return normalized;
  const targets=normalized.slice(0,Math.max(1,Math.min(MAX_LIVE_RESOLVE,Number(limit)||MAX_LIVE_RESOLVE)));
  const ids=targets.map(item=>gid("Product",item.productId)).filter(Boolean); const byId=new Map();
  if(ids.length){
    for(let i=0;i<ids.length;i+=50){
      try{
        const response=await admin.graphql(`#graphql\n          query VsnWishlistProducts($ids:[ID!]!){nodes(ids:$ids){... on Product{id title handle featuredImage{url altText} priceRangeV2{minVariantPrice{amount currencyCode}} variants(first:100){nodes{id title availableForSale price image{url altText}}}}}}`,{variables:{ids:ids.slice(i,i+50)}});
        const json=await response.json(); for(const product of json.data?.nodes||[])if(product?.id)byId.set(numericId(product.id),product);
      }catch(error){console.warn("VSN wishlist live product resolution failed:",error?.message||error);}
    }
  }
  const resolved=targets.map(item=>productToLive(item,byId.get(item.productId)));
  return [...resolved,...normalized.slice(targets.length)];
}
export async function wishlistResponse({db,admin,shop,customerId,limit=60}={}){
  const items=await getCustomerWishlist(db,shop,customerId); const live=await resolveWishlistLive(admin,items,{limit});
  return{ok:true,authenticated:Boolean(customerId),items:live,count:items.length,serverCount:items.length,updatedAt:new Date().toISOString()};
}
