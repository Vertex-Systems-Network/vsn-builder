import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
assert.equal(process.env.CI,"true","CI-only Workerd probe");
assert.equal(process.env.NODE_ENV,"test","Test runtime only");
const forbidden=["CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID","SHOPIFY_API_SECRET","DATABASE_URL","DIRECT_URL"];
for(const name of forbidden)assert(!process.env[name],"Cloud credential "+name+" must not be present during local Worker test");
const binary="npm";
const port=8788,origin="http://127.0.0.1:"+port;
let log="";
const worker=spawn(binary,["exec","--yes","--package=wrangler@4.149.0","--","wrangler","dev","--config","wrangler.ci.jsonc","--local","--ip","127.0.0.1","--port",String(port)],{
 cwd:root,env:{
  ...process.env,
  BROWSER:"none",CI:"true",WRANGLER_SEND_METRICS:"false",
  CLOUDFLARE_API_TOKEN:"",CLOUDFLARE_ACCOUNT_ID:"",
  DATABASE_URL:"",DIRECT_URL:"",SHOPIFY_API_SECRET:"",
 },stdio:["ignore","pipe","pipe"],detached:true
});
for(const stream of [worker.stdout,worker.stderr])stream.on("data",chunk=>{
 log=(log+chunk.toString()).slice(-9000);
});
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function probe(route,opts){
 const resp=await fetch(origin+route,{redirect:"manual",signal:AbortSignal.timeout(3500),...opts});
 const body=(await resp.text()).slice(0,6000);
 return {status:resp.status,body,headers:resp.headers};
}
async function stop(){
 // npm exec launches wrangler as a child; terminating only the npm parent
 // leaves a workerd grandchild holding stdout and can hang GitHub CI.
 const signalGroup=(signal)=>{
  try{process.kill(-worker.pid,signal)}catch{try{worker.kill(signal)}catch{}}
 };
 signalGroup("SIGTERM");
 if(worker.exitCode===null && worker.signalCode===null){
  await Promise.race([new Promise(resolve=>worker.once("exit",resolve)),sleep(2400)]);
 }
 signalGroup("SIGKILL");
}
try{
 let ready=false;
 for(let i=0;i<90;i++){
  if(worker.exitCode!==null)throw Error("workerd exited (status="+worker.exitCode+"), diagnostics: "+log.replace(/(?:token|secret|password)\\s*[:=]\\s*\\S+/gi,"[redacted]").slice(-3200));
  try{
   const rsp=await probe("/__vsn_local_workerd_check__");
   if(rsp.status===200){ready=true;break}
  }catch{}
  await sleep(350);
 }
 assert(ready,"workerd module import/serve did not start: "+log.replace(/(?<=token|secret|password)\S*/gi,"[redacted]").slice(-1800));
 const valid=await probe("/__vsn_local_workerd_check__");
 assert.equal(valid.status,200);
 const check=JSON.parse(valid.body);
 assert.equal(check.ready,false);
 assert.equal(check.ciOnly,true);
 assert.equal(check.modulesLoaded,true,JSON.stringify(check.checks));
 for(const [name,state] of Object.entries(check.checks))assert.equal(state,true,"Module/guard not healthy: "+name);
 console.log("PASS workerd imports Shopify SDK, Prisma Neon, Web Streams SSR and signed webhook modules");
 assert.equal(check.checks.prismaClientConstructed,true,"Worker Prisma-Neon Client could not construct/close in real workerd");
 assert.equal(check.checks.crossProjectBlocked,true,"Worker Prisma Client did not reject cross-project identity");
 console.log("PASS workerd constructs and disconnects engine-less Prisma/Neon Client without DB queries");
 assert.equal(check.checks.reactWebStreamRendered,true,"React Web Streams did not render HTML with secure response headers in workerd");
 assert.equal(check.checks.missingShopifyCspCallbackBlocked,true,"Workerd SSR accepted missing Shopify CSP provider");
 assert.equal(check.checks.missingFrameAncestorsBlocked,true,"Workerd SSR accepted CSP lacking frame-ancestors");
 console.log("PASS real Workerd React Web Streams HTML, CSP callback and frame-ancestors rejection");
 assert.equal(check.checks.realShopifySdkCspRendered,true,"Official Shopify SDK failed merchant-scoped CSP inside real workerd");
 assert.equal(check.checks.shopifySdkSessionClosed,true,"Official SDK synthetic session context was not closed");
 assert.equal(check.checks.wrongProjectUrlDeniedBeforeSdkStorage,true,"Cross-tier Neon URL was not refused before Shopify SDK storage");
 console.log("PASS actual Shopify SDK merchant frame-ancestors and request-scoped cleanup in workerd");
 assert.equal(check.checks.officialShopifyOfflineSessionFenced,true,"Official Shopify SDK Prisma offline session was not persisted with an atomic installation generation");
 console.log("PASS actual Workerd offline Shopify SessionStorage persistence and installation transaction");
 assert.equal(check.checks.adminSdkShopIsolationGate,true,"Workerd Admin request gate allowed missing installation or cross-shop access");
 assert.equal(check.checks.adminMutationRequiresLockedSession,true,"Shopify Admin POST mutation bypassed locked installation generation");
 assert.equal(check.checks.adminFailedMutationRollback,true,"Admin POST error response was committed instead of rolled back");
 assert.equal(check.checks.adminExpiredOfflineSessionDenied,true,"Expired Shopify offline session passed Workerd Admin authorization");
 assert.equal(check.checks.adminReturnedRedirectRollback,true,"Shopify Admin POST returned redirect committed transaction instead of rollback");
 assert.equal(check.checks.unsignedTimestampCannotDeleteMerchant,true,"Forged unsigned webhook timestamp authorized session deletion without trusted generation attestation");
 assert.equal(check.checks.realSignedWebhookAccepted,true,"Signed Shopify APP_UNINSTALLED webhook was not authenticated twice inside Workerd");
 assert.equal(check.checks.tamperedWebhookDeniedBeforeStorage,true,"Tampered Shopify webhook triggered SDK storage before signature rejection");
 assert.equal(check.checks.uninstallRevokedOnlyMerchantSessions,true,"Uninstall deleted the wrong merchant session records");
 assert.equal(check.checks.uninstallReplayIsIdempotent,true,"Uninstall retry was not idempotent");
 assert.equal(check.checks.delayedOldUninstallCannotDeleteReinstall,true,"Delayed uninstall revoked a newer reinstalled merchant session");
 console.log("PASS real Workerd signed Shopify uninstall revokes only target merchant sessions, retries safely and blocks tampering");

 const blocked=await probe("/app");
 assert.equal(blocked.status,503);
 assert(!blocked.body.includes("session"),"No authenticated app runtime should be exposed");
 console.log("PASS workerd blocks real application routes with HTTP 503");
 assert.equal((await probe("/__vsn_local_workerd_check__",{method:"POST"})).status,503);
 console.log("PASS worker health probe restricted to CI-only GET");
 assert.equal(valid.headers.get("cache-control"),"no-store");
 console.log("PASS Worker compatibility probe never caches credentials");
 console.log("Local Workerd module compatibility PASS (no Shopify app deployment).");
}catch(e){
 const message=String(e?.message||e).replace(/(?:token|secret|password)\s*[:=]\s*\S+/gi,"[redacted]");
 console.error("Local Workerd compatibility FAILED: "+message.slice(0,2400));
 process.exitCode=1;
}finally {await stop()}
