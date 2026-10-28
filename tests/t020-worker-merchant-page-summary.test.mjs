import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createVerifiedMerchantPageSummaryLease} from "../app/services/worker-shopify-page-summary.js";
import {acceptWorkerShopifyAdminRequest} from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
import worker from "../workers/app.js";

const origin="https://staging.builder.example.org";
const shop="one.myshopify.com";
const another="two.myshopify.com";
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"not-a-real-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://ci:unused@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const req=(id=shop)=>new Request(origin+"/app/__vsn/page-summary?shop="+id);
const sessionFor=id=>({id:"offline_"+id,shop:id,state:"",isOnline:false,accessToken:"never-export"});
function fx(id=shop,{databaseError=false,invalidRow=false}={}){
 const calls=[];
 const sdkSession=sessionFor(id);
 const row={id:"page-1",title:"My page",template:"Blank",status:"draft",
  updatedAt:new Date("2026-10-15T12:00:00Z"),contentJson:"PRIVATE_CONTENT"};
 const db={
  builderShopInstallation:{async findUnique(){calls.push("installation");return {
   shop:id,installedAt:new Date("2026-10-15T10:00:00Z"),uninstalledAt:null,
  }}},
  session:{async findUnique(){calls.push("session");return sdkSession}},
  builderSubscription:{async findUnique(){calls.push("verified-paid");return {
   shop:id,provider:"shopify-app-pricing",planKey:"starter",
   planHandle:"starter",status:"active",verifiedAt:new Date(),
   trialEndsAt:null,cancelEffectiveOn:null,
  }}},
  builderShopSetting:{async findUnique(){calls.push("role-view");return {roleAccessJson:null}}},
  builderPage:{
   async count({where}){
    calls.push({method:"count",where});
    if(databaseError)throw Error("postgresql://never-leak");
    return where.status==="draft"?1:where.status==="published"?0:1;
   },
   async findMany(args){
    calls.push({method:"findMany",args});
    if(databaseError)throw Error("Neon DATABASE_URL=private");
    return [invalidRow?{...row,updatedAt:"bad"}:row];
   },
   create(){throw Error("mutation must never be called")},
  },
 };
 const ctx={
  database:db,
  shopify:{authenticate:{admin:async()=>{calls.push("official-admin");return {
   session:sdkSession,admin:{graphql:()=>{throw Error("unused")}},
  }}}},
  async close(){calls.push("close")},
 };
 return {ctx,db,calls};
}
async function throughGate(fixture,request=req(),onRead){
 return acceptWorkerShopifyAdminRequest(request,env,{
  enablePageSummary:true,
  createSdkContext:async()=>fixture.ctx,
  async onAuthenticated({shop:verified,pageSummary}){
   return new Response(JSON.stringify(await onRead({shop:verified,pageSummary})),{
    headers:{"content-type":"application/json"},
   });
  },
 });
}

