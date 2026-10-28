import test from "node:test";
import assert from "node:assert/strict";
import {createVerifiedMerchantPageContentLease} from "../app/services/worker-shopify-page-content.js";

const shop="one.myshopify.com";
const id="ckbuilder123";
const elements=[{id:"hero",type:"section",props:{title:"Welcome"}}];
function fixture(record={},missing=false) {
 const queries=[];
 const db={builderPage:{async findFirst(args){
  queries.push(args);
  return missing?null:{id,shop,version:2,
    updatedAt:new Date("2026-10-15T12:00:00Z"),
    contentJson:JSON.stringify(elements),...record};
 }}};
 return {db,queries};
}
test("loads only verified shop non-deleted draft with fixed scalar projection",async()=>{
 const f=fixture();
 const lease=createVerifiedMerchantPageContentLease(f.db,shop);
 assert.deepEqual(await lease.get(id),{
  id,version:2,updatedAt:"2026-10-15T12:00:00.000Z",elements,
 });
 assert.deepEqual(f.queries[0].where,{id,shop,deletedAt:null});
 assert.deepEqual(f.queries[0].select,{
  id:true,shop:true,version:true,updatedAt:true,contentJson:true,
 });
 assert.equal(lease.database,undefined);
 lease.revoke();
 await assert.rejects(lease.get(id),/context closed/);
});
test("not found is null, bad page id cannot reach DB",async()=>{
 const f=fixture({},true);
 const lease=createVerifiedMerchantPageContentLease(f.db,shop);
 assert.equal(await lease.get(id),null);
 await assert.rejects(lease.get("../path"),/Invalid Builder page ID/);
 assert.equal(f.queries.length,1);
});
test("default draft [] and invalid or oversized drafts fail closed",async()=>{
 for(const raw of [null,""]){
  const f=fixture({contentJson:raw});
  assert.deepEqual((await createVerifiedMerchantPageContentLease(f.db,shop).get(id)).elements,[]);
 }
 for(const raw of ["broken",JSON.stringify({not:"array"}),"a".repeat(1024*1024+1)]){
  const f=fixture({contentJson:raw});
  await assert.rejects(createVerifiedMerchantPageContentLease(f.db,shop).get(id));
 }
});
test("cross-shop rows and invalid PostgreSQL Int versions fail closed",async()=>{
 for(const record of [
  {shop:"other.myshopify.com"},{version:0},{version:-1},
  {version:1.1},{version:"2"},{version:2147483648},
  {version:Number.MAX_SAFE_INTEGER},{updatedAt:"bad"},
 ]){
  const f=fixture(record);
  await assert.rejects(createVerifiedMerchantPageContentLease(f.db,shop).get(id));
 }
});
test("signed Int upper boundary is accepted by editor hydration",async()=>{
 const f=fixture({version:2147483647,contentJson:"[]"});
 const row=await createVerifiedMerchantPageContentLease(f.db,shop).get(id);
 assert.equal(row.version,2147483647);
 assert.deepEqual(row.elements,[]);
});
test("the request-scoped lease cannot release a late read after revocation",async()=>{
 let resolve;
 const request=new Promise(r=>{resolve=r;});
 const db={builderPage:{findFirst:async query=>{
  assert.deepEqual(query.where,{id,shop,deletedAt:null});
  return request;
 }}};
 const lease=createVerifiedMerchantPageContentLease(db,shop);
 const pending=lease.get(id);
 lease.revoke();
 resolve({id,shop,version:2,
  updatedAt:new Date("2026-10-15T12:00:00Z"),contentJson:"[]"});
 await assert.rejects(pending,/Merchant request context closed/);
});
test("database reader cannot release malformed, forged or deleted page records",async()=>{
 for(const record of [
  {id:"another-page"},
  {shop:"another.myshopify.com"},
  {version:null},{version:Infinity},{version:2147483648},
  {updatedAt:new Date(NaN)}, {contentJson:[]}, {contentJson:42},
 ]){
  const f=fixture(record);
  await assert.rejects(createVerifiedMerchantPageContentLease(f.db,shop).get(id));
 }
});
test("concurrent leases never mix tenant data",async()=>{
 const other="two.myshopify.com";
 const left=fixture();
 const right={builderPage:{async findFirst(args){
  assert.equal(args.where.shop,other);
  return {id,shop:other,version:1,updatedAt:new Date(),contentJson:"[]"};
 }}};
 const [a,b]=await Promise.all([
  createVerifiedMerchantPageContentLease(left.db,shop).get(id),
  createVerifiedMerchantPageContentLease(right,other).get(id),
 ]);
 assert.deepEqual(a.elements,elements);
 assert.deepEqual(b.elements,[]);
});
