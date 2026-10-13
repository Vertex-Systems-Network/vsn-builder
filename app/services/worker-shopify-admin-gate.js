// Future Cloudflare Worker Admin request boundaries. NOT deployed routes.
// The official Shopify React Router SDK authenticates every request.
// Mutations must hold the merchant's installation row lock across their entire
// database transaction; a previous GET-time session check is insufficient.
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";

const SHOP=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const denied=status=>new Response(null,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
const isDate=value=>value instanceof Date && Number.isFinite(value.getTime());
// The official Shopify SDK authenticates the request, but its returned
// Session is not a substitute for the currently persisted token's expiry.
// With expiring offline tokens enabled, a DB token can expire independently
// of a still-valid App Bridge ID token. Never expose app data or mutations
// through an expired, malformed or missing online-session expiration.
const validExpiry=(value,now)=>{
  if(value==null)return true;
  return value instanceof Date && Number.isFinite(value.getTime()) &&
    value.getTime()>now;
};
const matches=(stored,session,shop)=>{
  if(!stored || stored.shop!==shop || stored.isOnline!==session.isOnline ||
     stored.accessToken!==session.accessToken)return false;
  const now=Date.now();
  if(!validExpiry(stored.expires,now) ||
     !validExpiry(session.expires,now))return false;
  // Online sessions are user-bound and must have an explicit finite expiry
  // in both the verified SDK session and persisted record.
  if(session.isOnline && (stored.expires==null || session.expires==null))
    return false;
  return true;
};

// Throw within the Prisma transaction, rather than returning an HTTP error
// as a successful transaction result. Prisma commits on normal return,
// INCLUDING 4xx/5xx Response values. Keep the failed response for safe
// 4xx application errors; sanitize 5xx to avoid disclosing driver details.
class RollbackResponse extends Error {
  constructor(response){
    super("Admin mutation transaction must roll back");
    this.response=response;
  }
}
const rollback=(status)=>{throw new RollbackResponse(denied(status))};

// Normalize response headers BEFORE a successful mutation commits. Some
// responses (Response.redirect(), fetch() results) expose immutable Headers:
// modifying them after Prisma commits would otherwise return an HTTP 503
// despite persisting merchant writes. Construct a new Response with a
// mutable header copy while the transaction is still reversible.
function securedResponse(result) {
  if(!(result instanceof Response))throw new TypeError("Missing HTTP Response");
  const headers=new Headers(result.headers);
  headers.set("cache-control","no-store");
  headers.set("x-content-type-options","nosniff");
  return new Response(result.body,{
    status:result.status,statusText:result.statusText,headers,
  });
}

// Merchant POST responses must be fully resolved BEFORE the DB transaction
// commits. Without this, a returned ReadableStream could fail only while the
// client consumes it AFTER the row lock and Prisma client are gone.
// Keep POST responses intentionally small; large editor data should be
// fetched via authenticated GET, not streamed from a mutating transaction.
const MAX_MUTATION_RESPONSE_BYTES=256*1024;
async function securedMutationResponse(result) {
  if(!(result instanceof Response))throw new TypeError("Missing HTTP Response");
  const headers=new Headers(result.headers);
  headers.set("cache-control","no-store");
  headers.set("x-content-type-options","nosniff");
  // Recomputed body length: immutable upstream response headers must not
  // advertise an inaccurate content-length after materialization.
  headers.delete("content-length");
  if(result.body===null)return new Response(null,{
    status:result.status,statusText:result.statusText,headers,
  });
  const reader=result.body.getReader();
  const chunks=[];
  let length=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw new TypeError("Invalid HTTP body chunk");
      length+=value.byteLength;
      if(length>MAX_MUTATION_RESPONSE_BYTES)
        throw new RangeError("Admin mutation response exceeds byte limit");
      chunks.push(value);
    }
  }catch(error) {
    try{await reader.cancel()}catch{ /* keep original stream failure */ }
    throw error;
  }finally{try{reader.releaseLock()}catch{}}
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new Response(bytes,{
    status:result.status,statusText:result.statusText,headers,
  });
}

