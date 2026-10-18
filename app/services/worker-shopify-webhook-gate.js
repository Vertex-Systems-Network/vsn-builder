// Shopify webhook gate for a future Cloudflare Worker runtime.
// A lightweight WebCrypto verification guards against forged traffic BEFORE
// opening Prisma, then the official Shopify SDK independently validates the
// signed request. No production route is wired to this module yet.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";

const MAX_WEBHOOK_BYTES = 65536;
// Keep a single wall-clock deadline for the entire raw HMAC body, not a
// per-chunk timeout that a slow trickle can extend indefinitely.
const MAX_WEBHOOK_READ_MS = 3000;
const SHOP_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
// JavaScript Date.parse may silently normalize impossible calendar days
// (e.g. February 30). A syntactically valid but impossible Shopify event
// time must not be recorded as a different calendar date. This timestamp
// is still UNSIGNED metadata: never use it as installation-generation proof.
const UTC_EVENT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
export function parseValidShopifyWebhookUTC(value){
  if(typeof value!=="string")return null;
  const match=UTC_EVENT.exec(value);
  if(!match)return null;
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed))return null;
  const date=new Date(parsed);
  if(date.getUTCFullYear()!==Number(match[1]) ||
     date.getUTCMonth()+1!==Number(match[2]) ||
     date.getUTCDate()!==Number(match[3]) ||
     date.getUTCHours()!==Number(match[4]) ||
     date.getUTCMinutes()!==Number(match[5]) ||
     date.getUTCSeconds()!==Number(match[6]))
    return null;
  return date;
}
// Only locally constructed validation denials carry their intended 4xx
// status to the hosted Worker. A Shopify SDK/database/callback may ALSO
// throw Response; those untrusted exceptions must always become 503.
const EARLY_DENIALS=new WeakSet();
const denied = status => {
  const response=new Response(null,{status});
  EARLY_DENIALS.add(response);
  return response;
};
const SAFE_CALLBACK_STATUSES=new Set([204,400,401,503]);
const emptyStatus=status=>new Response(null,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff",
  ...(status===503?{"retry-after":"60"}:{}),
}});
// The callback has no authority to set browser cookies, redirect, or expose
// a diagnostic body after webhook verification. Invalid callback output
// must RETRY rather than implicitly acknowledging deletion.
export function normalizeVerifiedWorkerWebhookResult(response){
  if(!(response instanceof Response) ||
     !SAFE_CALLBACK_STATUSES.has(response.status) ||
     response.body!==null ||
     response.headers.has("set-cookie") ||
     response.headers.has("location"))
    return emptyStatus(503);
  return emptyStatus(response.status);
}
export function normalizeWorkerWebhookFailure(error){
  return emptyStatus(error instanceof Response && EARLY_DENIALS.has(error)
    ? error.status : 503);
}

async function boundedWebhookBody(request) {
  const claimedLength=request.headers.get("content-length");
  if(claimedLength!==null && (!/^[0-9]+$/.test(claimedLength) ||
     Number(claimedLength)>MAX_WEBHOOK_BYTES))throw denied(413);
  const reader=request.body?.getReader();
  if(!reader)throw denied(400);
  const chunks=[];
  let length=0;
  let shouldCancel=true;
  const deadline=Date.now()+MAX_WEBHOOK_READ_MS;
  try {
    while(true) {
      const remaining=deadline-Date.now();
      if(remaining<=0)throw denied(408);
      let timer;
      const next=await Promise.race([
        reader.read(),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(denied(408)),remaining);
        }),
      ]).finally(()=>clearTimeout(timer));
      if(next.done)break;
      if(!(next.value instanceof Uint8Array))throw denied(400);
      length+=next.value.byteLength;
      if(length>MAX_WEBHOOK_BYTES)throw denied(413);
      chunks.push(next.value);
    }
    if(length===0)throw denied(400);
    shouldCancel=false;
  }catch(e) {
    if(e instanceof Response)throw e;
    throw denied(400);
  }finally{
    if(shouldCancel) {
      // A malicious stream can return a never-settling cancel() promise.
      // Never await cancellation while the incoming request holds a Worker.
      try{void reader.cancel().catch(()=>{})}catch{}
    }
    try{reader.releaseLock()}catch{}
  }
  const body=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
  return body;
}

async function signatureIsValid(bytes,secret,signature) {
  if(!SIGNATURE_PATTERN.test(signature))return false;
  let sig;
  try{sig=Uint8Array.from(atob(signature),c=>c.charCodeAt(0))}
  catch{return false}
  if(sig.length!==32)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["verify"]);
  return crypto.subtle.verify("HMAC",key,sig,bytes);
}

export async function acceptWorkerShopifyUninstallWebhook(request,env,{
  createSdkContext=createWorkerShopifySdkContext,
  onVerified,
}={}) {
  if(!(request instanceof Request))throw denied(400);
  if(request.method!=="POST")throw denied(405);
  if(typeof onVerified!=="function")throw denied(503);
  if(!inspectWorkerShopifyConfiguration(request,env).ready ||
     !inspectWorkerNeonEnvironment(env).ready)throw denied(503);

  const url=new URL(request.url);
  if(url.pathname!=="/webhooks/app/uninstalled" || url.search)throw denied(404);
  const shop=request.headers.get("x-shopify-shop-domain")||"";
  const topic=request.headers.get("x-shopify-topic")||"";
  const hmac=request.headers.get("x-shopify-hmac-sha256")||"";
  const version=request.headers.get("x-shopify-api-version")||"";
  const id=request.headers.get("x-shopify-webhook-id")||"";
  const timestamp=request.headers.get("x-shopify-triggered-at")||"";
  // Shopify emits an RFC3339 UTC event timestamp, sometimes with nanoseconds.
  // Do not infer event time from *delivery* time: retries can follow reinstall.
  const triggeredAt=parseValidShopifyWebhookUTC(timestamp);
  if(!triggeredAt)throw denied(400);
  if(!SHOP_PATTERN.test(shop) || topic!=="app/uninstalled" ||
     !/^\d{4}-\d{2}$/.test(version) || !/^[a-zA-Z0-9-]{1,128}$/.test(id) || !hmac)
    throw denied(400);

  const raw=await boundedWebhookBody(request);
  if(!await signatureIsValid(raw,env.SHOPIFY_API_SECRET,hmac))throw denied(401);

  const validatedRequest=new Request(url.toString(),{
    method:"POST",headers:request.headers,body:raw
  });
  let context;
  try {
    context=await createSdkContext(validatedRequest,env);
    // Shopify SDK *also* validates the raw body and HMAC. Never bypass it.
    const event=await context.shopify.authenticate.webhook(validatedRequest);
    if(event?.shop!==shop || event?.topic!=="APP_UNINSTALLED" ||
       !event.webhookId || event.webhookId!==id)throw denied(401);
    // Only after independent WebCrypto + official Shopify SDK authentication
    // may a cleanup callback access the SDK request-scoped database. This
    // hook itself never performs a delete, and finally always closes context.
    const response=await onVerified({event,context,triggeredAt});
    return normalizeVerifiedWorkerWebhookResult(response);
  }finally {
    if(context)await context.close().catch(()=>{});
  }
}