test("verified merchant can read only its scoped page summary; no contentJson or DB handle",async()=>{
 const f=fx();
 const response=await throughGate(f,req(),async ({shop:verified,pageSummary,...rest})=>{
  assert.equal(verified,shop);
  assert.equal(typeof pageSummary,"function");
  assert.deepEqual(rest,{});
  return {shop:verified,pages:await pageSummary()};
 });
 assert.equal(response.status,200);
 const output=await response.json();
 assert.equal(output.shop,shop);
 assert.deepEqual(output.pages,{total:1,draft:1,published:0,recent:[{
  id:"page-1",title:"My page",template:"Blank",status:"draft",
  updatedAt:"2026-10-15T12:00:00.000Z",
 }]});
 assert.doesNotMatch(JSON.stringify(output),/PRIVATE_CONTENT|never-export|postgresql:/);
 const reads=f.calls.filter(x=>typeof x==="object");
 assert.equal(reads.length,4);
 assert(reads.every(x=>x.where?.shop===shop||x.args?.where?.shop===shop));
 assert(reads.every(x=>("where" in x?x.where.deletedAt:x.args.where.deletedAt)===null));
 assert.equal(reads.find(x=>x.method==="findMany").args.take,5);
 assert.deepEqual(reads.find(x=>x.method==="findMany").args.select,
  {id:true,title:true,template:true,status:true,updatedAt:true});
 assert.equal(f.calls.at(-1),"close");
});
test("a saved read capability is revoked after verified Neon context closes",async()=>{
 const f=fx();
 let stolen;
 const response=await throughGate(f,req(),async({pageSummary})=>{
  stolen=pageSummary;
  return await pageSummary();
 });
 assert.equal(response.status,200);
 const readCount=f.calls.filter(x=>typeof x==="object").length;
 await assert.rejects(stolen(),/context closed/);
 assert.equal(f.calls.filter(x=>typeof x==="object").length,readCount);
});
test("forged shop query is refused before any tenant page query",async()=>{
 const f=fx(shop);
 let reached=false;
 const res=await throughGate(f,req(another),async()=>{
  reached=true;return {};
 });
 assert.equal(res.status,401);
 assert.equal(reached,false);
 assert.equal(f.calls.filter(x=>typeof x==="object").length,0);
 assert.equal(f.calls.at(-1),"close");
});
test("revoked installation, expired persisted session and failed DB never expose page data",async()=>{
 const old=fx();
 old.ctx.database.builderShopInstallation.findUnique=async()=>({
  installedAt:new Date("2026-10-15T10:00:00Z"),uninstalledAt:new Date(),
 });
 assert.equal((await throughGate(old)).status,403);
 assert.equal(old.calls.filter(x=>typeof x==="object").length,0);
 const expired=fx();
 expired.ctx.database.session.findUnique=async()=>({
  ...sessionFor(shop),expires:new Date("2025-01-01T00:00:00Z"),
 });
 assert.equal((await throughGate(expired)).status,403);
 const failed=fx(shop,{databaseError:true});
 const response=await throughGate(failed,req(),async({pageSummary})=>pageSummary());
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.equal(failed.calls.at(-1),"close");
});
test("invalid dates or missing builderPage delegate fail closed",async()=>{
 const malformed=fx(shop,{invalidRow:true});
 const result=await throughGate(malformed,req(),async({pageSummary})=>pageSummary());
 assert.equal(result.status,503);
 assert.equal(await result.text(),"");
 const missing=fx();
 delete missing.db.builderPage;
 const unavailable=await throughGate(missing,req(),async({pageSummary})=>pageSummary());
 assert.equal(unavailable.status,503);
 assert.equal(missing.calls.at(-1),"close");
});
test("concurrent verified stores never share count queries or page readers",async()=>{
 const stores=[fx(shop),fx(another)];
 const results=await Promise.all(stores.map((store,i)=>
  throughGate(store,req(i?another:shop),async({pageSummary,shop:verified})=>{
   await Promise.resolve();
   return {shop:verified,pages:await pageSummary()};
  })
 ));
 assert(results.every(x=>x.status===200));
 const body=await Promise.all(results.map(x=>x.json()));
 assert.deepEqual(body.map(x=>x.shop),[shop,another]);
 for(let i=0;i<stores.length;i++){
  const reads=stores[i].calls.filter(x=>typeof x==="object");
  assert.equal(reads.length,4);
  assert(reads.every(c=>(c.where?.shop??c.args?.where?.shop)===(i?another:shop)));
 }
});
test("page summary reader rejects missing Shopify identity and cannot expose mutations",async()=>{
 const store=fx();
 for(const id of ["evil.example.com","wrong.myshopifyXcom","",null]){
  assert.throws(()=>createVerifiedMerchantPageSummaryLease(store.db,id));
 }
 const lease=createVerifiedMerchantPageSummaryLease(store.db,shop);
 assert.equal(lease.create,undefined);
 assert.equal(lease.database,undefined);
 assert.equal(lease.$transaction,undefined);
 assert.equal(lease.load.constructor.name,"AsyncFunction");
 lease.revoke();
 await assert.rejects(lease.load(),/context closed/);
});
test("real hosted Worker declares only the narrowly authenticated read route",async()=>{
 const src=readFileSync("workers/app.js","utf8");
 assert.match(src,/url\.pathname==="\/app\/__vsn\/page-summary"/);
 assert.match(src,/enablePageSummary:true/);
 assert.match(src,/onAuthenticated:async/);
 assert.match(src,/pageSummary\(\)/);
 assert.match(src,/url\.pathname==="\/readyz"/);
 assert.match(src,/return locked\(\);/);
 assert.match(src,/url\.pathname\.startsWith\("\/auth\/"\)/);
 const noTier=await worker.fetch(new Request(origin+"/app/__vsn/page-summary"),{
  APP_ENV:"staging",VSN_WORKER_NAME:"different",
 });
 assert.equal(noTier.status,503);
 assert.equal(await noTier.text(),"");
});
