import test from "node:test";
import assert from "node:assert/strict";
import {acceptWorkerShopifyAdminRequest} from "../app/services/worker-shopify-admin-gate.js";
import {createWorkerShopifySdkContext} from "../app/services/shopify-worker-sdk-context.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const env={
 APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
 SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-admin-only-ci-secret",
 SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
 SHOPIFY_APP_URL:"https://staging.builder.example.org",
 SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
 DATABASE_URL:"postgresql://synthetic:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
const shop="ci-authenticated.myshopify.com";
const session={id:"offline_"+shop,shop,state:"",isOnline:false,accessToken:"not-real-token"};
const request=(path="/app?shop="+shop,method="GET")=>
 new Request(env.SHOPIFY_APP_URL+path,{method});
const entry={
 shop,installedAt:new Date("2026-10-13T10:00:00.000Z"),
 uninstalledAt:null,
};
function fixture({authenticated=session,stored=session,lifecycle=entry,failDatabase=false,
 throwAuth=null}={}){
 const calls=[];
 const context={
  shopify:{authenticate:{
   async admin(req){
    calls.push(["official-admin",req.url]);
    if(throwAuth)throw throwAuth;
    return {session:authenticated,admin:{graphql:async()=>{throw Error("not an API call")}}};
   },
  }},
  database:{
   builderShopInstallation:{
    async findUnique({where}){
     calls.push(["lifecycle",where.shop]);
     if(failDatabase)throw Error("postgresql://sensitive:password@private.neon.tech");
     return lifecycle;
    },
   },
   session:{
    async findUnique({where}){calls.push(["session",where.id]);return stored},
   },
  },
  async close(){calls.push(["close"])},
 };
 return {context,calls,createSdkContext:async()=>context};
}
const pass=async()=>new Response("Authenticated app data",{status:200});
const run=(options={},req=request(),environment=env,callback=pass)=>{
 const fx=fixture(options);
 return acceptWorkerShopifyAdminRequest(req,environment,{
  createSdkContext:fx.createSdkContext,
  onAuthenticated:callback,
 }).then(response=>({response,...fx}));
};

test("official SDK session plus persisted active generation authorizes merchant-scoped app",async()=>{
 let observed;
 const {response,calls}=await run({},request(),env,async values=>{
  observed=values;
  return pass();
 });
 assert.equal(response.status,200);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 assert.equal(await response.text(),"Authenticated app data");
 assert.equal(observed.shop,shop);
 assert.equal(observed.session.id,session.id);
 assert.deepEqual(calls.map(row=>row[0]),["official-admin","lifecycle","session","lifecycle","session","close"]);
});
test("unsigned shop query or fabricated authorization header cannot grant access",async()=>{
 let called=false;
 for(const unauthenticated of [null, {shop:"invalid.example.test"}, {shop,accessToken:"fake"}]){
  const fx=fixture({authenticated:unauthenticated});
  const result=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){called=true;return pass()},
  });
  assert.equal(result.status,401);
  assert.deepEqual(fx.calls.map(c=>c[0]),["official-admin","close"]);
 }
 const req=new Request(env.SHOPIFY_APP_URL+"/app?shop="+shop,{
  headers:{Authorization:"Bearer fabricated-for-ci-only"},
 });
 const fx=fixture({authenticated:null});
 assert.equal((await acceptWorkerShopifyAdminRequest(req,env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){called=true;return pass()},
 })).status,401);
 assert.equal(called,false);
});
test("Shopify merchant from SDK is authoritative; URL tenant conflict is denied",async()=>{
 const bad=await run({},request("/app?shop=another-merchant.myshopify.com"));
 assert.equal(bad.response.status,401);
 assert(!bad.calls.some(([key])=>key==="session"));
 const invalid=await run({},request("/app?shop=merchant.example.test"));
 assert.equal(invalid.response.status,400);
 assert.deepEqual(invalid.calls,[]);
});
test("duplicate or percent-aliased Shopify shop query denied before SDK/Neon",async()=>{
 for(const uri of [
  "/app?shop="+shop+"&shop=foreign.myshopify.com",
  "/app?shop="+shop+"&%73hop="+shop,
  "/app/__vsn/page-summary?shop="+shop+"&shop="+shop,
 ]){
  const {response,calls}=await run({},request(uri));
  assert.equal(response.status,400,uri);
  assert.equal(await response.text(),"");
  assert.deepEqual(calls,[],"no request-scoped SDK context should open");
 }
 const {response}=await run({},request("/app?shop="+shop));
 assert.equal(response.status,200,"canonical Shopify hint unaffected");
});

