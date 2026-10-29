import test from "node:test";
import assert from "node:assert/strict";
import {PrismaSessionStorage} from "@shopify/shopify-app-session-storage-prisma";
import {
  createWorkerGenerationSessionStorage,
  persistWorkerShopifySessionWithGeneration,
} from "../app/services/worker-shopify-install-session-storage.js";

const shop="one.myshopify.com";
const offline=(accessToken="synthetic-token-1",other=shop)=>({
  id:`offline_${other}`,shop:other,state:"",isOnline:false,scope:"read_products",
  accessToken,toObject(){return {}} ,
});
const online=(other=shop)=>({
  id:`online_${other}_17`,shop:other,state:"",isOnline:true,
  accessToken:"synthetic-online-token",toObject(){return {}},
});
const date=iso=>new Date(iso);
const baseTime=date("2026-10-13T10:00:00.000Z");
function database(){
  let lifecycle=new Map();
  let sessions=new Map();
  let rollbackCount=0;
  let failWrites=false;
  const calls=[];
  let locked=Promise.resolve();
  const client={
    // The transaction below is a separate snapshot; these public readers
    // model the actual Prisma delegates consumed by Shopify's SDK wrapper.
    builderShopInstallation:{
      async findUnique({where}){
        const row=lifecycle.get(where.shop);
        return row?{...row}:null;
      },
    },
    session:{
      async findUnique({where}){
        const row=sessions.get(where.id);
        return row?{...row}:null;
      },
      async findMany({where}){
        return [...sessions.values()].filter(row=>row.shop===where.shop)
          .map(row=>({...row}));
      },
    },
    async $transaction(fn){
      let release;
      const previous=locked;
      locked=new Promise(resolve=>{release=resolve});
      await previous;
      const state=new Map([...lifecycle].map(([k,v])=>[k,{...v}]));
      const rows=new Map([...sessions].map(([k,v])=>[k,{...v}]));
      const tx={
        builderShopInstallation:{
          async upsert({where,create,update}){
            calls.push("generation:upsert");
            const old=state.get(where.shop);
            const row=old?{...old,...update}:{...create,updatedAt:baseTime};
            state.set(where.shop,row);return {...row};
          },
          async updateMany({where,data}){
            calls.push("generation:updateMany");
            const row=state.get(where.shop);
            if(!row)return {count:0};
            if(Object.hasOwn(where,"uninstalledAt") && row.uninstalledAt!==where.uninstalledAt)return {count:0};
            state.set(where.shop,{...row,...data});return {count:1};
          },
          async findUnique({where}){const row=state.get(where.shop);return row?{...row}:null},
        },
        session:{
          async count(){return rows.size},
          async upsert({where,update,create}){
            calls.push("session:upsert");
            if(failWrites)throw Error("private://db-test-password");
            rows.set(where.id,rows.has(where.id)?{...update}:{...create});
            return {...rows.get(where.id)};
          },
          async findUnique({where}){return rows.get(where.id)||null},
          async delete({where}){
            calls.push("session:delete");
            const row=rows.get(where.id);
            if(!row)throw Error("missing session");
            rows.delete(where.id);return {...row};
          },
        },
      };
      try {
        const result=await fn(tx);
        lifecycle=state;sessions=rows;return result;
      }catch(e){rollbackCount++;throw e;}
      finally{release()}
    },
  };
  return {
    client,calls,
    get lifecycle(){return lifecycle},
    get sessions(){return sessions},
    get rollbackCount(){return rollbackCount},
    set failWrites(v){failWrites=v},
  };
}
const persist=(session,fixture,at=baseTime)=>
  persistWorkerShopifySessionWithGeneration(session,fixture.client,{
    SessionStorage:PrismaSessionStorage,clock:()=>at,
  });

