import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {isVerifiedShopRedactEvent} from "../app/services/shopify-shop-redact-guard.js";
import {deleteVsnShopDataAfterVerifiedRedaction} from "../app/services/shop-data-lifecycle.server.js";

const shop="vsn-redact-ci.myshopify.com";
const ok=()=>({
  topic:"SHOP_REDACT",shop,
  payload:{shop_domain:shop,shop_id:"123456789012345678"},
});
test("mandatory GDPR verifier binds Shopify SDK topic, canonical tenant and original shop ID",()=>{
 assert.equal(isVerifiedShopRedactEvent(ok()),true);
 assert.equal(isVerifiedShopRedactEvent({...ok(),payload:{shop_domain:shop,shop_id:42}}),true);
 const wrong=[
  null,{},[],{...ok(),topic:"APP_UNINSTALLED"},
  {...ok(),topic:"CUSTOMERS_REDACT"},
  {...ok(),shop:"OTHER.myshopify.com"},
  {...ok(),shop:"evil.example.com"},
  {...ok(),shop:"-x.myshopify.com"},
  {...ok(),shop:"a".repeat(65)+".myshopify.com"},
  {...ok(),payload:null},
  {...ok(),payload:[]},
  {...ok(),payload:{shop_id:1}},
  {...ok(),payload:{shop_domain:"different.myshopify.com",shop_id:1}},
  {...ok(),payload:{shop_domain:shop,shop_id:0}},
  {...ok(),payload:{shop_domain:shop,shop_id:Infinity}},
  {...ok(),payload:{shop_domain:shop,shop_id:Number.MAX_SAFE_INTEGER+1}},
  {...ok(),payload:{shop_domain:shop,shop_id:"1e4"}},
  {...ok(),payload:{shop_domain:shop,shop_id:"000123"}},
 ];
 for(const event of wrong)
  assert.equal(isVerifiedShopRedactEvent(event),false,JSON.stringify(event));
});
function fakeDb({claimed=1,failedDelete=null}={}){
 const state={events:[],committed:0,rolledBack:0};
 const tx=new Proxy({
  builderShopInstallation:{
   async updateMany(query){
    state.events.push({type:"claim",query});
    return {count:claimed};
   }
  },
 },{
  get(target,key){
   if(key in target)return target[key];
   // PrismaPromise is lazy: construct the delete then execute on await,
   // ensuring an intentional failed delete never creates an unhandled promise.
   return {deleteMany:query=>({
     then(resolve,reject){
       try{
         assert.equal(query.where.shop,shop);
         assert.equal(state.events[0]?.type,"claim","purge before installation lock");
         state.events.push({type:"delete",table:String(key),query});
         if(failedDelete===String(key))throw Error("synthetic-postgres://secret");
         resolve({count:1});
       }catch(error){reject(error)}
     }
   })};
  },
 });
 const db={
   async $transaction(cb,opts){
    assert.equal(typeof cb,"function");
    assert.equal(opts.timeout,60000);
    try{
     const outcome=await cb(tx);state.committed++;return outcome;
    }catch(err){state.rolledBack++;throw err;}
   }
 };
 return {db,state};
}
test("redaction cleanup locks inactive generation and deletes only same shop in one transaction",async()=>{
 const {db,state}=fakeDb();
 assert.deepEqual(await deleteVsnShopDataAfterVerifiedRedaction(db,shop),{deleted:true});
 assert.equal(state.committed,1);
 assert.equal(state.rolledBack,0);
 assert.deepEqual(state.events[0].query.where,{shop,uninstalledAt:{not:null}});
 assert.equal(state.events[0].query.data.updatedAt instanceof Date,true);
 assert(state.events.filter(x=>x.type==="delete").length>=35);
 assert(state.events.some(x=>x.type==="delete"&&x.table==="session"));
 assert(!state.events.some(x=>x.type==="delete"&&x.table==="builderShopInstallation"));
});
test("live reinstall or absent generation atomically denies every data delete",async()=>{
 for(const claimed of [0,2,null]){
  const {db,state}=fakeDb({claimed});
  await assert.rejects(deleteVsnShopDataAfterVerifiedRedaction(db,shop),{
    code:"T024_SHOP_REDACT_GENERATION_NOT_VERIFIED",
  });
  assert.equal(state.events.filter(e=>e.type==="delete").length,0);
  assert.equal(state.committed,0);
  assert.equal(state.rolledBack,1);
 }
});
test("failed mid-purge rejects, sanitizes driver and instructs outer database to rollback",async()=>{
 const {db,state}=fakeDb({failedDelete:"builderRequestLog"});
 await assert.rejects(deleteVsnShopDataAfterVerifiedRedaction(db,shop),
  err=>err.code==="T024_SHOP_REDACT_GENERATION_NOT_VERIFIED" &&
  !err.message.includes("postgres"));
 assert.equal(state.committed,0);
 assert.equal(state.rolledBack,1);
});
test("cross-tenant and malformed shop names never reach transaction",async()=>{
 const {db,state}=fakeDb();
 for(const name of ["bad",shop.toUpperCase(),"bad.myshopify.com.evil.test","",null]){
  await assert.rejects(deleteVsnShopDataAfterVerifiedRedaction(db,name),{
   code:"T024_SHOP_REDACT_GENERATION_NOT_VERIFIED",
  });
 }
 assert.equal(state.events.length,0);
});
// VM executes the ACTUAL JSX route action (imports replaced), not a rewrite.
const source=readFileSync("app/routes/webhooks.shop.redact.jsx","utf8");
function route(event,purge){
 const code=source.replace(/^import .*;\s*$/gm,"")
   .replace("export const action =","const action =")+"\nthis.action=action;";
 const ops=[];
 const sandbox={
  authenticate:{webhook:async()=>{ops.push("sdk");return event}},
  db:{},Response,isVerifiedShopRedactEvent,
  deleteVsnShopDataAfterVerifiedRedaction:async(db,merchant)=>{
    ops.push("purge");return purge(merchant);
  },
 };
 runInNewContext(code,sandbox,{timeout:1000});
 return {action:sandbox.action,ops};
}
test("wrong Shopify signed topic/tenant is 401 with no merchant deletion",async()=>{
 for(const event of [
  {...ok(),topic:"APP_UNINSTALLED"},
  {...ok(),shop:"another.myshopify.com"},
  {...ok(),payload:{...ok().payload,shop_domain:"other.myshopify.com"}},
 ]){
  const {action,ops}=route(event,async()=>({deleted:true}));
  const response=await action({request:{}});
  assert.equal(response.status,401);
  assert.deepEqual(ops,["sdk"]);
  assert.equal(response.headers.get("cache-control"),"no-store");
 }
});
test("verified redaction returns 200 only after completed transaction; blocked returns retryable 503",async()=>{
 for(const rejectPurge of [false,true]){
  const {action,ops}=route(ok(),async merchant=>{
   assert.equal(merchant,shop);
   if(rejectPurge)throw Error("postgresql://secret-driver");
   return {deleted:true};
  });
  const res=await action({request:{}});
  assert.equal(res.status,rejectPurge?503:200);
  assert.equal(res.headers.get("cache-control"),"no-store");
  if(rejectPurge)assert.equal(res.headers.get("retry-after"),"60");
  assert.equal(await res.text(),"");
  assert.deepEqual(ops,["sdk","purge"]);
 }
});
test("GDPR compliance route does not call legacy unconditional deletion",()=>{
 assert.doesNotMatch(source,/deleteVsnShopData\(db/);
 assert.match(source,/deleteVsnShopDataAfterVerifiedRedaction/);
 assert.match(source,/isVerifiedShopRedactEvent\(event\)/);
 assert(!source.includes("console."));
});
