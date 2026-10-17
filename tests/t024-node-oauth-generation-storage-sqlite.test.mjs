// Real Local/Node Shopify OAuth SessionStorage contract, disposable SQLite.
// SDK session reads/deletes are delegated to official PrismaSessionStorage.
// The intercepted storeSession must commit installation + session together.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PrismaClient} from "@prisma/client";
import {createNodeShopifyGenerationSessionStorage} from
  "../app/services/shopify-node-generation-session-storage.server.js";

const dbUrl="file:./t024-node-oauth-ci.sqlite";
assert.equal(process.env.CI,"true");
assert.equal(process.env.NODE_ENV,"test");
assert.equal(process.env.APP_ENV,"development");
assert.equal(process.env.DATABASE_URL,dbUrl);
for(const name of ["DIRECT_URL","NEON_API_KEY","CLOUDFLARE_API_TOKEN"]){
  assert(!process.env[name]);
}
const db=new PrismaClient();
const first="ci-t024-node-first.myshopify.com";
const orphan="ci-t024-node-orphan.myshopify.com";
const active="ci-t024-node-online.myshopify.com";
const concurrent="ci-t024-node-read-race.myshopify.com";
const loadRace="ci-t024-node-load-generation-race.myshopify.com";
const enumerateRace="ci-t024-node-enumeration-token-race.myshopify.com";
const names=[first,orphan,active,concurrent,loadRace,enumerateRace];
const initial=new Date("2026-10-17T04:00:00Z");
const updated=new Date("2026-10-17T06:00:00Z");
const offline=(shop,token="ci-token")=>({
 id:"offline_"+shop,shop,state:"",isOnline:false,scope:"read_products",
 accessToken:token,toObject(){return{}},
});
const online=(shop,token="ci-online")=>({
 id:"online_"+shop+"_123",shop,state:"",isOnline:true,scope:"read_products",
 accessToken:token,toObject(){return{}},
});
const storage=at=>createNodeShopifyGenerationSessionStorage(db,{clock:()=>at});
async function cleanup(){
 await db.session.deleteMany({where:{shop:{in:names}}});
 await db.builderShopInstallation.deleteMany({where:{shop:{in:names}}});
}
test.before(async()=>{await db.$connect();await cleanup()});
test.after(async()=>{try{await cleanup()}finally{await db.$disconnect()}});

