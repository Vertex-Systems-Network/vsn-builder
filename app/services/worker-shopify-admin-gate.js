// Future Cloudflare Worker Admin request boundaries. NOT deployed routes.
// The official Shopify React Router SDK authenticates every request.
// Mutations must hold the merchant's installation row lock across their entire
// database transaction; a previous GET-time session check is insufficient.
import { logStagingFailure, logStagingDenial } from "./worker-diagnostics.js";
import { inspectWorkerShopifyConfiguration } from "./shopify-worker-configuration.js";
import { inspectWorkerNeonEnvironment } from "./db-worker-neon.js";
import { createWorkerShopifySdkContext } from "./shopify-worker-sdk-context.js";
import { createVerifiedMerchantPageSummaryLease } from "./worker-shopify-page-summary.js";
import { createVerifiedMerchantPageMetadataLease } from "./worker-shopify-page-metadata.js";
import { createVerifiedMerchantPageContentLease } from "./worker-shopify-page-content.js";
import { hasVerifiedWorkerPaidReadAccess } from "./worker-shopify-paid-read.js";
import { canAccessBuilderAction } from "../utils/builder-permissions.server.js";

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
  if(!stored || stored.shop!==shop || stored.id!==session.id ||
     stored.isOnline!==session.isOnline ||
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
// A streamed GET loader can still be reading from authenticated Shopify or
// Neon after its callback returns. Returning the original body closes the
// request-scoped SDK/database in finally BEFORE the stream is consumed.
// Complete bounded read responses while that context is still alive.
// Larger app datasets must be paginated instead of retaining live DB clients.
const MAX_READ_RESPONSE_BYTES=8*1024*1024;
const MAX_READ_RESPONSE_MS=7000;
async function securedReadResponse(result) {
  if(!(result instanceof Response))throw new TypeError("Missing HTTP Response");
  // The Shopify SDK may THROW a deliberate reauth Response in the outer
  // guard. But an ordinary route callback returning 3xx, Set-Cookie or
  // Location is NOT the SDK reauth transport and must never initiate
  // navigation or set session cookies after merchant page authorization.
  if(result.status<200 || result.status>=500 ||
     (result.status>=300 && result.status<400) ||
     result.headers.has("set-cookie") || result.headers.has("location"))
    throw new TypeError("Unsafe GET response");
  // Client errors are still allowed as statuses (e.g. 404 page absent),
  // but discard their bodies: they may contain unsanitized SDK/DB diagnostics.
  if(result.status>=400)return new Response(null,{status:result.status,
    headers:{"cache-control":"no-store","x-content-type-options":"nosniff"},
  });
  const headers=new Headers(result.headers);
  headers.set("cache-control","no-store");
  headers.set("x-content-type-options","nosniff");
  headers.delete("content-length");
  if(result.body===null) return new Response(null,{
    status:result.status,statusText:result.statusText,headers,
  });
  const advertised=Number(result.headers.get("content-length"));
  if(Number.isFinite(advertised) && advertised>MAX_READ_RESPONSE_BYTES)
    throw new RangeError("GET response too large");
  const reader=result.body.getReader();
  const chunks=[];
  let length=0;
  const deadline=Date.now()+MAX_READ_RESPONSE_MS;
  try {
    // eslint-disable-next-line no-constant-condition -- intentional bounded loop
    while(true) {
      const remaining=deadline-Date.now();
      if(remaining<=0)throw new RangeError("GET response timed out");
      let timer;
      const next=await Promise.race([
        reader.read(),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new RangeError("GET response timed out")),remaining);
        }),
      ]).finally(()=>clearTimeout(timer));
      if(next.done)break;
      if(!(next.value instanceof Uint8Array))throw new TypeError("Invalid GET chunk");
      length+=next.value.byteLength;
      if(length>MAX_READ_RESPONSE_BYTES)throw new RangeError("GET response too large");
      chunks.push(next.value);
    }
  }catch(error) {
    // Never block the SDK/Neon cleanup waiting on a hostile source's cancel().
    try{void reader.cancel().catch(()=>{})}catch{ /* best-effort */ }
    throw error;
  }finally{
    try{reader.releaseLock()}catch{ /* best-effort */ }
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new Response(bytes,{
    status:result.status,statusText:result.statusText,headers,
  });
}

