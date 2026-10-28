import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  saveVerifiedBuilderPageDraft,authorizeAndSaveVerifiedWorkerDraft,
  encodeVerifiedBuilderDraft,BuilderDraftSaveError,
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

test("Staging draft POST requires explicit opt-in and SDK-locked transactional authorization",()=>{
 const worker=readFileSync("workers/app.js","utf8");
 assert.match(worker,/!isHostedTier\(env\)/);
 assert.match(readFileSync("app/services/worker-hosted-tier.js","utf8"),/VSN_PRODUCTION_ENABLED === "true"/);
 assert.match(worker,/env.VSN_STAGING_DRAFT_SAVE_ENABLED!=="true"/);
 assert.match(worker,/acceptWorkerShopifyAdminMutation\(request,env/);
 assert.match(worker,/handleVerifiedWorkerDraftSave/);
 assert.doesNotMatch(worker,/saveVerifiedBuilderPageDraft\(/,
  "Never call raw page writer directly from Worker entry");
 assert.match(worker,/request.method==="GET"/);
});

function authorizedFixture({paid=true,disabled=false,owner=false,subscriptionFailure=false,
 roleAccessJson=undefined}={}){
 const f=fixture();
 const calls=[];
 f.transaction.builderSubscription={async findUnique(args){
  calls.push("subscription");
  if(subscriptionFailure)throw new Error("Private database connector failure");
  if(!paid)return null;
  return {shop,provider:"shopify-app-pricing",planKey:"starter",
    planHandle:"starter",status:"active",verifiedAt:new Date(),
    trialEndsAt:null,cancelEffectiveOn:null};
 }};
 f.transaction.builderShopSetting={async findUnique(args){
  calls.push("permission");
  return {roleAccessJson:roleAccessJson!==undefined?roleAccessJson:
   (disabled?JSON.stringify({actions:{editor:{pages:{edit:false}}}}):null)};
 }};
 const session={shop,id:"offline_"+shop,accessToken:"VALID_SDK_SESSION",
  isOnline:false,accountOwner:owner};
 return {f,calls,session};
}
const gatedSave=(x,overrides={})=>authorizeAndSaveVerifiedWorkerDraft({
 transaction:x.f.transaction,session:x.session,
 shop,pageId,expectedVersion:2,elements,...overrides,
});

test("paid authorized editor draft save checks subscription and pages.edit within transaction",async()=>{
 const x=authorizedFixture();
 assert.deepEqual(await gatedSave(x),{ok:true,id:pageId,version:3});
 assert.deepEqual(x.calls,["subscription","permission"]);
 assert.equal(x.f.row.version,3);
 assert.equal(x.f.row.publishedJson,"LIVE_MUST_NOT_CHANGE");
});

test("unpaid, role-disabled, invalid SDK session deny before any draft mutation",async()=>{
 for(const config of [{paid:false,code:"DRAFT_SUBSCRIPTION_REQUIRED"},
  {disabled:true,code:"DRAFT_EDIT_PERMISSION_REQUIRED"}]){
  const x=authorizedFixture(config);
  await assert.rejects(gatedSave(x),error=>
   error.status===403 && error.code===config.code);
  assert.equal(x.f.calls.length,0);
  assert.equal(x.f.row.version,2);
 }
 for(const badSession of [
  {shop:"evil.myshopify.com",id:"offline_wrong",accessToken:"token",isOnline:false},
  {shop,id:"offline_"+shop,accessToken:"",isOnline:false},
  {shop,id:"offline_"+shop,accessToken:"token"},
 ]){
  const x=authorizedFixture();
  await assert.rejects(gatedSave(x,{session:badSession}),error=>
   error.status===403 && error.code==="DRAFT_SESSION_REQUIRED");
  assert.deepEqual(x.calls,[]);
  assert.deepEqual(x.f.calls,[]);
 }
});

test("corrupt persisted role policy cannot authorize transactional page draft writes",async()=>{
 for(const invalid of ["", "{bad", "null", "[]",
  '{"editor":"false"}',
  '{"systems":{"editor":{"pages":"true"}}}',
  '{"actions":{"editor":{"pages":{"edit":"true"}}}}',
 ]){
  const x=authorizedFixture({roleAccessJson:invalid});
  await assert.rejects(gatedSave(x),error=>
   error instanceof SyntaxError || error instanceof TypeError);
  assert.deepEqual(x.calls,["subscription","permission"]);
  assert.equal(x.f.calls.length,0,"No page mutation after corrupt role policy");
  assert.equal(x.f.row.version,2);
  assert.equal(x.f.row.contentJson,"[]");
 }
});
test("verified shop owner may edit despite staff flags, but never without paid plan",async()=>{
 const owner=authorizedFixture({owner:true,disabled:true});
 assert.deepEqual(await gatedSave(owner),{ok:true,id:pageId,version:3});
 assert.deepEqual(owner.calls,["subscription"]);
 const unpaidOwner=authorizedFixture({owner:true,paid:false});
 await assert.rejects(gatedSave(unpaidOwner),error=>
  error.status===403 && error.code==="DRAFT_SUBSCRIPTION_REQUIRED");
 assert.equal(unpaidOwner.f.calls.length,0);
});

test("billing authority read failure aborts before mutation without error disclosures",async()=>{
 const x=authorizedFixture({subscriptionFailure:true});
 await assert.rejects(gatedSave(x),/Private database connector failure/);
 assert.equal(x.f.calls.length,0);
 assert.equal(x.f.row.contentJson,"[]");
 // HTTP integration must sanitize failures using guardedAdminRequest's
 // existing 503 response; no Worker POST route is enabled here.
});