test("actual Local/Node SDK wiring uses the safe generation storage factory",()=>{
 const src=readFileSync("app/shopify.server.js","utf8");
 assert.match(src,/sessionStorage: createNodeShopifyGenerationSessionStorage\(prisma\)/);
 assert.doesNotMatch(src,/sessionStorage:\s*new PrismaSessionStorage\(prisma\)/);
});
test("Node SDK's offline storeSession atomically creates original generation and actual session",async()=>{
 const adapter=storage(initial);
 assert.equal(await adapter.isReady(),true);
 assert.equal(await adapter.storeSession(offline(first)),true);
 const row=await db.builderShopInstallation.findUnique({where:{shop:first}});
 const saved=await adapter.loadSession("offline_"+first);
 assert.equal(row.installedAt.toISOString(),initial.toISOString());
 assert.equal(row.uninstalledAt,null);
 assert.equal(saved.shop,first);
 assert.equal(saved.accessToken,"ci-token");
 assert.equal((await adapter.findSessionsByShop(first)).length,1);
});
test("SDK token rotation doesn't forge second install generation",async()=>{
 assert.equal(await storage(updated).storeSession(offline(first,"rotated-ci-token")),true);
 const row=await db.builderShopInstallation.findUnique({where:{shop:first}});
 assert.equal(row.installedAt.toISOString(),initial.toISOString());
 assert.equal((await storage(updated).loadSession("offline_"+first)).accessToken,"rotated-ci-token");
});
test("Node online access tokens require active generation before SDK persistence",async()=>{
 await assert.rejects(storage(initial).storeSession(online(active)),{
   code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
 });
 assert.equal(await storage(initial).storeSession(offline(active)),true);
 assert.equal(await storage(updated).storeSession(online(active)),true);
 const got=await db.session.findUnique({where:{id:"online_"+active+"_123"}});
 assert.equal(got.accessToken,"ci-online");
});
test("SDK can't resurrect or rotate a token after installation was uninstalled",async()=>{
 await db.builderShopInstallation.update({
   where:{shop:first},data:{uninstalledAt:updated},
 });
 for(const token of ["rotated-ci-token","another-ci-token"]){
  await assert.rejects(storage(updated).storeSession(offline(first,token)),{
    code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
  });
 }
 await assert.rejects(storage(updated).storeSession(online(first)),{
   code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
 });
 const row=await db.builderShopInstallation.findUnique({where:{shop:first}});
 assert.equal(row.installedAt.getTime(),initial.getTime());
 assert.equal(row.uninstalledAt.getTime(),updated.getTime());
 assert.equal((await db.session.findUnique({where:{id:"offline_"+first}})).accessToken,
   "rotated-ci-token");
 const blocked=storage(updated);
 assert.equal(await blocked.loadSession("offline_"+first),undefined,
   "SDK may not reuse a stale session after uninstall");
 assert.deepEqual(await blocked.findSessionsByShop(first),[],
   "SDK may not enumerate sessions for an uninstalled shop");
 assert.equal(await db.session.count({where:{shop:first}}),1,
   "The deny is a read fence, not unverified destructive deletion");
});
test("an orphan old token never creates a fabricated install generation",async()=>{
 await db.session.create({data:{
   id:"offline_"+orphan,shop:orphan,state:"",isOnline:false,accessToken:"preexisting-ci",
 }});
 await assert.rejects(storage(initial).storeSession(offline(orphan,"unauthorized-new")),{
   code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
 });
 assert.equal(await db.builderShopInstallation.findUnique({where:{shop:orphan}}),null);
 assert.equal((await db.session.findUnique({where:{id:"offline_"+orphan}})).accessToken,
   "preexisting-ci");
 assert.equal(await storage(initial).loadSession("offline_"+orphan),undefined,
   "Orphaned token cannot authenticate a shop without provenance");
 assert.deepEqual(await storage(initial).findSessionsByShop(orphan),[]);
});
test("uninstall during SDK session enumeration never returns a stale token",async()=>{
 const session=offline(concurrent,"race-ci-token");
 assert.equal(await storage(initial).storeSession(session),true);
 class RevokeDuringReadStorage {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(){return undefined}
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(shop){
     // Simulate the uninstall committing after the initial active check,
     // while Shopify's official SDK session query is still pending.
     await db.builderShopInstallation.update({
       where:{shop},data:{uninstalledAt:updated},
     });
     return [session];
   }
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:RevokeDuringReadStorage,
 });
 assert.deepEqual(await guarded.findSessionsByShop(concurrent),[]);
 assert.equal((await db.session.findUnique({where:{id:session.id}})).accessToken,
   "race-ci-token","The read fence must not delete or mutate sessions");
 assert.equal((await db.builderShopInstallation.findUnique({
   where:{shop:concurrent},
 })).uninstalledAt.toISOString(),updated.toISOString());
});
test("official SDK deletion methods remain delegated, without forging a new generation",async()=>{
 const adapter=storage(updated);
 assert.equal(await adapter.deleteSession("online_"+active+"_123"),true);
 assert.equal(await adapter.loadSession("online_"+active+"_123"),undefined);
 assert.equal((await db.builderShopInstallation.findUnique({
   where:{shop:active},
 })).uninstalledAt,null);
});