async function guardedAdminRequest(request,env,{
  createSdkContext=createWorkerShopifySdkContext,onAuthenticated,
}={},mutation=false) {
  if(!(request instanceof Request))return denied(400);
  if(request.method!==(mutation?"POST":"GET"))return denied(405);
  const url=new URL(request.url);
  if(url.pathname!=="/app" && !url.pathname.startsWith("/app/"))
    return denied(404);
  if(typeof onAuthenticated!=="function")return denied(503);
  if(!inspectWorkerShopifyConfiguration(request,env).ready ||
     !inspectWorkerNeonEnvironment(env).ready)return denied(503);
  const hintedShop=url.searchParams.get("shop");
  if(hintedShop!==null && !SHOP.test(hintedShop))return denied(400);
  let context;
  try {
    context=await createSdkContext(request,env);
    if(typeof context?.shopify?.authenticate?.admin!=="function" ||
       typeof context?.database?.session?.findUnique!=="function" ||
       typeof context?.database?.builderShopInstallation?.findUnique!=="function" ||
       typeof context?.close!=="function")return denied(503);

    // This is the only authentication authority. Untrusted ?shop and headers
    // are NEVER merchant credentials; ?shop is only a consistency check.
    const authenticated=await context.shopify.authenticate.admin(request);
    const session=authenticated?.session;
    const shop=session?.shop;
    if(!SHOP.test(String(shop||"")) ||
       typeof session?.id!=="string" || !session.id ||
       typeof session?.accessToken!=="string" || !session.accessToken ||
       typeof session?.isOnline!=="boolean" ||
       (hintedShop!==null && hintedShop!==shop))return denied(401);

    const lifecycle=await context.database.builderShopInstallation.findUnique({
      where:{shop}
    });
    if(!lifecycle || !isDate(lifecycle.installedAt) ||
       lifecycle.uninstalledAt!==null)return denied(403);
    const stored=await context.database.session.findUnique({
      where:{id:session.id}
    });
    if(!matches(stored,session,shop))return denied(403);

    let response;
    if(mutation) {
      if(typeof context.database.$transaction!=="function")return denied(503);
      // updateMany locks the exact shop row. The uninstall callback updates
      // this same row before deleting sessions, so the two operations must
      // serialize on PostgreSQL. Critically, recheck the session INSIDE that
      // lock, after any concurrent uninstall/rotation has finished.
      response=await context.database.$transaction(async transaction=>{
        if(typeof transaction?.builderShopInstallation?.updateMany!=="function" ||
           typeof transaction?.session?.findUnique!=="function")
          throw new Error("Missing transactional authorization delegates");
        const locked=await transaction.builderShopInstallation.updateMany({
          where:{shop,uninstalledAt:null},
          data:{updatedAt:new Date()},
        });
        if(locked?.count!==1)rollback(403);
        const current=await transaction.session.findUnique({
          where:{id:session.id}
        });
        if(!matches(current,session,shop))rollback(403);

        // All merchant-facing database writes MUST use this transaction.
        // The external request-scoped Prisma client is NOT passed through.
        // Await callback completion while transaction remains open, and
        // ROLLBACK if it returns any error status or invalid result.
        const result=await onAuthenticated({
          request,shop,session,admin:authenticated.admin,transaction
        });
        if(!(result instanceof Response))throw new TypeError("Mutation callback did not return Response");
        // A returned redirect is not the same as a Shopify SDK-THROWN
        // reauth redirect. Refuse to commit writes on unreviewed 3xx or
        // status-0 results; keep Shopify-thrown redirects untouched.
        if(result.status<200 || result.status>=300 && result.status<400)
          rollback(503);
        // The response must be fully constructible and secured WHILE Prisma
        // can still roll back. Invalid/immutable source headers, a locked
        // stream or unsupported status cannot turn a committed write into 503.
        const finalized=await securedMutationResponse(result);
        if(result.status>=400)throw new RollbackResponse(finalized);
        return finalized;
      },{maxWait:5000,timeout:12000});
    }else{
      // GET is for loaders/read-only data. Do not expose the mutable DB
      // handle to read callbacks. Never use GET for merchant mutations.
      response=await onAuthenticated({
        request,shop,session,admin:authenticated.admin
      });
    }
    if(!(response instanceof Response))return denied(503);
    // POST responses were already secured inside the still-open transaction.
    // Do not perform any throwable processing after PostgreSQL COMMIT.
    return mutation?response:securedResponse(response);
  } catch(error) {
    if(error instanceof RollbackResponse){
      // The database transaction has already been rolled back. Preserve
      // intentional client errors, never surface arbitrary server failures.
      if(error.response.status>=500)return denied(503);
      // The transactional branch already finalized the safe response.
      // Failures during finalization occurred BEFORE the rollback, not here.
      return error.response;
    }
    // Shopify SDK can throw a Response to start reauthentication. Forward it
    // unchanged (including cookie/redirect headers), as the official SDK
    // requires. Reject other errors without exposing tokens/Neon URLs.
    if(error instanceof Response)return error;
    return denied(503);
  } finally {
    try{await context?.close?.()}catch{ /* never log database secrets */ }
  }
}

/** Authenticated read-only GET /app request, no database transaction. */
export function acceptWorkerShopifyAdminRequest(request,env,options) {
  return guardedAdminRequest(request,env,options,false);
}

/** Authenticated POST; transactionally serialized against uninstall. */
export function acceptWorkerShopifyAdminMutation(request,env,options) {
  return guardedAdminRequest(request,env,options,true);
}