test("uninstalled shop, missing generation and stale token are refused",async()=>{
 for(const options of [
  {lifecycle:null},
  {lifecycle:{...entry,uninstalledAt:new Date("2026-10-13T12:00:00Z")}},
  {lifecycle:{...entry,installedAt:"untrusted"}},
  {stored:null},
  {stored:{...session,shop:"second.myshopify.com"}},
  {stored:{...session,accessToken:"different-token"}},
  {stored:{...session,isOnline:true}},
 ]) {
  let called=false;
  const r=await run(options,request(),env,async()=>{
   called=true;return pass();
  });
  assert.equal(r.response.status,403);
  assert.equal(called,false);
  assert.equal(r.calls.at(-1)[0],"close");
 }
});
test("expired, malformed or missing online-session expiry never authorizes Admin GET",async()=>{
 const expired=new Date("2025-01-01T00:00:00.000Z");
 const future=new Date("2099-01-01T00:00:00.000Z");
 const badCases=[
  {stored:{...session,expires:expired}},
  {stored:{...session,expires:"2099-01-01T00:00:00Z"}},
  {authenticated:{...session,expires:expired}},
  {authenticated:{...session,expires:"not-a-date"}},
  {authenticated:{...session,isOnline:true,expires:future},
   stored:{...session,isOnline:true}},
  {authenticated:{...session,isOnline:true},
   stored:{...session,isOnline:true,expires:future}},
 ];
 for(const options of badCases){
  let reached=false;
  const {response,calls}=await run(options,request(),env,async()=>{
   reached=true;return pass();
  });
  assert.equal(response.status,403);
  assert.equal(reached,false);
  assert.equal(calls.at(-1)[0],"close");
 }
 // Non-expired expiring offline tokens are still valid. Online tokens need
 // actual future expiration on both SDK and DB session objects.
 for(const options of [
  {authenticated:{...session,expires:future},
   stored:{...session,expires:future}},
  {authenticated:{...session,isOnline:true,expires:future},
   stored:{...session,isOnline:true,expires:future}},
 ]){
  const {response}=await run(options);
  assert.equal(response.status,200);
 }
});
test("Shopify native reauth Response passes through unchanged, including headers",async()=>{
 const redirect=new Response(null,{status:302,headers:{
  location:"https://admin.shopify.com/store/ci/auth",
  "set-cookie":"shopify-reauth=test; Secure; HttpOnly",
 }});
 const {response,calls}=await run({throwAuth:redirect});
 assert.equal(response,redirect);
 assert.equal(response.status,302);
 assert.equal(response.headers.get("set-cookie"),redirect.headers.get("set-cookie"));
 assert.deepEqual(calls.map(x=>x[0]),["official-admin","close"]);
});
test("unexpected driver/auth failures sanitize credentials and always close context",async()=>{
 for(const options of [
  {failDatabase:true},
  {throwAuth:new Error("postgresql://sensitive:private@host")},
 ]){
  const {response,calls}=await run(options);
  assert.equal(response.status,503);
  assert.equal(await response.text(),"");
  assert.equal(calls.at(-1)[0],"close");
 }
 const invalidResponse=await run({},request(),env,async()=>({status:200}));
 assert.equal(invalidResponse.response.status,503);
 assert.equal(invalidResponse.calls.at(-1)[0],"close");
});
test("tier identity and route/method blockers never construct session/SDK context",async()=>{
 for(const [req,identity,status] of [
  [request("/webhooks/app/uninstalled"),env,404],
  [request("/apps"),env,404],
  [request("/app","PUT"),env,405],
  [request(),{...env,NEON_PROJECT_ID:"nameless-violet-68750490"},503],
  [request(),{...env,APP_ENV:"production"},503],
 ]){
  let opened=false;
  const result=await acceptWorkerShopifyAdminRequest(req,identity,{
   createSdkContext(){opened=true},
   onAuthenticated:pass,
  });
  assert.equal(result.status,status);
  assert.equal(opened,false);
 }
});
test("actual official Shopify SDK does NOT trust a bare query shop as an authenticated merchant",async()=>{
 const req=request();
 const fx=fixture({authenticated:undefined});
 let called=false;
 const response=await acceptWorkerShopifyAdminRequest(req,env,{
  async createSdkContext(signedRequest,settings) {
   return createWorkerShopifySdkContext(signedRequest,settings,{
    async createSessionContext(){
     return {
      database:fx.context.database,
      sessionStorage:{
       async storeSession(){return true},
       async loadSession(){return undefined},
       async deleteSession(){return true},
       async deleteSessions(){return true},
       async findSessionsByShop(){return []},
       async isReady(){return true},
      },
      async close(){fx.calls.push(["close"])},
     };
    },
   });
  },
  async onAuthenticated(){called=true;return pass()},
 });
 assert.equal(called,false);
 assert(fx.calls.some(([action])=>action==="close"),"Real SDK context must close after reject/reauth");
 assert([200,302,401,403,503].includes(response.status));
});

