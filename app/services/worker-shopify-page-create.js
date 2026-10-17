// T020 MVP: tenant-scoped Staging-only blank page creation. It is reachable
// solely through the official Shopify SDK merchant mutation transaction;
// it never publishes storefront content or writes to Live.
import { COMMERCIAL_PLANS } from "../config/commercialPlans.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";
import { getVerifiedWorkerPaidPlan } from "./worker-shopify-paid-read.js";
import { BuilderDraftSaveError } from "./worker-shopify-page-draft-save.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const MAX_BODY_BYTES=1024;
const MAX_READ_MS=1500;
const safe=status=>new Response(null,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff",
}});
const json=value=>new Response(JSON.stringify(value),{status:201,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "content-type":"application/json; charset=utf-8",
}});

// Never accept URL shop, plan, owner, template, published content, role or
// request-provided page ID. Input shape is intentionally title-only.
export async function parseBoundedWorkerPageCreateRequest(request) {
  if(!(request instanceof Request) || request.method!=="POST")
    throw new BuilderDraftSaveError(405,"PAGE_CREATE_METHOD");
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")||""))
    throw new BuilderDraftSaveError(415,"PAGE_CREATE_CONTENT_TYPE");
  const claimed=request.headers.get("content-length");
  if(claimed!==null && (!/^[0-9]+$/.test(claimed) || Number(claimed)>MAX_BODY_BYTES))
    throw new BuilderDraftSaveError(413,"PAGE_CREATE_TOO_LARGE");
  const reader=request.body?.getReader();
  if(!reader)throw new BuilderDraftSaveError(400,"PAGE_CREATE_BODY_REQUIRED");
  const chunks=[];
  let total=0,shouldCancel=true;
  const deadline=Date.now()+MAX_READ_MS;
  try {
    while(true){
      const remaining=deadline-Date.now();
      if(remaining<=0)throw new BuilderDraftSaveError(408,"PAGE_CREATE_TIMEOUT");
      let timer;
      const next=await Promise.race([
        reader.read(),
        new Promise((_,reject)=>{timer=setTimeout(
          ()=>reject(new BuilderDraftSaveError(408,"PAGE_CREATE_TIMEOUT")),remaining);
        }),
      ]).finally(()=>clearTimeout(timer));
      if(next.done)break;
      if(!(next.value instanceof Uint8Array))
        throw new BuilderDraftSaveError(400,"PAGE_CREATE_INVALID_BYTES");
      total+=next.value.byteLength;
      if(total>MAX_BODY_BYTES)
        throw new BuilderDraftSaveError(413,"PAGE_CREATE_TOO_LARGE");
      chunks.push(next.value);
    }
    if(total===0)throw new BuilderDraftSaveError(400,"PAGE_CREATE_BODY_REQUIRED");
    shouldCancel=false;
  }catch(error){
    if(error instanceof BuilderDraftSaveError)throw error;
    throw new BuilderDraftSaveError(400,"PAGE_CREATE_BAD_BODY");
  }finally{
    if(shouldCancel)try{void reader.cancel().catch(()=>{})}catch{}
    try{reader.releaseLock()}catch{}
  }
  const bytes=new Uint8Array(total);
  let index=0;
  for(const chunk of chunks){bytes.set(chunk,index);index+=chunk.byteLength}
  let value;
  try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}
  catch{throw new BuilderDraftSaveError(400,"PAGE_CREATE_BAD_JSON")}
  if(!value || typeof value!=="object" || Array.isArray(value) ||
     Object.keys(value).length!==1 || !Object.hasOwn(value,"title") ||
     typeof value.title!=="string")
    throw new BuilderDraftSaveError(400,"PAGE_CREATE_BAD_FIELDS");
  const title=value.title.trim();
  if(!title || title.length>120 || /[\u0000-\u001f\u007f]/.test(title) ||
     new TextEncoder().encode(title).byteLength>256)
    throw new BuilderDraftSaveError(400,"PAGE_CREATE_BAD_TITLE");
  return {title};
}

export async function authorizeAndCreateVerifiedWorkerPage({
  transaction,session,shop,title,
}={}) {
  if(!SHOP.test(String(shop||"")) || !session || session.shop!==shop ||
     typeof session.id!=="string" || !session.id ||
     typeof session.accessToken!=="string" || !session.accessToken ||
     typeof session.isOnline!=="boolean")
    throw new BuilderDraftSaveError(403,"PAGE_CREATE_SESSION_REQUIRED");
  if(typeof title!=="string" || !title.trim() || title.length>120 ||
     /[\u0000-\u001f\u007f]/.test(title) ||
     new TextEncoder().encode(title).byteLength>256)
    throw new BuilderDraftSaveError(400,"PAGE_CREATE_BAD_TITLE");
  const planKey=await getVerifiedWorkerPaidPlan(transaction,shop);
  const maxPages=COMMERCIAL_PLANS[planKey]?.maxPages;
  if(!planKey || !Number.isSafeInteger(maxPages) || maxPages<1)
    throw new BuilderDraftSaveError(403,"PAGE_CREATE_PLAN_REQUIRED");
  if(!await canAccessBuilderAction(transaction,session,"pages","create"))
    throw new BuilderDraftSaveError(403,"PAGE_CREATE_ROLE_REQUIRED");
  if(typeof transaction?.builderPage?.count!=="function" ||
     typeof transaction?.builderPage?.create!=="function")
    throw new BuilderDraftSaveError(503,"PAGE_CREATE_STORAGE_REQUIRED");
  // The caller already locked the shop installation row in this Prisma
  // transaction. All creates for this shop serialize through that same row.
  const used=await transaction.builderPage.count({
    where:{shop,deletedAt:null},
  });
  if(!Number.isSafeInteger(used) || used<0)
    throw new BuilderDraftSaveError(503,"PAGE_CREATE_INVALID_USAGE");
  if(used>=maxPages)
    throw new BuilderDraftSaveError(403,"PAGE_CREATE_QUOTA_EXCEEDED");
  const prefix=title.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,42) || "page";
  const handle=prefix+"-"+crypto.randomUUID().replaceAll("-","").slice(0,16);
  const created=await transaction.builderPage.create({data:{
    shop,title,handle,template:"page",status:"draft",contentJson:"[]",
    publishedJson:null,createdBy:"Verified Shopify staff",
  },select:{id:true,shop:true,title:true,handle:true,status:true,version:true}});
  if(typeof created?.id!=="string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(created.id) ||
     created.shop!==shop || created.title!==title || created.handle!==handle ||
     created.status!=="draft" || created.version!==1)
    throw new BuilderDraftSaveError(503,"PAGE_CREATE_INVALID_RESULT");
  return {id:created.id,handle:created.handle,version:1,status:"draft"};
}

export async function handleVerifiedWorkerPageCreate({
  request,transaction,session,shop,
}={}) {
  try{
    const {title}=await parseBoundedWorkerPageCreateRequest(request);
    const result=await authorizeAndCreateVerifiedWorkerPage({
      transaction,session,shop,title,
    });
    return json(result);
  }catch(error){
    if(error instanceof BuilderDraftSaveError &&
       [400,403,405,408,413,415].includes(error.status))return safe(error.status);
    // A Prisma failure is handled by the surrounding serialized mutation
    // guard and rolls back; no raw response or DB diagnostics may escape.
    throw error;
  }
}
