import test from "node:test";
import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {PrismaSessionStorage} from "@shopify/shopify-app-session-storage-prisma";
import {persistWorkerShopifySessionWithGeneration}
 from "../app/services/worker-shopify-install-session-storage.js";

// Local disposable SQLite ONLY. Never run these tests against Neon or any
// remote PostgreSQL URL, even when the caller sets NODE_ENV=test.
const dbUrl=String(process.env.DATABASE_URL||"");
assert.equal(process.env.CI,"true","CI-only isolated database acceptance");
assert.equal(process.env.NODE_ENV,"test","Test-only persistence acceptance");
assert(/^file:\.\/worker-install-fence-ci\.sqlite$/.test(dbUrl),"Must use isolated disposable SQLite URL");
const database=new PrismaClient();
const firstShop="ci-real-sqlite-install.myshopify.com";
const rollbackShop="ci-real-sqlite-rollback.myshopify.com";
const now=new Date("2026-10-13T10:00:00Z");
const token=(shop,id="test-token")=>({
 id:"offline_"+shop,shop,state:"",isOnline:false,
 scope:"read_products",accessToken:id,
 toObject(){return {}},
});
const write=(shop,value="test-token",at=now,Storage=PrismaSessionStorage)=>
 persistWorkerShopifySessionWithGeneration(token(shop,value),database,{
  SessionStorage:Storage,clock:()=>at,
 });
async function cleanup(){
 await database.session.deleteMany({where:{shop:{in:[firstShop,rollbackShop]}}});
 await database.builderShopInstallation.deleteMany({where:{shop:{in:[firstShop,rollbackShop]}}});
}
test.before(cleanup);
test.after(async()=>{try{await cleanup()}finally{await database.$disconnect()}});

test("real SQLite Prisma transaction commits official SDK offline session + generation together",async()=>{
 assert.equal(await write(firstShop),true);
 const install=await database.builderShopInstallation.findUnique({where:{shop:firstShop}});
 const saved=await database.session.findUnique({where:{id:"offline_"+firstShop}});
 assert.equal(install.shop,firstShop);
 assert.equal(install.installedAt.toISOString(),now.toISOString());
 assert.equal(install.uninstalledAt,null);
 assert.equal(saved.accessToken,"test-token");
 assert.equal(saved.shop,firstShop);
});
test("real SQLite token rotation cannot advance or forge an installation generation",async()=>{
 await write(firstShop,"rotated-auth-token",new Date("2026-10-13T12:00:00Z"));
 const install=await database.builderShopInstallation.findUnique({where:{shop:firstShop}});
 const saved=await database.session.findUnique({where:{id:"offline_"+firstShop}});
 assert.equal(install.installedAt.toISOString(),now.toISOString());
 assert.equal(saved.accessToken,"rotated-auth-token");
});
test("old offline session write after uninstall is blocked and rolls back in real SQLite",async()=>{
 const at=new Date("2026-10-13T13:00:00Z");
 await database.builderShopInstallation.update({where:{shop:firstShop},data:{uninstalledAt:at}});
 for(const value of ["rotated-auth-token","different-token"]){
  await assert.rejects(write(firstShop,value,new Date("2026-10-13T14:00:00Z")),{
   code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
  });
 }
 const lifecycle=await database.builderShopInstallation.findUnique({where:{shop:firstShop}});
 const saved=await database.session.findUnique({where:{id:"offline_"+firstShop}});
 assert.equal(lifecycle.uninstalledAt.toISOString(),at.toISOString());
 assert.equal(lifecycle.installedAt.toISOString(),now.toISOString());
 assert.equal(saved.accessToken,"rotated-auth-token");
});
test("SQLite transaction rolls back newly created generation on session write failure",async()=>{
 class FailingSessionStorage extends PrismaSessionStorage {
  async storeSession(){throw new Error("postgresql://should-never-appear-secret");}
 }
 await assert.rejects(write(rollbackShop,"rollback-test",now,FailingSessionStorage),error=>{
  assert.equal(error.code,"VSN_WORKER_INSTALL_SESSION_BLOCKED");
  assert(!error.message.includes("secret"));
  return true;
 });
 assert.equal(await database.builderShopInstallation.findUnique({where:{shop:rollbackShop}}),null);
 assert.equal(await database.session.findUnique({where:{id:"offline_"+rollbackShop}}),null);
});
test("an orphaned persisted session cannot cause a new installation generation",async()=>{
 await database.session.create({
  data:{id:"offline_"+rollbackShop,shop:rollbackShop,state:"",
   isOnline:false,accessToken:"orphan-existing-token"},
 });
 await assert.rejects(write(rollbackShop,"new-token"),{
  code:"VSN_WORKER_INSTALL_SESSION_BLOCKED",
 });
 assert.equal(await database.builderShopInstallation.findUnique({where:{shop:rollbackShop}}),null);
 const row=await database.session.findUnique({where:{id:"offline_"+rollbackShop}});
 assert.equal(row.accessToken,"orphan-existing-token");
});