// Merchant POST responses must be fully resolved BEFORE the DB transaction
// commits. Without this, a returned ReadableStream could fail only while the
// client consumes it AFTER the row lock and Prisma client are gone.
// Keep POST responses intentionally small; large editor data should be
// fetched via authenticated GET, not streamed from a mutating transaction.
const MAX_MUTATION_RESPONSE_BYTES=256*1024;
// Must be shorter than the Prisma interactive-transaction timeout (12s).
// Applies to the TOTAL body, not each individual read, so a slow sender
// cannot extend the row lock forever by sending one byte per second.
const MAX_MUTATION_RESPONSE_READ_MS=2000;
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
  const deadline=Date.now()+MAX_MUTATION_RESPONSE_READ_MS;
  try {
    // eslint-disable-next-line no-constant-condition -- intentional bounded loop
    while(true) {
      const remaining=deadline-Date.now();
      if(remaining<=0)throw new RangeError("Admin mutation response read deadline exceeded");
      let timer;
      let next;
      try {
        next=await Promise.race([
          reader.read(),
          new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(
              new RangeError("Admin mutation response read deadline exceeded")
            ),remaining);
          }),
        ]);
      }finally{if(timer!==undefined)clearTimeout(timer)}
      const {done,value}=next;
      if(done)break;
      if(!(value instanceof Uint8Array))throw new TypeError("Invalid HTTP body chunk");
      length+=value.byteLength;
      if(length>MAX_MUTATION_RESPONSE_BYTES)
        throw new RangeError("Admin mutation response exceeds byte limit");
      chunks.push(value);
    }
  }catch(error) {
    // A stalled or malicious stream may also hang when cancelled. Trigger
    // cancellation but NEVER await it while the row-locked transaction waits
    // to roll back; a late rejection stays handled.
    try{void reader.cancel().catch(()=>{})}catch{ /* preserve original failure */ }
    throw error;
  }finally{try{reader.releaseLock()}catch{ /* best-effort */ }}
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new Response(bytes,{
    status:result.status,statusText:result.statusText,headers,
  });
}

