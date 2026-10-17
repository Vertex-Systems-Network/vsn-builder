import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createVerifiedMerchantPageMetadataLease,isSafeMerchantPageId}
  from "../app/services/worker-shopify-page-metadata.js";
import {acceptWorkerShopifyAdminRequest}
  from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
import worker from "../workers/app.js";

const origin="https://staging.builder.example.org";
const shop="one.myshopify.com";
const other="two.myshopify.com";
const pageId="ckbuilder12345";
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-only",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:unused@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const req=(shopId=shop,id=pageId)=>new Request(origin+"/app/__vsn/pages/"+id+"?shop="+shopId);
function fixture(verifiedShop=shop,{rowShop=verifiedShop,notFound=false,failure=false,expired=false}={}){
 const calls=[];
 const session={id:"offline_"+verifiedShop,shop:verifiedShop,state:"",
  isOnline:false,accessToken:"private-never-export"};
 const row={id:pageId,shop:rowShop,title:"Example",handle:"example",
  template:"Blank",status:"draft",version:1,updatedAt:new Date("2026-10-15T12:00:00Z"),
  contentJson:"SECRET_CONTENT",publishedJson:"SECRET_PUBLISHED"};
 const database={
  builderShopInstallation:{async findUnique(){calls.push("installation");return {
   shop:verifiedShop,installedAt:new Date("2026-10-15T10:00:00Z"),uninstalledAt:null,
  }}},
  session:{async findUnique(){calls.push("session");return {...session,
   ...(expired?{expires:new Date("2025-01-01T00:00:00Z")}:{})}}},
  builderSubscription:{async findUnique(){calls.push("verified-paid");return {
   shop:verifiedShop,provider:"shopify-app-pricing",planKey:"starter",
   planHandle:"starter",status:"active",verifiedAt:new Date(),
   trialEndsAt:null,cancelEffectiveOn:null,
  }}},
  builderShopSetting:{async findUnique(){calls.push("role-view");return {roleAccessJson:null}}},
  builderPage:{async findFirst(args){calls.push({kind:"page",args});
   if(failure)throw Error("postgresql://secret@private-host");
   return notFound?null:row;
  }},
 };
 const ctx={
  database,shopify:{authenticate:{admin:async()=>{calls.push("auth");
   return {session,admin:{graphql:()=>{throw Error("unused")}}};
  }}},async close(){calls.push("close")},
 };
 return {ctx,calls,database};
}
async function authorize(f,request=req(),onRead){
 return acceptWorkerShopifyAdminRequest(request,env,{
  enablePageMetadata:true,createSdkContext:async()=>f.ctx,
  onAuthenticated:async({shop:verified,pageMetadata,...rest})=>{
   if(onRead)return onRead({shop:verified,pageMetadata,...rest});
   const result=await pageMetadata(pageId);
   return new Response(result===null?null:JSON.stringify({page:result}),{
    status:result===null?404:200,headers:{"content-type":"application/json"},
   });
  }
 });
}

test("SDK verified shop reads exactly one same-tenant non-deleted page and no private editor JSON",async()=>{
 const f=fixture();
 const res=await authorize(f);
 assert.equal(res.status,200);
 const body=await res.json();
 assert.deepEqual(body.page,{
  id:pageId,title:"Example",handle:"example",template:"Blank",
  status:"draft",version:1,updatedAt:"2026-10-15T12:00:00.000Z",
 });
 assert.doesNotMatch(JSON.stringify(body),/SECRET_CONTENT|SECRET_PUBLISHED|private-never-export|postgresql:/);
 const queries=f.calls.filter(x=>typeof x==="object");
 assert.equal(queries.length,1);
 assert.deepEqual(queries[0].args.where,{id:pageId,shop,deletedAt:null});
 assert.deepEqual(queries[0].args.select,{
  id:true,shop:true,title:true,handle:true,template:true,
  status:true,version:true,updatedAt:true,
 });
 assert.equal(f.calls.at(-1),"close");
});

test("no owner page is 404 and does not expose existence through a global lookup",async()=>{
 const f=fixture(shop,{notFound:true});
 const res=await authorize(f);
 assert.equal(res.status,404);
 assert.equal(await res.text(),"");
 assert.deepEqual(f.calls.find(x=>typeof x==="object").args.where,
  {id:pageId,shop,deletedAt:null});
});