test("real Shopify Prisma adapter commits offline session and generation in one transaction",async()=>{
 const fx=database();
 assert.equal(await persist(offline(),fx),true);
 assert.equal(fx.lifecycle.get(shop).uninstalledAt,null);
 assert(fx.lifecycle.get(shop).installedAt instanceof Date);
 assert.equal(fx.sessions.get("offline_"+shop).accessToken,"synthetic-token-1");
 assert(fx.calls.indexOf("generation:upsert")<fx.calls.indexOf("session:upsert"));
});
test("same-token offline refresh never advances install generation",async()=>{
 const fx=database();
 await persist(offline(),fx);
 const first=fx.lifecycle.get(shop).installedAt.getTime();
 await persist(offline(),fx,date("2026-10-13T11:00:00.000Z"));
 assert.equal(fx.lifecycle.get(shop).installedAt.getTime(),first);
});
test("token rotation updates official token but DOES NOT counterfeit installation generation",async()=>{
 const fx=database();
 await persist(offline(),fx);
 await persist(offline("another-shop-token","two.myshopify.com"),fx);
 const previous=fx.lifecycle.get(shop).installedAt.getTime();
 await persist(offline("rotated-token"),fx,date("2026-10-13T12:00:00.000Z"));
 assert.equal(fx.lifecycle.get(shop).installedAt.getTime(),previous);
 assert.equal(fx.sessions.get("offline_"+shop).accessToken,"rotated-token");
 assert.equal(fx.sessions.get("offline_two.myshopify.com").accessToken,"another-shop-token");
});
test("SDK token invalidation safely deletes its persisted session",async()=>{
 const fx=database();await persist(offline(),fx);
 const session=offline();
 const base={
  async loadSession(){return session},
  async findSessionsByShop(){return [session]},
  async deleteSession(){return true},async deleteSessions(){return true},
  async isReady(){return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,base,{
  SessionStorage:PrismaSessionStorage,clock:()=>baseTime,
 });
 const loaded=await safe.loadSession(session.id);
 assert.equal(loaded.accessToken,"synthetic-token-1");
 loaded.accessToken=undefined; // Shopify SDK clears this after Admin API rejects it.
 assert.equal(await safe.storeSession(loaded),true);
 assert.equal(fx.sessions.has(session.id),false);
 assert(fx.calls.includes("session:delete"));
});
test("stale SDK token invalidation cannot delete a concurrently rotated token",async()=>{
 const fx=database();await persist(offline(),fx);
 const session=offline();
 const base={
  async loadSession(){return session},
  async findSessionsByShop(){return [session]},
  async deleteSession(){return true},async deleteSessions(){return true},
  async isReady(){return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,base,{
  SessionStorage:PrismaSessionStorage,clock:()=>baseTime,
 });
 const loaded=await safe.loadSession(session.id);
 fx.sessions.get(session.id).accessToken="concurrently-rotated-token";
 loaded.accessToken=undefined;
 assert.equal(await safe.storeSession(loaded),true);
 assert.equal(fx.sessions.get(session.id).accessToken,"concurrently-rotated-token");
 assert(!fx.calls.includes("session:delete"));
});
test("old SDK storeSession cannot resurrect an uninstalled shop",async()=>{
 const fx=database();
 await persist(offline(),fx);
 const uninstallDate=date("2026-10-13T11:00:00.000Z");
 fx.lifecycle.get(shop).uninstalledAt=uninstallDate;
 const original=fx.lifecycle.get(shop).installedAt.getTime();
 for(const token of ["synthetic-token-1","rotated-after-uninstall"]){
  await assert.rejects(persist(offline(token),fx,date("2026-10-13T12:00:00.000Z")),
   {code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"});
 }
 assert.equal(fx.lifecycle.get(shop).uninstalledAt,uninstallDate);
 assert.equal(fx.lifecycle.get(shop).installedAt.getTime(),original);
 assert.equal(fx.sessions.get("offline_"+shop).accessToken,"synthetic-token-1");
 assert.equal(fx.rollbackCount,2);
});
test("existing orphaned offline sessions require separately verified installation migration",async()=>{
 const fx=database();
 await persist(offline(),fx);
 fx.lifecycle.delete(shop);
 await assert.rejects(persist(offline("cannot-bootstrap-orphan"),fx),
  {code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"});
 assert.equal(fx.lifecycle.size,0);
 assert.equal(fx.sessions.get("offline_"+shop).accessToken,"synthetic-token-1");
});
test("official online session is blocked without an active installed shop row",async()=>{
 const fx=database();
 await assert.rejects(persist(online(),fx),{code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"});
 assert.equal(fx.sessions.size,0);
 await persist(offline(),fx);
 assert.equal(await persist(online(),fx),true);
 fx.lifecycle.get(shop).uninstalledAt=date("2026-10-13T13:00:00.000Z");
 await assert.rejects(persist(online(),fx),{code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"});
});
test("failing official session write rolls back newly created installation record",async()=>{
 const fx=database();fx.failWrites=true;
 await assert.rejects(persist(offline("secret-t0ken"),fx),error=>{
  assert.equal(error.code,"VSN_WORKER_INSTALL_SESSION_BLOCKED");
  assert(!String(error.message).includes("secret-t0ken"));
  assert(!String(error.message).includes("private://"));
  return true;
 });
 assert.equal(fx.lifecycle.size,0);
 assert.equal(fx.sessions.size,0);
 assert.equal(fx.rollbackCount,1);
});
test("session failures are blocked without a valid transactional installation model",async()=>{
 const data=offline();
 for(const bad of [
  null,
  {},
  {$transaction:async(fn)=>fn({session:{count(){},upsert(){},findUnique(){}}})},
 ])await assert.rejects(
  persistWorkerShopifySessionWithGeneration(data,bad,{SessionStorage:PrismaSessionStorage}),
  {code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"}
 );
 for(const [bad,safeReason] of [
  [{...data,id:"unverified-offline-id"},"offline-session-id-mismatch"],
  [{...data,shop:"invalid.example.net"},"invalid-session-shop"],
  [{...data,accessToken:""},"invalid-session-access-token"],
  [{...data,accessToken:undefined},"invalid-session-access-token"],
  [{...data,isOnline:"no"},"invalid-session-online-flag"],
  [{...online(),id:"offline_"+shop},"online-session-id-offline-format"],
 ])await assert.rejects(
  persistWorkerShopifySessionWithGeneration(bad,database().client,{SessionStorage:PrismaSessionStorage}),
  error=>error.code==="VSN_WORKER_INSTALL_SESSION_BLOCKED"&&error.safeReason===safeReason
 );
 await assert.rejects(
  persistWorkerShopifySessionWithGeneration(data,{...database().client,$transaction:null},{SessionStorage:PrismaSessionStorage}),
  error=>error.code==="VSN_WORKER_INSTALL_SESSION_BLOCKED"&&error.safeReason==="invalid-session-transaction"
 );
});
test("SDK storage wrapper intercepts writes and delegates reads/deletes to official storage",async()=>{
 const fx=database();
 const hit=[];
 const parent={
  async loadSession(x){hit.push(["loadSession",x]);return undefined},
  async deleteSession(x){hit.push(["deleteSession",x]);return true},
  async deleteSessions(x){hit.push(["deleteSessions",x]);return true},
  async findSessionsByShop(x){hit.push(["findSessionsByShop",x]);return []},
  async isReady(){hit.push(["isReady"]);return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,parent,{
  SessionStorage:PrismaSessionStorage,clock:()=>baseTime,
 });
 assert.equal(await safe.storeSession(offline()),true);
 assert.equal(await safe.loadSession("offline_"+shop),undefined);
 assert.equal(await safe.deleteSession("x"),true);
 assert.equal(await safe.deleteSessions(["x"]),true);
 assert.deepEqual(await safe.findSessionsByShop(shop),[]);
 assert.equal(await safe.isReady(),true);
 assert.equal(hit.length,5);
});

test("Worker SDK loadSession checks persisted credentials and active generation before returning",async()=>{
 const fx=database();
 await persist(offline(),fx);
 const calls=[];
 const base={
  async loadSession(id){calls.push(id);return offline()},
  async findSessionsByShop(){return [offline()]},
  async deleteSession(){return true},
  async deleteSessions(){return true},
  async isReady(){return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,base,{
  SessionStorage:PrismaSessionStorage,
 });
 assert.equal((await safe.loadSession("offline_"+shop)).accessToken,"synthetic-token-1");
 assert.equal((await safe.findSessionsByShop(shop)).length,1);
 fx.lifecycle.get(shop).uninstalledAt=date("2026-10-13T11:00:00.000Z");
 assert.equal(await safe.loadSession("offline_"+shop),undefined);
 assert.deepEqual(await safe.findSessionsByShop(shop),[]);
 assert.equal(calls.length,1,"uninstalled shop must not invoke Shopify's SDK loader");
 assert.equal(fx.sessions.size,1,"read-only rejection must never delete sessions");
});

test("Worker SDK loadSession denies token rotation and reinstall while official SDK awaits",async()=>{
 for(const change of ["rotated-token","new-generation","removed-session"]){
  const fx=database();
  await persist(offline(),fx);
  const base={
   async loadSession(){
    if(change==="rotated-token")fx.sessions.get("offline_"+shop).accessToken="new-token";
    if(change==="new-generation")
      fx.lifecycle.get(shop).installedAt=date("2026-10-13T11:00:00.000Z");
    if(change==="removed-session")fx.sessions.delete("offline_"+shop);
    return offline();
   },
   async findSessionsByShop(){return []},
   async deleteSession(){return true},async deleteSessions(){return true},
   async isReady(){return true},
  };
  const safe=createWorkerGenerationSessionStorage(fx.client,base,{
   SessionStorage:PrismaSessionStorage,
  });
  assert.equal(await safe.loadSession("offline_"+shop),undefined,change);
 }
});

test("Worker SDK enumeration denies deleted/rotated/forged and duplicated tokens",async()=>{
 for(const change of ["rotation","deleted","reinstalled","forged","duplicate"]){
  const fx=database();await persist(offline(),fx);
  const session=offline();
  const base={
   async loadSession(){return session},
   async findSessionsByShop(){
    if(change==="rotation")fx.sessions.get(session.id).accessToken="other-token";
    if(change==="deleted")fx.sessions.delete(session.id);
    if(change==="reinstalled")
      fx.lifecycle.get(shop).installedAt=date("2026-10-13T11:00:00.000Z");
    if(change==="forged")return [session,{...session,id:"fake-session-id"}];
    if(change==="duplicate")return [session,session];
    return [session];
   },
   async deleteSession(){return true},async deleteSessions(){return true},
   async isReady(){return true},
  };
  const safe=createWorkerGenerationSessionStorage(fx.client,base,{
   SessionStorage:PrismaSessionStorage,
  });
  assert.deepEqual(await safe.findSessionsByShop(shop),[],change);
 }
});

test("Worker SDK read fence rejects orphan, expired, invalid-domain and stale credentials",async()=>{
 const fx=database();await persist(offline(),fx);
 const base={
  async loadSession(){return offline()},
  async findSessionsByShop(){return [offline()]},
  async deleteSession(){return true},async deleteSessions(){return true},
  async isReady(){return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,base,{
  SessionStorage:PrismaSessionStorage,
 });
 assert.equal(await safe.loadSession(""),undefined);
 assert.deepEqual(await safe.findSessionsByShop("shop.example.net"),[]);
 fx.sessions.get("offline_"+shop).expires=date("2020-01-01T00:00:00.000Z");
 assert.equal(await safe.loadSession("offline_"+shop),undefined);
 await assert.rejects(safe.findSessionsByShop(shop),{
  code:"VSN_WORKER_SESSION_READ_BLOCKED",
 });
 fx.sessions.get("offline_"+shop).expires=null;
 fx.lifecycle.delete(shop);
 assert.equal(await safe.loadSession("offline_"+shop),undefined);
 assert.deepEqual(await safe.findSessionsByShop(shop),[]);
});

test("Worker SDK read query errors are sanitized and never expose Neon or tokens",async()=>{
 const fx=database();await persist(offline(),fx);
 fx.client.session.findUnique=async()=>{throw Error("postgresql://private-password@secret-host")};
 const safe=createWorkerGenerationSessionStorage(fx.client,{
  async loadSession(){throw Error("SDK should not be invoked")},
  async findSessionsByShop(){return []},
  async deleteSession(){return true},async deleteSessions(){return true},
  async isReady(){return true},
 },{SessionStorage:PrismaSessionStorage});
 await assert.rejects(safe.loadSession("offline_"+shop),error=>{
  assert.equal(error.code,"VSN_WORKER_SESSION_READ_BLOCKED");
  assert(!error.message.includes("private-password"));
  return true;
 });
});
test("an expired offline token with a live refresh token still loads so the SDK can refresh it",async()=>{
 const fx=database();await persist(offline(),fx);
 const row=fx.sessions.get("offline_"+shop);
 row.expires=date("2020-01-01T00:00:00.000Z");
 const session={...offline(),expires:row.expires};
 const base={
  async loadSession(){return session},async findSessionsByShop(){return [session]},
  async deleteSession(){return true},async deleteSessions(){return true},async isReady(){return true},
 };
 const safe=createWorkerGenerationSessionStorage(fx.client,base,{SessionStorage:PrismaSessionStorage,clock:()=>baseTime});
 assert.equal(await safe.loadSession(session.id),undefined,"no refresh token: stays rejected");
 row.refreshToken="synthetic-refresh";row.refreshTokenExpires=date("2999-01-01T00:00:00.000Z");
 assert.equal((await safe.loadSession(session.id))?.accessToken,"synthetic-token-1");
 row.refreshTokenExpires=date("2020-01-02T00:00:00.000Z");
 assert.equal(await safe.loadSession(session.id),undefined,"expired refresh token: rejected");
});
