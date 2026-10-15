// T020 Staging-only editor save transport. Off unless the Worker has an
// explicit audited Staging feature gate. Never authorize this helper from
// a raw request: its caller MUST be the verified SDK merchant mutation
// callback holding the installation row lock and a Prisma transaction.
import {
  authorizeAndSaveVerifiedWorkerDraft,BuilderDraftSaveError,
} from "./worker-shopify-page-draft-save.js";

const MAX_REQUEST_BYTES=1024*1024+8192;
const READ_DEADLINE_MS=1800;
const response=status=>new Response(null,{
 status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"},
});
const json=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",
 "content-type":"application/json; charset=utf-8"},
});

export async function parseBoundedWorkerDraftSaveRequest(request){
 if(!(request instanceof Request) || request.method!=="POST")
  throw new BuilderDraftSaveError(405,"DRAFT_METHOD_NOT_ALLOWED");
 const type=request.headers.get("content-type")||"";
 if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(type))
  throw new BuilderDraftSaveError(415,"DRAFT_CONTENT_TYPE_REQUIRED");
 const declared=request.headers.get("content-length");
 if(declared!==null && (!/^[0-9]+$/.test(declared) ||
   Number(declared)>MAX_REQUEST_BYTES))
  throw new BuilderDraftSaveError(413,"DRAFT_REQUEST_TOO_LARGE");
 const reader=request.body?.getReader();
 if(!reader)throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
 const chunks=[];
 let total=0;
 const deadline=Date.now()+READ_DEADLINE_MS;
 let cancel=true;
 try{
  while(true){
   const remaining=deadline-Date.now();
   if(remaining<=0)throw new BuilderDraftSaveError(408,"DRAFT_READ_TIMEOUT");
   let timer;
   const next=await Promise.race([
    reader.read(),
    new Promise((_,reject)=>{
     timer=setTimeout(()=>reject(new BuilderDraftSaveError(408,"DRAFT_READ_TIMEOUT")),remaining);
    }),
   ]).finally(()=>clearTimeout(timer));
   if(next.done)break;
   if(!(next.value instanceof Uint8Array))
    throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
   total+=next.value.byteLength;
   if(total>MAX_REQUEST_BYTES)
    throw new BuilderDraftSaveError(413,"DRAFT_REQUEST_TOO_LARGE");
   chunks.push(next.value);
  }
  if(total===0)throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
  cancel=false;
 }catch(error){
  if(error instanceof BuilderDraftSaveError)throw error;
  throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
 }finally{
  if(cancel)try{void reader.cancel().catch(()=>{})}catch{/* never await malicious cancel */}
  try{reader.releaseLock()}catch{/* preserve original failure */}
 }
 const bytes=new Uint8Array(total);
 let pos=0;
 for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength}
 let payload;
 try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}
 catch{throw new BuilderDraftSaveError(400,"INVALID_DRAFT_JSON")}
 if(!payload || typeof payload!=="object" || Array.isArray(payload) ||
    Object.keys(payload).sort().join(",")!=="elements,expectedVersion")
  throw new BuilderDraftSaveError(400,"INVALID_DRAFT_REQUEST");
 return {elements:payload.elements,expectedVersion:payload.expectedVersion};
}

// The merchant SDK auth gate rolls back all >=400 results while holding
// the uninstall-serialized transaction. This handler never publishes pages.
export async function handleVerifiedWorkerDraftSave({
 request,transaction,session,shop,pageId,
}={}){
 try{
  const {elements,expectedVersion}=await parseBoundedWorkerDraftSaveRequest(request);
  const result=await authorizeAndSaveVerifiedWorkerDraft({
   transaction,session,shop,pageId,expectedVersion,elements,
  });
  if(result.ok)return json({id:result.id,version:result.version},200);
  if(result.status===409)return json({code:result.code,currentVersion:result.currentVersion},409);
  if(result.status===404)return response(404);
  return response(503);
 }catch(error){
  if(error instanceof BuilderDraftSaveError && [400,403,405,408,413,415].includes(error.status))
   return response(error.status);
  // DB, stale auth and driver exceptions must be sanitized by the merchant
  // mutation gate, which also rolls the transaction back.
  throw error;
 }
}
