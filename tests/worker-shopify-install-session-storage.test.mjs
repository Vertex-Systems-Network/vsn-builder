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
 for(const bad of [
  {...data,id:"unverified-offline-id"},
  {...data,shop:"invalid.example.net"},
  {...data,accessToken:""},
  {...data,isOnline:"no"},
  {...online(),id:"offline_"+shop},
 ])await assert.rejects(
  persistWorkerShopifySessionWithGeneration(bad,database().client,{SessionStorage:PrismaSessionStorage}),
  {code:"VSN_WORKER_INSTALL_SESSION_BLOCKED"}
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
