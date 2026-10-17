import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBoundedWorkerPageCreateRequest,authorizeAndCreateVerifiedWorkerPage,
  handleVerifiedWorkerPageCreate,
} from "../app/services/worker-shopify-page-create.js";
import { BuilderDraftSaveError } from "../app/services/worker-shopify-page-draft-save.js";

const shop="staging-shop.myshopify.com";
const session={id:"offline_"+shop,shop,accessToken:"synthetic-session-token",
  isOnline:false,accountOwner:true};
const endpoint="https://staging.builder.example.net/app/__vsn/pages/create?shop="+shop;
const request=(body={title:"Client Landing Page"},headers={})=>
  new Request(endpoint,{method:"POST",
    headers:{"content-type":"application/json",...headers},
    body:typeof body==="string"?body:JSON.stringify(body)});

function fixture({plan="starter",used=0,paid=true,shopOwner=shop,roleAccessJson=null}={}){
  const calls=[],rows=[];
  const transaction={
    builderSubscription:{
      async findUnique({where}){
        calls.push("plan:"+where.shop);
        return paid?{shop:shopOwner,provider:"shopify-app-pricing",
          planKey:plan,planHandle:plan,status:"active",
          verifiedAt:new Date(),trialEndsAt:null,cancelEffectiveOn:null}:null;
      },
    },
    builderShopSetting:{async findUnique(){
      calls.push("role");
      return {roleAccessJson};
    }},
    builderPage:{
      async count({where}){
        calls.push("count:"+where.shop);
        assert.deepEqual(where,{shop,deletedAt:null});
        return used+rows.length;
      },
      async create({data,select}){
        calls.push("create:"+data.shop);
        assert.deepEqual(Object.keys(select).sort(),
          ["handle","id","shop","status","title","version"].sort());
        assert.deepEqual({
          template:data.template,status:data.status,contentJson:data.contentJson,
          publishedJson:data.publishedJson,createdBy:data.createdBy,
        },{template:"page",status:"draft",contentJson:"[]",
          publishedJson:null,createdBy:"Verified Shopify staff"});
        rows.push(data);
        return {id:"ckPage"+rows.length,shop:data.shop,title:data.title,
          handle:data.handle,status:data.status,version:1};
      },
    },
  };
  return {transaction,calls,rows};
}
const serve=(f,req=request(),actor=session)=>
  handleVerifiedWorkerPageCreate({request:req,transaction:f.transaction,
    session:actor,shop});
const bad=async(fn,status)=>
  assert.rejects(fn,e=>e instanceof BuilderDraftSaveError&&e.status===status);

test("strict single title-only JSON request, never client-selected shop/plan/ID",async()=>{
  assert.deepEqual(await parseBoundedWorkerPageCreateRequest(request()),
    {title:"Client Landing Page"});
  assert.deepEqual(await parseBoundedWorkerPageCreateRequest(request({title:"  Home  "})),
    {title:"Home"});
  for(const payload of [{},{title:"",shop}, {title:"Test",plan:"platinum"},
    {title:"Test",status:"published"}, {title:"T",id:"cross-tenant"},
    {title:44},null,[],{title:"a".repeat(121)},
    {title:"bad\nheader"},{title:"\u0000x"}]){
    await bad(()=>parseBoundedWorkerPageCreateRequest(request(payload)),400);
  }
  await bad(()=>parseBoundedWorkerPageCreateRequest(request("{broken")),400);
  await bad(()=>parseBoundedWorkerPageCreateRequest(
    request({title:"x"},{"content-type":"text/plain"})),415);
  await bad(()=>parseBoundedWorkerPageCreateRequest(
    request({title:"x"},{"content-length":"1000000"})),413);
  await bad(()=>parseBoundedWorkerPageCreateRequest(
    request({title:"x"},{"content-length":"unknown"})),413);
});

test("verified paid owner can create blank draft with tenant-scoped unique handle",async()=>{
  const f=fixture();
  const first=await serve(f);
  assert.equal(first.status,201);
  assert.equal(first.headers.get("cache-control"),"no-store");
  assert.deepEqual((await first.json()).status,"draft");
  const second=await serve(f);
  assert.equal(second.status,201);
  assert.equal(f.rows.length,2);
  assert.notEqual(f.rows[0].handle,f.rows[1].handle);
  assert.match(f.rows[0].handle,/^client-landing-page-[a-f0-9]{16}$/);
  assert.deepEqual(f.calls,[
    "plan:"+shop,"count:"+shop,"create:"+shop,
    "plan:"+shop,"count:"+shop,"create:"+shop,
  ]);
});

test("plan page quotas mirror canonical four paid plans, not request supplied plan",async()=>{
  for(const [plan,limit] of [
    ["starter",5],["sliver",100],["gold",500],["platinum",5000],
  ]){
    const f=fixture({plan,used:limit-1});
    assert.equal((await serve(f)).status,201,plan+" last allowed page");
    assert.equal((await serve(f)).status,403,plan+" over quota");
    assert.equal(f.rows.length,1);
  }
  for(const invalid of [
    {paid:false},{plan:"free"},{plan:"unknown"},{shopOwner:"other.myshopify.com"},
  ]){
    const f=fixture(invalid);
    assert.equal((await serve(f)).status,403);
    assert.equal(f.calls.some(x=>x.startsWith("create:")),false);
  }
});

test("Shopify session and persisted staff role must authorize create",async()=>{
  const anonymous=fixture();
  assert.equal((await serve(anonymous,request(),{
    ...session,shop:"other.myshopify.com",
  })).status,403);
  assert.deepEqual(anonymous.calls,[]);
  const blocked=fixture({roleAccessJson:JSON.stringify({
    actions:{editor:{pages:{create:false}}},
  })});
  assert.equal((await serve(blocked,request(),{
    ...session,accountOwner:false,
  })).status,403);
  assert.equal(blocked.rows.length,0);
});

test("malformed usage, missing delegates and database errors cannot create",async()=>{
  for(const count of [null,-1,1.5,"4",Infinity]){
    const f=fixture();
    f.transaction.builderPage.count=async()=>count;
    await bad(()=>authorizeAndCreateVerifiedWorkerPage({
      transaction:f.transaction,session,shop,title:"Page",
    }),503);
    assert.equal(f.rows.length,0);
  }
  const f=fixture();
  f.transaction.builderPage.create=async()=>{throw new Error("postgres://secret:password")};
  await assert.rejects(serve(f),/postgres:\/\/secret/);
  const missing=fixture();
  delete missing.transaction.builderPage.create;
  await bad(()=>authorizeAndCreateVerifiedWorkerPage({
    transaction:missing.transaction,session,shop,title:"Page",
  }),503);
});

test("invalid request is rejected before querying paid plan or persistence",async()=>{
  const f=fixture();
  assert.equal((await serve(f,request({title:"Oops",shop}))).status,400);
  assert.deepEqual(f.calls,[]);
});
