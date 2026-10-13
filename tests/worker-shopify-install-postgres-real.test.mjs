import test from "node:test";
import assert from "node:assert/strict";
import {setTimeout as sleep} from "node:timers/promises";
import prismaCloud from "../generated/prisma-cloud/index.js";
import {PrismaSessionStorage} from "@shopify/shopify-app-session-storage-prisma";
import {persistWorkerShopifySessionWithGeneration} from "../app/services/worker-shopify-install-session-storage.js";
import {revokeVerifiedWorkerShopifySessions} from "../app/services/worker-shopify-uninstall-session-revoke.js";
import {acceptWorkerShopifyAdminRequest} from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

// This test is ONLY permitted against the disposable GitHub Actions postgres
// service container. Fail before opening Prisma if any setting is not exact.
// Never accept Neon, hostname aliases, remote URLs or arbitrary credentials.
assert.equal(process.env.CI,"true");
assert.equal(process.env.NODE_ENV,"test");
assert.equal(process.env.APP_ENV,"development");
const expected="postgresql://vsn_ci:isolated-only-password@127.0.0.1:5432/vsn_builder_ci?schema=public";
assert.equal(process.env.DATABASE_URL,expected);
assert.equal(process.env.DIRECT_URL,expected);

const {PrismaClient}=prismaCloud;
const db=new PrismaClient();
const shop="vsn-pg-ci-first.myshopify.com";
const other="vsn-pg-ci-other.myshopify.com";
const rollback="vsn-pg-ci-rollback.myshopify.com";
const race="vsn-pg-ci-race.myshopify.com";
const shops=[shop,other,rollback,race];
const installedAt=new Date("2026-10-13T10:00:00.000Z");
const uninstalledAt=new Date("2026-10-13T11:00:00.000Z");
const offline=(name,accessToken="fake-ci-token")=>({
 id:"offline_"+name,shop:name,state:"",isOnline:false,
 accessToken,scope:"read_products",toObject(){return {};},
});
const persist=(name,accessToken="fake-ci-token",Storage=PrismaSessionStorage,at=installedAt)=>
 persistWorkerShopifySessionWithGeneration(offline(name,accessToken),db,{
  SessionStorage:Storage,clock:()=>at,
 });
const webhook=name=>({
 shop:name,topic:"APP_UNINSTALLED",webhookId:"ci-pg-uninstall-1",
 payload:{id:1234,myshopify_domain:name},
});
// CI-only synthetic independent generation attestor: this exercises the
// database/locking invariant, NOT real Shopify webhook freshness.
const syntheticCiAttestation=async({shop})=>shops.includes(shop);
const revoke=(name,at=uninstalledAt)=>revokeVerifiedWorkerShopifySessions({
 event:webhook(name),
 context:{database:db,verifyTrustedUninstallGeneration:syntheticCiAttestation},
 triggeredAt:at,
});
async function clearFixtures(){
 await db.session.deleteMany({where:{shop:{in:shops}}});
 await db.builderShopInstallation.deleteMany({where:{shop:{in:shops}}});
}
test.before(async()=>{await db.$connect();await clearFixtures()});
test.after(async()=>{try{await clearFixtures()}finally{await db.$disconnect()}});

