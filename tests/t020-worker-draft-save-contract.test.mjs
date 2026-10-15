import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  saveVerifiedBuilderPageDraft,encodeVerifiedBuilderDraft,BuilderDraftSaveError,
} from "../app/services/worker-shopify-page-draft-save.js";

const shop="merchant.myshopify.com";
const pageId="ckbuilder123";
const elements=[{id:"heading",type:"text",props:{text:"Editor draft"}}];

function fixture({owner=shop,deletedAt=null,version=2,missing=false}={}) {
 const calls=[];
 const row={id:pageId,shop:owner,deletedAt,version,contentJson:"[]",publishedJson:"LIVE_MUST_NOT_CHANGE"};
 const transaction={builderPage:{
  async updateMany(args) {
   calls.push({kind:"update",args});
   if(missing || row.shop!==args.where.shop || row.id!==args.where.id ||
      row.deletedAt!==null || row.version!==args.where.version)return {count:0};
   row.contentJson=args.data.contentJson;
   row.version+=args.data.version.increment;
   return {count:1};
  },
  async findFirst(args){
   calls.push({kind:"find",args});
   if(missing || row.shop!==args.where.shop || row.deletedAt!==null ||
      row.id!==args.where.id)return null;
   return {id:row.id,version:row.version};
  },
 }};
 return {transaction,row,calls};
}
const save=(fixture,overrides={})=>saveVerifiedBuilderPageDraft({
 transaction:fixture.transaction,shop,pageId,expectedVersion:2,elements,...overrides,
});

test("atomic draft save updates only one verified shop/version and never publishes",async()=>{
 const f=fixture();
 assert.deepEqual(await save(f),{ok:true,id:pageId,version:3});
 assert.deepEqual(f.calls[0].args.where,
   {id:pageId,shop,deletedAt:null,version:2});
 assert.deepEqual(f.calls[0].args.data,
   {contentJson:JSON.stringify(elements),version:{increment:1}});
 assert.equal(f.row.publishedJson,"LIVE_MUST_NOT_CHANGE");
 assert.equal(f.row.version,3);
 assert.equal(f.calls.length,1);
});

test("stale editors get 409 and current version; never overwrite newer content",async()=>{
 const f=fixture();
 await save(f);
 const after=f.row.contentJson;
 const conflict=await save(f,{elements:[{id:"stale"}]});
 assert.deepEqual(conflict,{ok:false,status:409,
   code:"DRAFT_VERSION_CONFLICT",currentVersion:3});
 assert.equal(f.row.contentJson,after);
 assert.deepEqual(f.calls.at(-1).args,{
   where:{id:pageId,shop,deletedAt:null},
   select:{id:true,version:true},
 });
});

test("foreign shop, trash, missing record all get indistinguishable 404",async()=>{
 for(const setup of [{owner:"other.myshopify.com"},{deletedAt:new Date()},{missing:true}]){
  const f=fixture(setup);
  assert.deepEqual(await save(f),{ok:false,status:404,code:"PAGE_NOT_FOUND"});
  assert.equal(f.row.contentJson,"[]");
  assert.equal(f.calls[0].args.where.shop,shop);
  assert.equal(f.calls.at(-1).args.where.shop,shop);
 }
});

test("validation rejects forged shop, bad ids and invalid version before database calls",async()=>{
 const options=[
   {shop:"evil.example.org"},
   {pageId:"../bad"},
   {pageId:""},
   {expectedVersion:0},
   {expectedVersion:1.5},
   {expectedVersion:2147483647},
 ];
 for(const override of options){
  const f=fixture();
  await assert.rejects(save(f,override),error=>
   error instanceof BuilderDraftSaveError &&
   error.status===400 && error.code==="INVALID_DRAFT_REQUEST");
  assert.equal(f.calls.length,0);
 }
});

test("empty valid drafts are accepted; non-arrays, huge sets and malformed JSON objects are not",()=>{
 assert.equal(encodeVerifiedBuilderDraft([]),"[]");
 assert.equal(encodeVerifiedBuilderDraft([{unicode:"🦋"}]),'[{"unicode":"🦋"}]');
 for(const invalid of [null,{}, "[]",new Array(5001).fill(null)]){
  assert.throws(()=>encodeVerifiedBuilderDraft(invalid),error=>
   error.status===400 && error.code==="INVALID_DRAFT_NODES");
 }
 const circular=[];circular.push(circular);
 assert.throws(()=>encodeVerifiedBuilderDraft(circular),error=>
  error.status===400 && error.code==="INVALID_DRAFT_JSON");
 const huge=[{content:"🦋".repeat(270000)}];
 assert.throws(()=>encodeVerifiedBuilderDraft(huge),error=>
  error.status===413 && error.code==="DRAFT_TOO_LARGE");
});

test("missing transactional delegates and suspicious database write results fail closed",async()=>{
 await assert.rejects(save({transaction:{}}),error=>
  error.status===503 && error.code==="DRAFT_STORAGE_UNAVAILABLE");
 const f=fixture();
 f.transaction.builderPage.updateMany=async()=>({count:2});
 await assert.rejects(save(f),error=>
  error.status===503 && error.code==="INVALID_DRAFT_WRITE_RESULT");
 const malformed=fixture();
 malformed.transaction.builderPage.updateMany=async()=>({count:0});
 malformed.transaction.builderPage.findFirst=async()=>({id:"another",version:2});
 await assert.rejects(save(malformed),error=>
  error.status===503 && error.code==="INVALID_DRAFT_STORAGE_ROW");
});

test("concurrent edits compare-and-swap; exactly one wins and no lost update",async()=>{
 const f=fixture();
 const writes=await Promise.all([
   save(f,{elements:[{writer:"one"}]}),
   save(f,{elements:[{writer:"two"}]}),
 ]);
 assert.equal(writes.filter(x=>x.ok).length,1);
 assert.equal(writes.filter(x=>x.status===409).length,1);
 assert.equal(f.row.version,3);
 assert([JSON.stringify([{writer:"one"}]),JSON.stringify([{writer:"two"}])]
   .includes(f.row.contentJson));
});

test("save contract is dormant: HTTP Worker exposes no draft mutation route",()=>{
 const worker=readFileSync("workers/app.js","utf8");
 assert.doesNotMatch(worker,/saveVerifiedBuilderPageDraft/);
 assert.doesNotMatch(worker,/acceptWorkerShopifyAdminMutation/);
 assert.match(worker,/request.method==="GET"/);
});