test("forged shop hints and invalid persisted sessions cannot authorize a page query",async()=>{
 const forged=fixture();
 assert.equal((await authorize(forged,req(other))).status,401);
 assert.equal(forged.calls.filter(x=>typeof x==="object").length,0);
 const expired=fixture(shop,{expired:true});
 assert.equal((await authorize(expired)).status,403);
 assert.equal(expired.calls.filter(x=>typeof x==="object").length,0);
});

test("malformed cross-tenant rows and Neon errors fail closed with no secret body",async()=>{
 const wrong=fixture(shop,{rowShop:other});
 const bad=await authorize(wrong);
 assert.equal(bad.status,503);
 assert.equal(await bad.text(),"");
 const failed=fixture(shop,{failure:true});
 const r=await authorize(failed);
 assert.equal(r.status,503);
 assert.equal(await r.text(),"");
 assert.equal(failed.calls.at(-1),"close");
});

test("stolen page lookup capability is revoked as soon as Shopify/Neon request ends",async()=>{
 const f=fixture();
 let stolen;
 const res=await authorize(f,req(),async({shop:verified,pageMetadata,...rest})=>{
  assert.equal(verified,shop);
  assert.deepEqual(Object.keys(rest).sort(),["admin","request","session"]);
  stolen=pageMetadata;
  return Response.json({page:await pageMetadata(pageId)});
 });
 assert.equal(res.status,200);
 const initial=f.calls.filter(x=>typeof x==="object").length;
 await assert.rejects(stolen(pageId),/context closed/);
 assert.equal(f.calls.filter(x=>typeof x==="object").length,initial);
});

test("concurrent verified store requests never share tenant Prisma or capability state",async()=>{
 const shops=[shop,other];
 const fixtures=shops.map(name=>fixture(name,{rowShop:name}));
 const results=await Promise.all(fixtures.map((f,i)=>authorize(f,req(shops[i]),async({pageMetadata})=>{
  await Promise.resolve();
  return Response.json({page:await pageMetadata(pageId)});
 })));
 assert(results.every(x=>x.status===200));
 for(let i=0;i<fixtures.length;i++){
  const q=fixtures[i].calls.find(x=>typeof x==="object");
  assert.equal(q.args.where.shop,shops[i]);
  assert.equal(fixtures[i].calls.at(-1),"close");
 }
});

test("page ID policy blocks traversal, encoded separators, huge IDs, missing delegate and mutations",async()=>{
 for(const id of ["","/etc/passwd","..","%2F","abc.def","a".repeat(65),null,{}])
  assert.equal(isSafeMerchantPageId(id),false,String(id));
 for(const id of [pageId,"a","abc_DEF-02"])
  assert.equal(isSafeMerchantPageId(id),true,id);
 const f=fixture();
 const lease=createVerifiedMerchantPageMetadataLease(f.database,shop);
 assert.equal(lease.create,undefined);
 assert.equal(lease.database,undefined);
 assert.equal(lease.$transaction,undefined);
 await assert.rejects(lease.get("../foo"),/Invalid Builder page ID/);
 lease.revoke();
 await assert.rejects(lease.get(pageId),/context closed/);
 assert.throws(()=>createVerifiedMerchantPageMetadataLease({},shop),/unavailable/);
 assert.throws(()=>createVerifiedMerchantPageMetadataLease(f.database,"attacker.example.com"),/unavailable/);
});

test("hosted Worker only exposes exact GET page metadata subroute, not editor mutations",async()=>{
 const src=readFileSync("workers/app.js","utf8");
 assert.match(src,/url\.pathname\.startsWith\("\/app\/__vsn\/pages\/"\)/);
 assert.match(src,/enablePageMetadata:true/);
 assert.match(src,/await pageMetadata\(rawId\)/);
 assert.match(src,/url\.pathname\.startsWith\("\/auth\/"/);
 const lacking=await worker.fetch(new Request(origin+"/app/__vsn/pages/"+pageId),{
  APP_ENV:"staging",VSN_WORKER_NAME:"not-the-staging-worker",
 });
 assert.equal(lacking.status,503);
 assert.equal(await lacking.text(),"");
});