test("GET waits for authenticated streamed body before disconnecting Neon session",async()=>{
 const order=[];
 const fx=fixture();
 let closed=false;
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:async()=>({
     ...fx.context,
     async close(){closed=true;order.push("disconnect");await fx.context.close();},
   }),
   async onAuthenticated(){
     return new Response(new ReadableStream({
       async pull(controller){
         assert.equal(closed,false,"database must outlive GET body consumption");
         order.push("stream-pull");
         await Promise.resolve();
         controller.enqueue(new TextEncoder().encode('{"verified":true}'));
         controller.close();
       },
     }),{headers:{"content-type":"application/json","content-length":"17"}});
   },
 });
 assert.equal(response.status,200);
 assert.equal(await response.text(),'{"verified":true}');
 assert.equal(response.headers.get("content-length"),null);
 assert.deepEqual(order,["stream-pull","disconnect"]);
 assert.equal(fx.calls.at(-1)[0],"close");
});

test("GET rejects broken streaming payload and closes session without leaking errors",async()=>{
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){
     return new Response(new ReadableStream({
       pull(controller){controller.error(new Error("postgresql://secret:token@host"));},
     }),{status:200});
   },
 });
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.equal(fx.calls.at(-1)[0],"close");
});

test("GET fails closed on oversized responses before returning any partial merchant data",async()=>{
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){
     return new Response(new Uint8Array(8*1024*1024+1),{status:200,
       headers:{"content-type":"application/octet-stream"}});
   },
 });
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.equal(fx.calls.at(-1)[0],"close");
});

test("GET callback 5xx body never exposes internal Shopify/Neon diagnostics",async()=>{
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){
     return new Response("DATABASE_URL=postgresql://private:user@host",{status:500});
   },
 });
 assert.equal(response.status,503);
 assert.equal(await response.text(),"");
 assert.equal(fx.calls.at(-1)[0],"close");
});

test("T020 privileged page GET rechecks installation generation after body consumption",async()=>{
 const authorized="ci-authenticated.myshopify.com";
 const checks=[
  {
   reason:"concurrent uninstall",
   change:s=>{s.install.uninstalledAt=new Date("2026-10-17T09:00:00Z");},
  },
  {
   reason:"concurrent reinstall generation replacement",
   change:s=>{s.install.installedAt=new Date("2026-10-17T09:00:00Z");},
  },
  {
   reason:"concurrent access token rotation",
   change:s=>{s.persisted.accessToken="rotated-secret-token";},
  },
  {
   reason:"concurrent session deletion",
   change:s=>{s.persisted=null;},
  },
  {reason:"stable active installation",change:()=>{},allowed:true},
 ];
 for(const scenario of checks){
  const state={
   install:{shop:authorized,installedAt:new Date("2026-10-13T10:00:00Z"),
    uninstalledAt:null},
   persisted:{...session},
  };
  const events=[];
  const db={
   builderShopInstallation:{async findUnique(){
    events.push("installation");
    return state.install?{...state.install}:null;
   }},
   session:{async findUnique(){
    events.push("session");
    return state.persisted?{...state.persisted}:null;
   }},
   builderSubscription:{async findUnique(){
    return {shop:authorized,provider:"shopify-app-pricing",
     planKey:"starter",planHandle:"starter",status:"active",
     verifiedAt:new Date(),trialEndsAt:null,cancelEffectiveOn:null};
   }},
   builderShopSetting:{async findUnique(){return {roleAccessJson:null};}},
   builderPage:{
    async count(){return 0},
    async findMany(){return []},
   },
  };
  const response=await acceptWorkerShopifyAdminRequest(request(),env,{
   async createSdkContext(){
    return {
     database:db,
     shopify:{authenticate:{async admin(){return {
      session:{...session},admin:{},
     }}}},
     async close(){events.push("close")},
    };
   },
   enablePageSummary:true,
   async onAuthenticated(){
    return new Response(new ReadableStream({
     pull(controller){
      scenario.change(state);
      events.push("stream-finished");
      controller.enqueue(new TextEncoder().encode("PRIVATE_PAGE_CONTENT"));
      controller.close();
     },
    }),{status:200,headers:{"content-type":"text/plain"}});
   },
  });
  assert.equal(response.status,scenario.allowed?200:403,scenario.reason);
  assert.equal(await response.text(),scenario.allowed?"PRIVATE_PAGE_CONTENT":"",scenario.reason);
  assert.deepEqual(events.slice(-4),[
   "stream-finished","installation","session","close",
  ],"Final read fence must execute after body consumption before disconnect");
 }
});

test("T020 persisted Node/Worker Session.id must match authenticated SDK identity",async()=>{
 const res=await run({stored:{...session,id:"offline_other.myshopify.com"}});
 assert.equal(res.response.status,403);
 assert.equal(await res.response.text(),"");
 assert.equal(res.calls.at(-1)[0],"close");
});

