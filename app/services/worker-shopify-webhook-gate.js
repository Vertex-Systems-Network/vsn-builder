// Shopify webhook gate for a future Cloudflare Worker runtime.
// A lightweight WebCrypto verification guards against forged traffic BEFORE
// opening Prisma, then the official Shopify SDK independently validates the
// signed request. No production route is wired to this module yet.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";

const MAX_WEBHOOK_BYTES = 65536;
const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const denied = (status) => new Response(null, { status });

async function boundedWebhookBody(request) {
  const claimedLength=request.headers.get("content-length");
  if(claimedLength!==null && (!/^\d+$/.test(claimedLength) ||
     Number(claimedLength)>MAX_WEBHOOK_BYTES))throw denied(413);
  const reader=request.body?.getReader();
  if(!reader)throw denied(400);
  const chunks=[];
  let length=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_WEBHOOK_BYTES) {
        await reader.cancel().catch(()=>{});
        throw denied(413);
      }
      chunks.push(value);
    }
  }catch(e) {
    if(e instanceof Response)throw e;
    throw denied(400);
  }finally {
    try{reader.releaseLock()}catch{}
  }
  if(length===0)throw denied(400);
  const body=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
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
    // onVerified is where the actual idempotent deletion handler must be
    // injected; no destructive action is performed by this acceptance module.
    const response=await onVerified({event});
    if(!(response instanceof Response))throw new TypeError("Missing webhook response");
    return response;
  }finally {
    if(context)await context.close().catch(()=>{});
  }
}
