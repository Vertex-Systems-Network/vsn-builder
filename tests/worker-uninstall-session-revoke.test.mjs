import test from "node:test";
import assert from "node:assert/strict";
import {revokeVerifiedWorkerShopifySessions} from "../app/services/worker-shopify-uninstall-session-revoke.js";

const triggeredAt=new Date("2026-10-13T09:00:00.000Z");
const event=(shop="tenant-one.myshopify.com")=>({
 shop,topic:"APP_UNINSTALLED",webhookId:"signed-ci-1",
 payload:{shop_domain:shop},
});
const invoke=(database,webhookEvent=event(),when=triggeredAt)=>
 revokeVerifiedWorkerShopifySessions({event:webhookEvent,context:{database},triggeredAt:when});

function fakeDatabase(){
 const sessions=[
  {id:"old-offline",shop:"tenant-one.myshopify.com"},
  {id:"old-online",shop:"tenant-one.myshopify.com"},
  {id:"other-offline",shop:"tenant-two.myshopify.com"},
 ];
 const installs=new Map([["tenant-one.myshopify.com",{
  shop:"tenant-one.myshopify.com",installedAt:new Date("2026-10-13T08:00:00Z"),
  uninstalledAt:null,lastUninstallWebhookId:null,
 }]]);
 const claims=[],deletes=[];
 const database={
  async $transaction(work) {
   return work({
    builderShopInstallation:{
     async updateMany(query){
      claims.push(query);
      const row=installs.get(query.where.shop);
      if(!row || row.uninstalledAt || row.installedAt>query.where.installedAt.lte) return {count:0};
      row.uninstalledAt=query.data.uninstalledAt;
      row.lastUninstallWebhookId=query.data.lastUninstallWebhookId;
      return {count:1};
     },
     async findUnique({where}){return installs.get(where.shop)||null;},
    },
    session:{
     async deleteMany(query){
      deletes.push(query);
      let count=0;
      for(let i=sessions.length-1;i>=0;i--){
       if(sessions[i].shop===query.where.shop){sessions.splice(i,1);count++;}
      }
      return {count};
     },
    },
   });
  },
 };
 return {database,installs,sessions,claims,deletes};
}
test("only signed uninstall merchant sessions deleted after atomic installation claim",async()=>{
 const db=fakeDatabase();
 const response=await invoke(db.database);
 assert.equal(response.status,204);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(db.deletes,[{where:{shop:"tenant-one.myshopify.com"}}]);
 assert.equal(db.claims.length,1);
 assert.deepEqual(db.sessions,[{id:"other-offline",shop:"tenant-two.myshopify.com"}]);
});
test("duplicate delivery is idempotent without second session delete",async()=>{
 const db=fakeDatabase();
 assert.equal((await invoke(db.database)).status,204);
 assert.equal((await invoke(db.database)).status,204);
 assert.equal(db.deletes.length,1);
 assert.equal(db.sessions.length,1);
});
test("late webhook after reinstall preserves new installation sessions",async()=>{
 const db=fakeDatabase();
 assert.equal((await invoke(db.database)).status,204);
 const row=db.installs.get("tenant-one.myshopify.com");
 // A later signed OAuth install must atomically advance this row with the
 // new session creation; the CI fixture models that committed generation.
 row.installedAt=new Date("2026-10-13T10:00:00Z");
 row.uninstalledAt=null;
 row.lastUninstallWebhookId=null;
 db.sessions.push({id:"new-session",shop:"tenant-one.myshopify.com"});
 assert.equal((await invoke(db.database)).status,204);
 assert.equal(db.deletes.length,1,"old webhook must not execute another delete");
 assert(db.sessions.some(s=>s.id==="new-session"));
 // Current installation may still be uninstalled by its own NEW event.
 assert.equal((await invoke(db.database,{
  ...event(),webhookId:"signed-ci-2"
 },new Date("2026-10-13T11:00:00Z"))).status,204);
 assert.equal(db.deletes.length,2);
 assert(!db.sessions.some(s=>s.id==="new-session"));
});
test("no installation fence, missing transaction or inconsistent state cannot delete",async()=>{
 const db=fakeDatabase();
 const initial=db.sessions.length;
 assert.equal((await invoke({session:{deleteMany(){throw Error("called without fence")}}})).status,503);
 assert.equal((await invoke({$transaction:fn=>fn({session:db.database.session})})).status,503);
 db.installs.clear();
 assert.equal((await invoke(db.database)).status,503);
 assert.equal(db.deletes.length,0);
 assert.equal(db.sessions.length,initial);
});
test("malformed timestamp and unsigned/mismatched payload cannot claim",async()=>{
 const db=fakeDatabase();
 const invalid=[
  {event:event(),triggeredAt:undefined},
  {event:event(),triggeredAt:new Date(NaN)},
  {event:{...event(),topic:"ORDERS_CREATE"},triggeredAt},
  {event:{...event(),webhookId:""},triggeredAt},
  {event:{...event(),payload:{myshopify_domain:"other.myshopify.com"}},triggeredAt},
  {event:event("evil.example.test"),triggeredAt},
 ];
 for(const item of invalid){
  const response=await revokeVerifiedWorkerShopifySessions({...item,context:{database:db.database}});
  assert([400,401].includes(response.status));
 }
 assert.equal(db.claims.length,0);
 assert.equal(db.deletes.length,0);
});
test("official Shopify Shop uninstall payload with absent/nullable domain is valid",async()=>{
 for(const payload of [{id:123,name:"Shop",myshopify_domain:null},{id:123,name:"Shop"}]){
  const db=fakeDatabase();
  const response=await invoke(db.database,{...event(),payload});
  assert.equal(response.status,204);
  assert.equal(db.deletes.length,1);
 }
});
test("driver failures and malformed transaction results never leak secrets or delete on retry",async()=>{
 const secret="postgresql://sensitive:password@private.neon.tech";
 const failed=await invoke({async $transaction(){throw Error(secret)}});
 assert.equal(failed.status,503);
 assert.equal(await failed.text(),"");
 const broken=await invoke({async $transaction(fn){
  return fn({
   builderShopInstallation:{
    async updateMany(){return {count:2}},
    async findUnique(){return null},
   },
   session:{async deleteMany(){throw Error("must never be called")}},
  });
 }});
 assert.equal(broken.status,503);
});
