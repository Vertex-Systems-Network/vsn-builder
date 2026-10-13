import test from "node:test";
import assert from "node:assert/strict";
import {revokeVerifiedWorkerShopifySessions} from "../app/services/worker-shopify-uninstall-session-revoke.js";

const event=(shop="tenant-one.myshopify.com")=>({
  shop,topic:"APP_UNINSTALLED",webhookId:"signed-ci-1",
  payload:{shop_domain:shop},
});
function fakeDatabase(){
  const sessions=[
    {id:"one-offline",shop:"tenant-one.myshopify.com"},
    {id:"one-online",shop:"tenant-one.myshopify.com"},
    {id:"two-offline",shop:"tenant-two.myshopify.com"},
  ];
  const calls=[];
  return {
    sessions,calls,
    context:{database:{session:{
      async deleteMany(q){
        calls.push(q);
        const count=sessions.filter(s=>s.shop===q.where.shop).length;
        for(let i=sessions.length-1;i>=0;i--){
          if(sessions[i].shop===q.where.shop)sessions.splice(i,1);
        }
        return {count};
      },
    }}},
  };
}
test("only authenticated merchant sessions are revoked, without touching other tenants",async()=>{
 const db=fakeDatabase();
 const response=await revokeVerifiedWorkerShopifySessions({event:event(),context:db.context});
 assert.equal(response.status,204);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(db.calls,[{where:{shop:"tenant-one.myshopify.com"}}]);
 assert.deepEqual(db.sessions,[{id:"two-offline",shop:"tenant-two.myshopify.com"}]);
});
test("replayed uninstall is idempotent and does not delete another shop",async()=>{
 const db=fakeDatabase();
 assert.equal((await revokeVerifiedWorkerShopifySessions({event:event(),context:db.context})).status,204);
 assert.equal((await revokeVerifiedWorkerShopifySessions({event:event(),context:db.context})).status,204);
 assert.deepEqual(db.sessions,[{id:"two-offline",shop:"tenant-two.myshopify.com"}]);
 assert.equal(db.calls.length,2);
});
test("unsigned context, mismatched payload, bad merchant and unknown event never delete",async()=>{
 const db=fakeDatabase();
 const cases=[
  {},{event:event(),context:{}},
  {event:{...event(),topic:"ORDERS_CREATE"},context:db.context},
  {event:{...event(),webhookId:""},context:db.context},
  {event:{...event(),payload:{shop_domain:"tenant-two.myshopify.com"}},context:db.context},
  {event:event("tenant-one.myshopify.com.evil.org"),context:db.context},
  {event:event("TENANT-ONE.myshopify.com"),context:db.context},
 ];
 for(const input of cases){
  const response=await revokeVerifiedWorkerShopifySessions(input);
  assert([401,503].includes(response.status));
 }
 assert.equal(db.calls.length,0);
 assert.equal(db.sessions.length,3);
});
test("database connection failures and malformed write results remain fail closed without leaking errors",async()=>{
 const secret="postgresql://sensitive:password@secret.neon.tech";
 const failing={database:{session:{async deleteMany(){throw Error(secret)}}}};
 const failed=await revokeVerifiedWorkerShopifySessions({event:event(),context:failing});
 assert.equal(failed.status,503);
 assert.equal(await failed.text(),"");
 assert.equal(JSON.stringify([...failed.headers]),'[["cache-control","no-store"]]');
 for(const result of [{},null,{count:-1},{count:0.5}]){
  const outcome=await revokeVerifiedWorkerShopifySessions({
   event:event(),context:{database:{session:{async deleteMany(){return result}}}},
  });
  assert.equal(outcome.status,503);
 }
});