async function guardedAdminRequest(request,env,{
  createSdkContext=createWorkerShopifySdkContext,onAuthenticated,
  enablePageSummary=false,enablePageMetadata=false,enablePageContent=false,
  requireVerifiedPaidRead=false,requirePageViewPermission=false,
  onUnverifiedPaidRead,
}={},mutation=false) {
  if(!(request instanceof Request))return denied(400);
  if(request.method!==(mutation?"POST":"GET"))return denied(405);
  const url=new URL(request.url);
  if(url.pathname!=="/app" && !url.pathname.startsWith("/app/"))
    return denied(404);
  // Shopify SDK, URLSearchParams and app/router helpers can interpret
  // duplicate URL keys differently, even if just "host"/"embedded" rather
  // than "shop". Reject ALL repeated parameter names (including percent-
  // encoded aliases), before opening Shopify SDK or Neon context.
  // Do not change permitted canonical OAuth/App Bridge keys or trust URL
  // contents as credentials. The official SDK still owns authentication.
  const seenParams=new Set();
  for(const [key] of url.searchParams) {
    if(seenParams.has(key))return denied(400);
    seenParams.add(key);
  }
  if(typeof onAuthenticated!=="function")return denied(503);
  if(!inspectWorkerShopifyConfiguration(request,env).ready ||
     !inspectWorkerNeonEnvironment(env).ready)return denied(503);
  const hintedShop=url.searchParams.get("shop");
  if(hintedShop!==null && !SHOP.test(hintedShop))return denied(400);
  let context;
  let pageReadLease;
  let metadataLease;
  let contentLease;
  // Only a Response THROWN by the official authenticate.admin invocation
  // may be forwarded as Shopify reauthorization transport. A route callback
  // can itself throw Response.redirect()/Set-Cookie; that is never trusted.
  let sdkThrownResponse;
  try {
    context=await createSdkContext(request,env);
    if(typeof context?.shopify?.authenticate?.admin!=="function" ||
       typeof context?.database?.session?.findUnique!=="function" ||
       typeof context?.database?.builderShopInstallation?.findUnique!=="function" ||
       typeof context?.close!=="function")return denied(503);

    // This is the only authentication authority. Untrusted ?shop and headers
    // are NEVER merchant credentials; ?shop is only a consistency check.
    let authenticated;
    try {
      authenticated=await context.shopify.authenticate.admin(request);
    }catch(error) {
      if(error instanceof Response)sdkThrownResponse=error;
      throw error;
    }
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
       lifecycle.uninstalledAt!==null){
      logStagingDenial(env,"installation-not-active");
      return denied(403);
    }
    const stored=await context.database.session.findUnique({
      where:{id:session.id}
    });
    if(!matches(stored,session,shop)){
      logStagingDenial(env,"persisted-session-mismatch");
      return denied(403);
    }

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
        // Only actual Shopify SDK-THROWN Responses may carry reauth
        // redirects/cookies. A mutation callback that RETURNS navigation or
        // cookie headers is untrusted and must NEVER commit merchant writes.
        if(result.status<200 ||
           (result.status>=300 && result.status<400) ||
           result.headers.has("set-cookie") || result.headers.has("location"))
          rollback(503);
        // 4xx merchant edit failures may be intentional, but the callback
        // could have serialized Prisma errors, Shopify tokens or SDK headers.
        // Roll back BEFORE consuming that body and expose only its status.
        // Do not return raw 5xx diagnostics, regardless of content type.
        if(result.status>=500)rollback(503);
        if(result.status>=400)rollback(result.status);
        // Only a successful, non-redirecting, cookie-free response may be
        // fully buffered while Prisma can still rollback. A broken stream
        // or immutable headers cannot turn a committed write into a 503.
        return await securedMutationResponse(result);
      },{maxWait:5000,timeout:12000});
    }else{
      // A page-data capability is privileged by definition. Never rely on
      // callers remembering separate billing/RBAC flags when new routes are
      // added: selecting either reader automatically enforces both guards.
      const needsPageAuthority=enablePageSummary || enablePageMetadata || enablePageContent;
      // No Free plan: do not hand any Builder page-data capability to an
      // authenticated but unpaid merchant, even on hosted Staging.
      // This is fail-closed and does not trust NODE_ENV or query parameters.
      if((needsPageAuthority || requireVerifiedPaidRead) &&
         !await hasVerifiedWorkerPaidReadAccess(context.database,shop)){
        logStagingDenial(env,"paid-plan-not-verified");
        // One Staging app-shell route may render a non-data billing notice so
        // the embedded app never appears blank. This callback receives only
        // the authenticated shop; page leases and Shopify admin are withheld.
        // It cannot soften the gate for API routes or mutations.
        if(!mutation && url.pathname==="/app" &&
           typeof onUnverifiedPaidRead==="function")
          response=await onUnverifiedPaidRead({shop});
        else return denied(403);
      }else{
        // The Worker read routes must respect the SAME persisted staff and
        // collaborator permissions as Local/Dev /app/pages. A valid Shopify
        // token and paid subscription do not grant every staff user visibility.
        if((needsPageAuthority || requirePageViewPermission) &&
           !await canAccessBuilderAction(context.database,session,"pages","view"))
        {
          logStagingDenial(env,"pages-view-permission-denied");
          return denied(403);
        }
        // A narrowly scoped read-only page capability is optional. Create it
        // ONLY after official Shopify auth, persisted session and installation
        // verification; no raw Prisma handle reaches the route callback.
        if(enablePageSummary){
          pageReadLease=createVerifiedMerchantPageSummaryLease(context.database,shop);
        }
        if(enablePageMetadata){
          metadataLease=createVerifiedMerchantPageMetadataLease(context.database,shop);
        }
        if(enablePageContent){
          contentLease=createVerifiedMerchantPageContentLease(context.database,shop);
        }
        response=await onAuthenticated({
          request,shop,session,admin:authenticated.admin,
          ...(pageReadLease?{pageSummary:pageReadLease.load}:{}),
          ...(metadataLease?{pageMetadata:metadataLease.get}:{}),
          ...(contentLease?{pageContent:contentLease.get}:{}),
        });
      }
    }
    if(!(response instanceof Response))return denied(503);
    // POST responses were already secured inside the still-open transaction.
    // Do not perform any throwable processing after PostgreSQL COMMIT.
    if(mutation)return response;
    const buffered=await securedReadResponse(response);
    // ALL authenticated merchant GETs can contain sensitive merchant bytes,
    // including settings/dashboard routes without optional page-data leases.
    // After fully buffering the authorized Response, pin exact install
    // generation and persisted session/token/expiry again BEFORE releasing
    // any response bytes or closing the request-scoped SDK/Neon context.
    // This narrow post-read fence is not a serializable database snapshot.
    const [latestInstall,latestSession]=await Promise.all([
      context.database.builderShopInstallation.findUnique({where:{shop}}),
      context.database.session.findUnique({where:{id:session.id}}),
    ]);
    if(!latestInstall || latestInstall.shop!==shop ||
       !isDate(latestInstall.installedAt) ||
       latestInstall.installedAt.getTime()!==lifecycle.installedAt.getTime() ||
       latestInstall.uninstalledAt!==null){
      logStagingDenial(env,"installation-changed-during-read");
      return denied(403);
    }
    if(!matches(latestSession,session,shop)){
      logStagingDenial(env,"session-changed-during-read");
      return denied(403);
    }
    return buffered;
  } catch(error) {
    if(error instanceof RollbackResponse){
      // The database transaction has already been rolled back. Preserve
      // intentional client errors, never surface arbitrary server failures.
      if(error.response.status>=500)return denied(503);
      // The transactional branch already finalized the safe response.
      // Failures during finalization occurred BEFORE the rollback, not here.
      return error.response;
    }
    // Only official SDK authenticate.admin-thrown Response is safe to
    // pass through unchanged. Caller-controlled mutation/GET callbacks and
    // DB helpers may also THROW Response but must never forge SDK cookies
    // or navigation, even if their response looks like a real Shopify 302.
    if(error instanceof Response && error===sdkThrownResponse)return error;
    logStagingFailure(env,"admin-gate",error);
    return denied(503);
  } finally {
    // A leaked callback cannot query after this request's context is closed.
    pageReadLease?.revoke();
    metadataLease?.revoke();
    contentLease?.revoke();
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