test("T020 callback read errors are status-only and cannot disclose internal diagnostics",async()=>{
 for(const status of [400,401,403,404,409,422]){
  const fx=fixture();
  const r=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){
    return new Response("postgresql://secret:private@staging / SHOPIFY_API_SECRET",{
     status,headers:{"x-unsafe-debug":"credential-value"},
    });
   },
  });
  assert.equal(r.status,status);
  assert.equal(await r.text(),"");
  assert.equal(r.headers.get("cache-control"),"no-store");
  assert.equal(r.headers.get("x-unsafe-debug"),null);
  assert.equal(fx.calls.at(-1)[0],"close");
 }
});
test("T020 ordinary read callbacks cannot set cookies or return external redirects",async()=>{
 const responses=[
  new Response("private body",{status:200,headers:{"set-cookie":"session=forged"}}),
  new Response("private body",{status:200,headers:{"location":"https://evil.example/steal"}}),
  Response.redirect("https://evil.example/steal",302),
 ];
 for(const result of responses){
  const fx=fixture();
  const r=await acceptWorkerShopifyAdminRequest(request(),env,{
   createSdkContext:fx.createSdkContext,
   async onAuthenticated(){return result;},
  });
  assert.equal(r.status,503);
  assert.equal(await r.text(),"");
  assert.equal(r.headers.get("set-cookie"),null);
  assert.equal(r.headers.get("location"),null);
  assert.equal(fx.calls.at(-1)[0],"close");
 }
});

test("T020 GET route callback thrown redirect cannot impersonate official Shopify SDK reauth",async()=>{
 const forged=new Response(null,{status:302,headers:{
  location:"https://evil.example/redirect",
  "set-cookie":"shopify-reauth=forged; Secure; HttpOnly",
 }});
 const fx=fixture();
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
  createSdkContext:fx.createSdkContext,
  async onAuthenticated(){throw forged},
 });
 assert.equal(response.status,503);
 assert.equal(response.headers.get("set-cookie"),null);
 assert.equal(response.headers.get("location"),null);
 assert.equal(await response.text(),"");
 assert.equal(fx.calls.at(-1)[0],"close");
});
test("T020 a forged Response from creating SDK context is not an authenticated SDK response",async()=>{
 const response=await acceptWorkerShopifyAdminRequest(request(),env,{
  async createSdkContext(){
   throw Response.redirect("https://evil.example/forged-sdk-init",302);
  },
  async onAuthenticated(){throw Error("must not run")},
 });
 assert.equal(response.status,503);
 assert.equal(response.headers.get("location"),null);
 assert.equal(await response.text(),"");
});

test("T020 ALL authenticated GETs revalidate installation and token after body, not just page routes",async()=>{
 const scenarios=[
  {name:"uninstall",mutate:s=>{s.install.uninstalledAt=new Date("2026-10-17T12:00:00Z")}},
  {name:"uninstall and reinstall",mutate:s=>{s.install.installedAt=new Date("2026-10-17T12:05:00Z")}},
  {name:"same generation token rotation",mutate:s=>{s.persisted.accessToken="new-secret"}},
  {name:"persisted token deleted",mutate:s=>{s.persisted=null}},
  {name:"persisted token expired",mutate:s=>{s.persisted.expires=new Date("2020-01-01T00:00:00Z")}},
  {name:"no concurrent change",mutate:()=>{},allow:true},
 ];
 for(const scenario of scenarios){
  const state={install:{...entry},persisted:{...session}};
  const calls=[];
  const response=await acceptWorkerShopifyAdminRequest(request("/app/settings?shop="+shop),env,{
   async createSdkContext(){
    return {
     shopify:{authenticate:{async admin(){
      calls.push("sdk");
      return {session:{...session},admin:{}};
     }}},
     database:{
      builderShopInstallation:{async findUnique(){
       calls.push("installation");
       return state.install?{...state.install}:null;
      }},
      session:{async findUnique(){
       calls.push("token");
       return state.persisted?{...state.persisted}:null;
      }},
     },
     async close(){calls.push("close")},
    };
   },
   async onAuthenticated(){
    return new Response(new ReadableStream({
     pull(controller){
      scenario.mutate(state);
      calls.push("body-complete");
      controller.enqueue(new TextEncoder().encode("PRIVATE_MERCHANT_SETTINGS"));
      controller.close();
     },
    },{highWaterMark:0}),{status:200,headers:{"content-type":"text/plain"}});
   },
  });
  assert.equal(response.status,scenario.allow?200:403,scenario.name);
  assert.equal(await response.text(),scenario.allow?"PRIVATE_MERCHANT_SETTINGS":"",scenario.name);
  assert.deepEqual(calls,["sdk","installation","token","body-complete","installation","token","close"],
   scenario.name+" must fence the response before SDK/Neon cleanup");
 }
});
