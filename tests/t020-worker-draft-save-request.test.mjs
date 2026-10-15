import test from "node:test";
import assert from "node:assert/strict";
import {
 parseBoundedWorkerDraftSaveRequest,handleVerifiedWorkerDraftSave,
} from "../app/services/worker-shopify-draft-save-request.js";
import {BuilderDraftSaveError} from "../app/services/worker-shopify-page-draft-save.js";

const shop="staging-merchant.myshopify.com";
const id="ckPage123";
const endpoint="https://staging.builder.example.org/app/__vsn/pages/"+id+"/content?shop="+shop;
const nodes=[{id:"title",type:"text",props:{text:"New draft"}}];
const session={id:"offline_"+shop,shop,accessToken:"synthetic-sdk-proof",isOnline:false};
const request=(value={expectedVersion:2,elements:nodes},headers={})=>
 new Request(endpoint,{method:"POST",headers:{"content-type":"application/json",...headers},
  body:JSON.stringify(value)});
const bad=async(fn,status)=>{
 await assert.rejects(fn,error=>error instanceof BuilderDraftSaveError && error.status===status);
};
function fixture({owner=shop,version=2,paid=true,roleAccessJson=null,deletedAt=null}={}){
 const calls=[];
 const state={shop:owner,id,version,deletedAt,contentJson:"[]",publishedJson:"MUST_NOT_PUBLISH"};
 const transaction={
  builderSubscription:{async findUnique(){calls.push("paid");return paid?{
   shop,provider:"shopify-app-pricing",planKey:"starter",planHandle:"starter",
   status:"active",verifiedAt:new Date(),trialEndsAt:null,cancelEffectiveOn:null,
  }:null}},
  builderShopSetting:{async findUnique(){calls.push("role");return {roleAccessJson}}},
  builderPage:{
   async updateMany({where,data}){
    calls.push("page:update");
    if(state.shop!==where.shop || state.id!==where.id ||
     state.deletedAt!==where.deletedAt || state.version!==where.version)
     return {count:0};
    state.contentJson=data.contentJson;
    state.version+=data.version.increment;
    return {count:1};
   },
   async findFirst({where}){
    calls.push("page:find");
    if(state.shop!==where.shop || state.id!==where.id ||
     state.deletedAt!==where.deletedAt)return null;
    return {id:state.id,version:state.version};
   },
  },
 };
 return {transaction,state,calls};
}
const serve=(f,req=request(),options={})=>
 handleVerifiedWorkerDraftSave({request:req,transaction:f.transaction,session,shop,pageId:id,...options});

test("strict bounded JSON request accepts only version and node array shape",async()=>{
 assert.deepEqual(await parseBoundedWorkerDraftSaveRequest(request()),
  {expectedVersion:2,elements:nodes});
 for(const payload of [
  {},{elements:nodes},{expectedVersion:2},
  {expectedVersion:2,elements:nodes,shop:"other.myshopify.com"},
  null,[],{elements:nodes,expectedVersion:2,pageId:id},
 ]){
  await bad(()=>parseBoundedWorkerDraftSaveRequest(request(payload)),400);
 }
 await bad(()=>parseBoundedWorkerDraftSaveRequest(
  new Request(endpoint,{method:"GET"})),405);
 for(const contentType of ["text/plain","application/x-www-form-urlencoded","application/json; charset=latin1"]){
  await bad(()=>parseBoundedWorkerDraftSaveRequest(request(undefined,{"content-type":contentType})),415);
 }
});

test("reject malformed/invalid UTF-8 bodies and declared/streaming oversize without database",async()=>{
 const raw=(bytes,headers={})=>new Request(endpoint,{
  method:"POST",headers:{"content-type":"application/json",...headers},
  body:bytes,
 });
 await bad(()=>parseBoundedWorkerDraftSaveRequest(raw("{broken")),400);
 await bad(()=>parseBoundedWorkerDraftSaveRequest(raw(new Uint8Array([0xc3,0x28]))),400);
 await bad(()=>parseBoundedWorkerDraftSaveRequest(raw("{}",{"content-length":"1056769"})),413);
 await bad(()=>parseBoundedWorkerDraftSaveRequest(raw("{}",{"content-length":"bogus"})),413);
 await bad(()=>parseBoundedWorkerDraftSaveRequest(raw("x".repeat(1024*1024+8193))),413);
});

test("malicious stalled streaming request exceeds total read deadline without waiting for cancellation",async()=>{
 let cancelled=false;
 const req=new Request(endpoint,{
  method:"POST",headers:{"content-type":"application/json"},
  body:new ReadableStream({
   start(controller){controller.enqueue(new TextEncoder().encode('{"elements":['))},
   cancel(){cancelled=true;return new Promise(()=>{})},
  }),duplex:"half",
 });
 const started=Date.now();
 await bad(()=>parseBoundedWorkerDraftSaveRequest(req),408);
 assert.equal(cancelled,true);
 assert(Date.now()-started<4000);
});

test("SDK-authorized paid staff save updates only draft with version CAS",async()=>{
 const f=fixture();
 const response=await serve(f);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(await response.json(),{id,version:3});
 assert.deepEqual(f.calls,["paid","role","page:update"]);
 assert.equal(f.state.contentJson,JSON.stringify(nodes));
 assert.equal(f.state.version,3);
 assert.equal(f.state.publishedJson,"MUST_NOT_PUBLISH");
 const concurrent=await serve(f);
 assert.equal(concurrent.status,409);
 assert.deepEqual(await concurrent.json(),
  {code:"DRAFT_VERSION_CONFLICT",currentVersion:3});
 assert.deepEqual(f.calls.slice(-4),["paid","role","page:update","page:find"]);
});

test("paid-plan and edit RBAC deny all writes; invalid body never reaches billing or page",async()=>{
 for(const setup of [
  {paid:false},{roleAccessJson:JSON.stringify({actions:{editor:{pages:{edit:false}}}})},
 ]){
  const f=fixture(setup);
  const response=await serve(f);
  assert.equal(response.status,403);
  assert.equal(await response.text(),"");
  assert.equal(f.state.contentJson,"[]");
  assert.equal(f.calls.includes("page:update"),false);
 }
 for(const payload of [{elements:nodes,expectedVersion:0}, {elements:{},expectedVersion:2}]){
  const f=fixture();
  const resp=await serve(f,request(payload));
  assert.equal(resp.status,400);
  assert.equal(f.calls.includes("page:update"),false);
  assert.equal(f.state.contentJson,"[]");
 }
 const f=fixture();
 const r=await serve(f,rawBadJson());
 assert.equal(r.status,400);
 assert.deepEqual(f.calls,[]);
});
function rawBadJson(){
 return new Request(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:"not-json"});
}

test("cross-tenant and deleted pages are uniformly concealed without draft update",async()=>{
 for(const setup of [{owner:"foreign.myshopify.com"},{deletedAt:new Date()}]){
  const f=fixture(setup);
  const response=await serve(f);
  assert.equal(response.status,404);
  assert.equal(await response.text(),"");
  assert.equal(f.state.contentJson,"[]");
  assert.equal(f.calls.includes("page:find"),true);
 }
});

test("corrupt role policy fails closed inside locked transaction without leaking DB errors",async()=>{
 const f=fixture({roleAccessJson:"{corrupt"});
 await assert.rejects(serve(f),error=>error instanceof SyntaxError);
 assert.deepEqual(f.calls,["paid","role"]);
 assert.equal(f.state.version,2);
 assert.equal(f.state.contentJson,"[]");
 // Official Admin mutation gate catches this exception and returns bare 503.
});
