import test from "node:test";
import assert from "node:assert/strict";
import {acceptWorkerShopifyAdminRequest,acceptWorkerShopifyAdminMutation}
 from "../app/services/worker-shopify-admin-gate.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const shop="ci-mutation.myshopify.com";
const session={shop,id:"offline_"+shop,accessToken:"synthetic-valid",isOnline:false};
const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://fake:synthetic@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/disposable?sslmode=require",
};
const request=(method="POST",merchant=shop)=>new Request(
 env.SHOPIFY_APP_URL+"/app/settings?shop="+merchant,{method}
);
function fixture({beforeTransaction,failOnTx=false,missingTx=false}={}){
 const actions=[];
 let row={shop,installedAt:new Date("2026-10-13T09:00:00Z"),uninstalledAt:null};
 let stored={...session};
 const database={
  builderShopInstallation:{
   async findUnique({where}){actions.push("snapshot-install");return where.shop===shop?{...row}:null},
  },
  session:{
   async findUnique({where}){actions.push("snapshot-session");return where.id===session.id?{...stored}:null},
  },
  async $transaction(run){
   actions.push("begin");
   if(beforeTransaction)await beforeTransaction({
    row,stored,actions,setRow:next=>{row=next},
    setSession:next=>{stored=next},
   });
   if(failOnTx)throw new Error("postgresql://private:password@neon");
   let working={...row},current={...stored};
   const tx={
    builderShopInstallation:{
     async updateMany({where}){
      actions.push("lock-install");
      if(where.shop!==shop || working.uninstalledAt!==null)return {count:0};
      return {count:1};
     },
    },
    session:{
     async findUnique({where}){
      actions.push("locked-session");
      return where.id===session.id?{...current}:null;
     },
     async update({where,data}){
      actions.push("write");
      if(where.id!==session.id)throw Error("tenant violation");
      current={...current,...data};
      return {...current};
     },
    },
   };
   const response=await run(tx);
   row=working;stored=current;
   actions.push("commit");
   return response;
  },
 };
 if(missingTx)delete database.$transaction;
 let closes=0,authCalls=0;
 const createSdkContext=async()=>({
  database,
  shopify:{authenticate:{async admin(){
   authCalls++;return {session:{...session},admin:{}};
  }}},
  async close(){closes++},
 });
 return {
  createSdkContext,actions,get stored(){return stored},
  get row(){return row},get closes(){return closes},
  get authCalls(){return authCalls},
 };
}
test("POST holds installation lock, rechecks token and executes tenant write inside transaction",async()=>{
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminMutation(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated({shop:authorized,transaction,context}){
   assert.equal(authorized,shop);
   assert.equal(context,undefined,"No external Prisma client should escape the locked context");
   await transaction.session.update({
    where:{id:session.id},data:{scope:"write_products"},
   });
   return new Response(null,{status:204});
  },
 });
 assert.equal(response.status,204);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.equal(fx.stored.scope,"write_products");
 assert.deepEqual(fx.actions,[
  "snapshot-install","snapshot-session","begin","lock-install",
  "locked-session","write","commit",
 ]);
 assert.equal(fx.closes,1);
});
test("normal GET helper cannot be used for POST mutations, and POST helper rejects GET",async()=>{
 const fx=fixture();
 const base={createSdkContext:fx.createSdkContext,onAuthenticated:async()=>new Response(null,{status:204})};
 assert.equal((await acceptWorkerShopifyAdminRequest(request(),env,base)).status,405);
 assert.equal((await acceptWorkerShopifyAdminMutation(request("GET"),env,base)).status,405);
 assert.deepEqual(fx.actions,[]);
 assert.equal(fx.authCalls,0);
});
test("uninstall committed between snapshot and lock blocks callback and no writes",async()=>{
 let invoked=false;
 const fx=fixture({beforeTransaction:({row})=>{
  row.uninstalledAt=new Date("2026-10-13T10:00:00Z");
 }});
 const response=await acceptWorkerShopifyAdminMutation(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){invoked=true;return new Response(null,{status:204})},
 });
 assert.equal(response.status,403);
 assert.equal(invoked,false);
 assert(!fx.actions.includes("write"));
 assert.equal(fx.closes,1);
});
test("token rotated after initial authentication but before lock is refused",async()=>{
 const fx=fixture({beforeTransaction:({stored})=>{stored.accessToken="new-token"}});
 let invoked=false;
 const response=await acceptWorkerShopifyAdminMutation(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){invoked=true;return new Response(null,{status:204})},
 });
 assert.equal(response.status,403);
 assert.equal(invoked,false);
 assert(fx.actions.includes("locked-session"));
 assert(!fx.actions.includes("write"));
});
test("missing transaction cannot authenticate a mutation callback",async()=>{
 const fx=fixture({missingTx:true});
 const response=await acceptWorkerShopifyAdminMutation(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){throw Error("must never execute")},
 });
 assert.equal(response.status,503);
 assert.equal(fx.closes,1);
});
test("transaction failures are sanitized and SDK context always closes",async()=>{
 const fx=fixture({failOnTx:true});
 const response=await acceptWorkerShopifyAdminMutation(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){throw Error("must not execute")},
 });
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.equal(fx.closes,1);
});
test("other tenant hint cannot start database transaction",async()=>{
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminMutation(
  request("POST","other.myshopify.com"),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){throw Error("unauthorized write")},
 });
 assert.equal(response.status,401);
 assert(!fx.actions.includes("begin"));
 assert.equal(fx.closes,1);
});