test("PostgreSQL baseline migrated with real Session and installation tables",async()=>{
 assert.equal(await db.session.count({where:{shop:{in:shops}}}),0);
 assert.equal(await db.builderShopInstallation.count({where:{shop:{in:shops}}}),0);
});
test("actual official Shopify adapter atomically commits two isolated offline merchants",async()=>{
 assert.equal(await persist(shop,"first-ci-token"),true);
 assert.equal(await persist(other,"other-ci-token"),true);
 const [generation,first,second]=await Promise.all([
  db.builderShopInstallation.findUnique({where:{shop}}),
  db.session.findUnique({where:{id:"offline_"+shop}}),
  db.session.findUnique({where:{id:"offline_"+other}}),
 ]);
 assert.equal(generation.installedAt.toISOString(),installedAt.toISOString());
 assert.equal(generation.uninstalledAt,null);
 assert.equal(first.accessToken,"first-ci-token");
 assert.equal(second.accessToken,"other-ci-token");
});
test("real PostgreSQL sessions cannot be deleted using a signed body plus forged unsigned event header",async()=>{
 const response=await revokeVerifiedWorkerShopifySessions({
  event:webhook(shop),
  context:{database:db}, // real hosted SDK supplies no trusted proof
  triggeredAt:new Date("2030-01-01T00:00:00Z"),
 });
 assert.equal(response.status,503);
 assert.equal(await db.session.count({where:{shop}}),1);
 assert.equal((await db.builderShopInstallation.findUnique({where:{shop}})).uninstalledAt,null);
});
test("normal Shopify token rotation cannot rewrite PostgreSQL installation generation",async()=>{
 assert.equal(await persist(shop,"rotated-ci-token",PrismaSessionStorage,
  new Date("2026-10-13T10:30:00Z")),true);
 const row=await db.builderShopInstallation.findUnique({where:{shop}});
 assert.equal(row.installedAt.toISOString(),installedAt.toISOString());
 assert.equal((await db.session.findUnique({where:{id:"offline_"+shop}})).accessToken,"rotated-ci-token");
});
test("real PostgreSQL installation/session rows gate Shopify SDK authenticated app callback",async()=>{
 const expectedSession=await db.session.findUnique({where:{id:"offline_"+shop}});
 const e={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-admin-ci-secret",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_APP_URL:"https://staging.builder.example.org",
  SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://fake:test@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/fake?sslmode=require",
 };
 // Official SDK authenticate.admin is the only real authority. This mocked
 // authentication return intentionally tests solely DB lifecycle validation.
 const request=new Request(e.SHOPIFY_APP_URL+"/app?shop="+shop);
 let approved=0,closed=0;
 const context={
  database:db,
  shopify:{authenticate:{async admin(){
   return {session:{
    id:expectedSession.id,shop:expectedSession.shop,
    isOnline:expectedSession.isOnline,accessToken:expectedSession.accessToken,
   }};
  }}},
  async close(){closed++},
 };
 const response=await acceptWorkerShopifyAdminRequest(request,e,{
  createSdkContext:async()=>context,
  async onAuthenticated({shop:trustedShop}){
   approved++;
   assert.equal(trustedShop,shop);
   return new Response("trusted-merchant",{status:200});
  },
 });
 assert.equal(response.status,200);
 assert.equal(approved,1);
 assert.equal(closed,1);
 const forged=await acceptWorkerShopifyAdminRequest(
  new Request(e.SHOPIFY_APP_URL+"/app?shop="+other),e,{
   createSdkContext:async()=>context,
   async onAuthenticated(){throw Error("must not expose tenant")},
  }
 );
 assert.equal(forged.status,401);
 const revokedContext={
  ...context,
  shopify:{authenticate:{async admin(){
   return {session:{...expectedSession,accessToken:"forged-old-token"}};
  }}},
 };
 const old=await acceptWorkerShopifyAdminRequest(request,e,{
  createSdkContext:async()=>revokedContext,
  async onAuthenticated(){throw Error("stale token authorized")},
 });
 assert.equal(old.status,403);
});
test("uninstall updateMany waits for real PostgreSQL row lock before deleting only target tenant",async()=>{
 let grantLock;
 let signalLock;
 const acquired=new Promise(resolve=>{signalLock=resolve});
 const lockHeld=db.$transaction(async tx=>{
  await tx.builderShopInstallation.updateMany({
   where:{shop,uninstalledAt:null},
   data:{updatedAt:new Date("2026-10-13T10:40:00Z")},
  });
  signalLock();
  await new Promise(resolve=>{grantLock=resolve});
 },{timeout:8000,maxWait:5000});
 await acquired;
 let resolved=false;
 const uninstall=revoke(shop).then(result=>{resolved=true;return result});
 try {
  await sleep(130);
  assert.equal(resolved,false,"Uninstall cannot delete while installation row is locked");
 }finally{
  grantLock();
  await lockHeld;
 }
 const response=await uninstall;
 assert.equal(response.status,204);
 const [marker,remaining,otherSession]=await Promise.all([
  db.builderShopInstallation.findUnique({where:{shop}}),
  db.session.count({where:{shop}}),
  db.session.findUnique({where:{id:"offline_"+other}}),
 ]);
 assert.equal(marker.uninstalledAt.toISOString(),uninstalledAt.toISOString());
 assert.equal(marker.lastUninstallWebhookId,"ci-pg-uninstall-1");
 assert.equal(remaining,0);
 assert.equal(otherSession.accessToken,"other-ci-token");
});
test("replayed uninstall and old SDK write cannot revoke or reactivate new credentials",async()=>{
 assert.equal((await revoke(shop)).status,204);
 await assert.rejects(persist(shop,"resurrect-stale-token"),{
  code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
 });
 const marker=await db.builderShopInstallation.findUnique({where:{shop}});
 assert.equal(marker.uninstalledAt.toISOString(),uninstalledAt.toISOString());
 assert.equal(await db.session.count({where:{shop}}),0);
 assert.equal(await db.session.count({where:{shop:other}}),1);
});
test("actual PostgreSQL rollback undoes installation generation when official session write throws",async()=>{
 class RejectingStorage extends PrismaSessionStorage{
  async storeSession(){throw new Error("must-not-expose-private-postgresql-uri");}
 }
 await assert.rejects(persist(rollback,"rollback-token",RejectingStorage),err=>{
  assert.equal(err.code,"VSN_WORKER_INSTALL_SESSION_BLOCKED");
  assert(!err.message.includes("postgresql"));
  return true;
 });
 assert.equal(await db.builderShopInstallation.findUnique({where:{shop:rollback}}),null);
 assert.equal(await db.session.findUnique({where:{id:"offline_"+rollback}}),null);
});
test("concurrent SDK refresh and uninstall cannot leave valid session on revoked generation",async()=>{
 await persist(race,"old-race-token");
 const outcomes=await Promise.allSettled([
  persist(race,"fresh-race-token",PrismaSessionStorage,
   new Date("2026-10-13T10:30:00Z")),
  revoke(race),
 ]);
 assert.equal(outcomes[1].status,"fulfilled");
 assert.equal(outcomes[1].value.status,204);
 assert(outcomes[0].status==="fulfilled" ||
  (outcomes[0].status==="rejected" &&
   outcomes[0].reason?.code==="VSN_WORKER_INSTALL_SESSION_BLOCKED"));
 const [record,remaining]=await Promise.all([
  db.builderShopInstallation.findUnique({where:{shop:race}}),
  db.session.count({where:{shop:race}}),
 ]);
 assert.equal(record.uninstalledAt.toISOString(),uninstalledAt.toISOString());
 assert.equal(remaining,0,"No live session may survive a committed uninstall");
});
