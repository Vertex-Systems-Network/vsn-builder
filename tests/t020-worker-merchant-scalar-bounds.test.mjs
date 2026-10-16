import test from "node:test";
import assert from "node:assert/strict";
import {createVerifiedMerchantPageSummaryLease} from "../app/services/worker-shopify-page-summary.js";
import {createVerifiedMerchantPageMetadataLease} from "../app/services/worker-shopify-page-metadata.js";

const shop="verified.myshopify.com",id="ckSafePage0123";
const date=()=>new Date("2026-10-16T12:00:00.000Z");
function page(overrides={}){
 return {id,shop,title:"Verified",handle:"verified",template:"Blank",
  status:"draft",version:1,updatedAt:date(),...overrides};
}
function summaryDatabase({row={},total=1,draft=1,published=0}={}){
 return {builderPage:{
  async count({where}){return where.status==="draft"?draft:
   where.status==="published"?published:total;},
  async findMany(){const current=page(row);return [{
   id:current.id,title:current.title,template:current.template,
   status:current.status,updatedAt:current.updatedAt,
  }];},
 }};
}
const metadataDatabase=(row={})=>({builderPage:{
 async findFirst(){return page(row);},
}});
test("valid merchant scalar readers return bounded fields and never expose Prisma handle",async()=>{
 const summary=createVerifiedMerchantPageSummaryLease(summaryDatabase(),shop);
 assert.deepEqual(await summary.load(),{total:1,draft:1,published:0,recent:[{
  id,title:"Verified",template:"Blank",status:"draft",updatedAt:date().toISOString(),
 }]});
 const metadata=createVerifiedMerchantPageMetadataLease(metadataDatabase(),shop);
 assert.deepEqual(await metadata.get(id),{
  id,title:"Verified",handle:"verified",template:"Blank",status:"draft",
  version:1,updatedAt:date().toISOString(),
 });
 assert.equal(summary.database,undefined);
 assert.equal(metadata.database,undefined);
});
test("summary JSON reader rejects unsafe IDs and oversized/corrupt text before leaking data",async()=>{
 for(const row of [
  {id:"../other-shop"},{id:"a".repeat(65)},
  {title:"A".repeat(257)},{template:"x".repeat(121)},
  {status:"x".repeat(41)},
  {title:42},{template:null},{status:{value:"draft"}},
  {updatedAt:new Date(NaN)},
 ]){
  const reader=createVerifiedMerchantPageSummaryLease(summaryDatabase({row}),shop);
  await assert.rejects(reader.load(),/Invalid merchant page record/);
 }
});
test("summary counts cannot contradict total pages even with otherwise valid rows",async()=>{
 for(const counts of [
  {total:1,draft:2,published:0},
  {total:1,draft:0,published:2},
  {total:1,draft:1,published:1},
  {total:-1,draft:0,published:0},
  {total:1,draft:0.5,published:0},
 ]){
  const reader=createVerifiedMerchantPageSummaryLease(summaryDatabase(counts),shop);
  await assert.rejects(reader.load(),/Invalid merchant page summary/);
 }
});
test("metadata JSON reader rejects oversized/corrupt scalar fields and out-of-range DB versions",async()=>{
 for(const row of [
  {title:"T".repeat(257)},{handle:"H".repeat(257)},
  {template:"x".repeat(121)},{status:"x".repeat(41)},
  {version:0},{version:-1},{version:1.5},{version:2147483648},
  {version:"1"},{version:Number.MAX_SAFE_INTEGER},
  {title:null},{handle:{}},{template:null},{status:8},
  {updatedAt:new Date(NaN)},
  {shop:"other.myshopify.com"},{id:"unrequested"},
 ]){
  const reader=createVerifiedMerchantPageMetadataLease(metadataDatabase(row),shop);
  await assert.rejects(reader.get(id),/Invalid verified Builder page metadata/);
 }
});
test("each returned capability is revoked even for previously accepted rows",async()=>{
 const a=createVerifiedMerchantPageSummaryLease(summaryDatabase(),shop);
 const b=createVerifiedMerchantPageMetadataLease(metadataDatabase(),shop);
 await a.load();await b.get(id);
 a.revoke();b.revoke();
 await assert.rejects(a.load(),/context closed/);
 await assert.rejects(b.get(id),/context closed/);
});