test("Node loadSession denies an older offline token if generation changes during SDK await",async()=>{
 const old=offline(loadRace,"read-before-install-race");
 assert.equal(await storage(initial).storeSession(old),true);
 class ReinstallDuringLoadStorage {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(id){
     assert.equal(id,old.id);
     // Simulate official SDK loading a token while an independent install
     // transaction advances the generation. Do not forge an installation.
     await db.builderShopInstallation.update({
       where:{shop:loadRace},data:{installedAt:updated},
     });
     return old;
   }
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(){return []}
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:ReinstallDuringLoadStorage,
 });
 assert.equal(await guarded.loadSession(old.id),undefined);
 assert.equal((await db.session.findUnique({where:{id:old.id}})).accessToken,
   "read-before-install-race","An unsafe read must never mutate a session");
});
test("Node loadSession denies stale credentials if persisted token rotates mid-read",async()=>{
 const current=offline(loadRace,"token-before-rotation");
 await db.builderShopInstallation.update({
   where:{shop:loadRace},data:{installedAt:initial},
 });
 assert.equal(await storage(initial).storeSession(current),true);
 class RotateWhileLoadStorage {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(id){
     assert.equal(id,current.id);
     await db.session.update({
       where:{id},data:{accessToken:"token-after-rotation"},
     });
     return current;
   }
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(){return []}
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:RotateWhileLoadStorage,
 });
 assert.equal(await guarded.loadSession(current.id),undefined);
 assert.equal((await db.session.findUnique({where:{id:current.id}})).accessToken,
   "token-after-rotation");
});
test("Node findSessionsByShop refuses stale results after install-generation changes",async()=>{
 await db.builderShopInstallation.update({
   where:{shop:loadRace},data:{installedAt:initial},
 });
 class ReinstallDuringEnumerationStorage {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(){return undefined}
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(shop){
     await db.builderShopInstallation.update({
       where:{shop},data:{installedAt:updated},
     });
     return [offline(shop,"outdated-enumeration-token")];
   }
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:ReinstallDuringEnumerationStorage,
 });
 assert.deepEqual(await guarded.findSessionsByShop(loadRace),[]);
});

test("Node enumeration denies stale sessions after persisted token rotation without a generation change",async()=>{
 const stale=offline(enumerateRace,"enumeration-stale-token");
 assert.equal(await storage(initial).storeSession(stale),true);
 class RotateDuringEnumeration {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(){return undefined}
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(shop){
     await db.session.update({
       where:{id:stale.id},data:{accessToken:"enumeration-current-token"},
     });
     return [stale];
   }
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:RotateDuringEnumeration,
 });
 assert.deepEqual(await guarded.findSessionsByShop(enumerateRace),[]);
 assert.equal((await db.builderShopInstallation.findUnique({
   where:{shop:enumerateRace},
 })).installedAt.toISOString(),initial.toISOString(),
 "Token rotation did not advance installation generation");
 assert.equal((await db.session.findUnique({where:{id:stale.id}})).accessToken,
   "enumeration-current-token");
 const current=await storage(updated).findSessionsByShop(enumerateRace);
 assert.equal(current.length,1);
 assert.equal(current[0].accessToken,"enumeration-current-token");
});
test("Node enumeration denies an SDK session deleted during its asynchronous read",async()=>{
 const original=offline(enumerateRace,"token-for-deleted-session");
 assert.equal(await storage(updated).storeSession(original),true);
 class DeleteDuringEnumeration {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(){return undefined}
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(shop){
     await db.session.delete({where:{id:original.id}});
     return [original];
   }
 }
 const guarded=createNodeShopifyGenerationSessionStorage(db,{
   SessionStorage:DeleteDuringEnumeration,
 });
 assert.deepEqual(await guarded.findSessionsByShop(enumerateRace),[]);
 assert.equal(await db.session.findUnique({where:{id:original.id}}),null);
 assert.deepEqual(await storage(updated).findSessionsByShop(enumerateRace),[]);
});
test("Node enumeration rejects SDK-injected or duplicate credentials not persisted for this shop",async()=>{
 assert.equal(await storage(updated).storeSession(offline(enumerateRace,"real-token")),true);
 const stored=offline(enumerateRace,"real-token");
 class ForgedEnumeration {
   async isReady(){return true}
   async storeSession(){return true}
   async loadSession(){return undefined}
   async deleteSession(){return true}
   async deleteSessions(){return true}
   async findSessionsByShop(){return [stored,{...stored,id:"unpersisted-online"}]}
 }
 class DuplicateEnumeration extends ForgedEnumeration {
   async findSessionsByShop(){return [stored,stored]}
 }
 for(const SessionStorage of [ForgedEnumeration,DuplicateEnumeration]){
   const guarded=createNodeShopifyGenerationSessionStorage(db,{SessionStorage});
   assert.deepEqual(await guarded.findSessionsByShop(enumerateRace),[]);
 }
 assert.equal((await db.session.findUnique({where:{id:stored.id}})).accessToken,
   "real-token");
});
