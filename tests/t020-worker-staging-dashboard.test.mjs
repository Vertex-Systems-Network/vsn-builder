import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  handleVerifiedStagingMerchantDashboard,
  renderStagingBillingRequired,
  renderVerifiedStagingMerchantDashboard,
} from "../app/services/worker-shopify-staging-dashboard.js";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
import worker from "../workers/app.js";

const origin="https://staging.builder.example.org";
const shop="one.myshopify.com",other="other.myshopify.com";
const id="offline_"+shop;
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",SHOPIFY_BILLING_TEST_MODE:"true",
  SHOPIFY_API_KEY:"a".repeat(32),SHOPIFY_API_SECRET:"synthetic-only",
  SHOPIFY_PRODUCTION_CLIENT_ID:"b".repeat(32),
  SHOPIFY_APP_URL:origin,SCOPES:SHOPIFY_EXPECTED_SCOPES.join(","),
  DATABASE_URL:"postgresql://ci:fake@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  VSN_STAGING_DASHBOARD_ENABLED:"true",
};
const page={id:"page-1",title:"Shop landing",template:"Blank",status:"draft",
  updatedAt:new Date("2026-10-15T12:00:00Z")};
const summary={total:2,draft:1,published:1,recent:[
  {...page,updatedAt:"2026-10-15T12:00:00.000Z"},
]};
const request=(hint=shop)=>new Request(origin+"/app?shop="+encodeURIComponent(hint));
function fixture({paid=true,roleAccessJson=null,expired=false,rotateSessionAfterRead=false,invalidPage=false,
  error=false}={}) {
  const calls=[];
  let sessionReads=0;
  const session={id,shop,isOnline:false,accessToken:"private-session-token"};
  const database={
    builderShopInstallation:{async findUnique({where}){
      calls.push({op:"install",where});
      return {shop,installedAt:new Date("2026-10-15"),uninstalledAt:null};
    }},
    session:{async findUnique({where}){
      calls.push({op:"session",where});
      sessionReads++;
      if(rotateSessionAfterRead && sessionReads>1)
        return {...session,accessToken:"rotated-private-session-token"};
      return expired?{...session,expires:new Date("2000-01-01")}:session;
    }},
    builderSubscription:{async findUnique({where}){
      calls.push({op:"paid",where});
      return paid?{shop,provider:"shopify-app-pricing",planKey:"starter",
        planHandle:"starter",status:"active",verifiedAt:new Date(),
        trialEndsAt:null,cancelEffectiveOn:null}:null;
    }},
    builderShopSetting:{async findUnique({where}){
      calls.push({op:"permission",where});
      return {roleAccessJson};
    }},
    builderPage:{
      async count({where}){
        calls.push({op:"count",where});
        if(error)throw Error("postgresql://secret/private");
        return where.status==="draft"?1:where.status==="published"?1:2;
      },
      async findMany({where,select,take}){
        calls.push({op:"recent",where,select,take});
        if(error)throw Error("secret-Neon-driver");
        return [invalidPage?{...page,title:"x".repeat(300)}:page];
      },
    },
  };
  const ctx={database,shopify:{authenticate:{admin:async(request)=>{
    calls.push({op:"sdk",url:new URL(request.url).search});return {session,admin:{}};
  }}},async close(){calls.push({op:"close"})}};
  return {calls,createSdkContext:async()=>ctx};
}
const serve=(f,e=env,req=request())=>
  handleVerifiedStagingMerchantDashboard(req,e,{
    createSdkContext:f.createSdkContext,
  });

test("Staging opt-in is explicit; production, bad tier, missing bindings and real Worker remain locked",async()=>{
  const f=fixture();
  for(const e of [
    {...env,VSN_STAGING_DASHBOARD_ENABLED:"false"},
    {...env,VSN_STAGING_DASHBOARD_ENABLED:undefined},
    {...env,APP_ENV:"production",VSN_WORKER_NAME:"vsn-builder-production"},
    {...env,VSN_WORKER_NAME:"vsn-builder-production"},
  ]){
    const res=await serve(f,e);
    assert.equal(res.status,503);
    assert.equal(await res.text(),"");
  }
  assert.equal(f.calls.length,0);
  assert.equal((await worker.fetch(request(),{...env,DATABASE_URL:""})).status,503,
    "real Worker must fail closed without actual hosted Neon credentials");
  assert.equal((await serve(f,env,new Request(origin+"/app",{method:"POST"}))).status,503);
  assert.equal((await serve(f,env,new Request(origin+"/app/pages"))).status,503);
});

test("official SDK and persisted paid staff scope grant only a read-only embedded dashboard",async()=>{
  const f=fixture();
  const res=await serve(f);
  assert.equal(res.status,200);
  assert.equal(res.headers.get("cache-control"),"no-store");
  assert.equal(res.headers.get("content-type"),"text/html; charset=utf-8");
  assert.match(res.headers.get("content-security-policy"),/script-src https:\/\/cdn.shopify.com/);
  assert.match(res.headers.get("content-security-policy"),/frame-ancestors https:\/\/admin.shopify.com/);
  assert.doesNotMatch(res.headers.get("content-security-policy"),/unsafe-eval|script-src 'unsafe-inline'/);
  const html=await res.text();
  assert.match(html,/<meta name="shopify-api-key" content="a{32}">/);
  assert.match(html,/cdn.shopify.com\/shopifycloud\/app-bridge.js/);
  assert.match(html,/>Total pages<\/div><div class="count">2<\/div>/);
  assert.match(html,/>Drafts<\/div><div class="count">1<\/div>/);
  assert.match(html,/>Published<\/div><div class="count">1<\/div>/);
  assert.match(html,/Shop landing/);
  assert.match(html,/Staging preview/);
  assert.match(html,/read-only/i);
  assert.doesNotMatch(html,/private-session-token|fake@|DATABASE_URL|SHOPIFY_API_SECRET/);
  assert.equal(f.calls[0].op,"sdk");
  const readCalls=f.calls.filter(c=>["count","recent"].includes(c.op));
  assert.equal(readCalls.length,4);
  assert(readCalls.every(c=>c.where.shop===shop&&c.where.deletedAt===null));
  assert.deepEqual(readCalls.find(c=>c.op==="recent").select,{
    id:true,title:true,template:true,status:true,updatedAt:true,
  });
  assert.equal(f.calls.at(-1).op,"close");
  assert(f.calls.every(c=>c.op!=="updateMany"&&c.op!=="deleteMany"));
});

test("embedded Shopify launch parameters reach SDK authentication unchanged",async()=>{
  const f=fixture();
  const requestWithLaunchParams=new Request(origin+
    "/app?shop="+shop+"&host=admin-host&embedded=1&hmac=signed-launch&timestamp=1792861042");
  const res=await serve(f,env,requestWithLaunchParams);
  assert.equal(res.status,200);
  assert.equal(f.calls.find(call=>call.op==="sdk")?.url,
    "?shop=one.myshopify.com&host=admin-host&embedded=1&hmac=signed-launch&timestamp=1792861042");
});

test("all attacker-controlled title/template/status/shop characters are HTML escaped",async()=>{
  const html=await renderVerifiedStagingMerchantDashboard({
    shop:"one.myshopify.com",apiKey:"a".repeat(32),
    summary:{total:1,draft:1,published:0,recent:[{
      id:"page_1",title:'<img src=x onerror="alert(1)">',
      template:"B&W <script>alert(2)</script>",status:'draft" onclick="evil()',
      updatedAt:"2026-10-15T12:00:00.000Z",
    }]},
  }).text();
  assert(!html.includes("<img src=x"));
  assert(!html.includes("<script>alert"));
  assert(!html.includes('onclick="evil()'));
  assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html,/B&amp;W &lt;script&gt;/);
  assert.match(html,/draft&quot; onclick=&quot;evil\(\)/);
});

test("unpaid Staging shops see only a billing notice, never merchant page data",async()=>{
  const f=fixture({paid:false});
  const res=await serve(f);
  assert.equal(res.status,200);
  assert.equal(res.headers.get("cache-control"),"no-store");
  const html=await res.text();
  assert.match(html,/<h1>Billing verification unavailable<\/h1>/);
  assert.match(html,/Billing verification unavailable/);
  assert.match(html,/separate internal Shopify app identity/);
  assert.match(html,/Partner API can verify managed subscriptions only for public apps/);
  assert.match(html,/This screen does not activate a plan or make a charge/);
  assert.doesNotMatch(html,/Total pages|Shop landing|private-session-token/);
  assert.equal(f.calls.filter(c=>c.op==="count"||c.op==="recent").length,0);
  assert.equal(f.calls.some(c=>c.op==="permission"),false);
  assert.equal(f.calls.at(-1).op,"close");

  const standalone=await renderStagingBillingRequired({shop,apiKey:env.SHOPIFY_API_KEY}).text();
  assert.match(standalone,/Billing verification unavailable/);
  assert.throws(()=>renderStagingBillingRequired({shop,apiKey:"invalid"}));
});

test("unpaid Staging billing notice survives a same-installation token refresh without page data",async()=>{
  const f=fixture({paid:false,rotateSessionAfterRead:true});
  const res=await serve(f);
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/Billing verification unavailable/);
  assert.doesNotMatch(html,/Total pages|Shop landing|private-session-token|rotated-private-session-token/);
  assert.equal(f.calls.filter(c=>c.op==="count"||c.op==="recent").length,0);
  assert.equal(f.calls.some(c=>c.op==="permission"),false);
  assert.equal(f.calls.at(-1).op,"close");
});

test("denied RBAC, expired sessions and forged tenant query fail closed before page data",async()=>{
  for(const options of [
    {roleAccessJson:JSON.stringify({editor:false})},
    {expired:true},
  ]){
    const f=fixture(options);
    const res=await serve(f);
    assert.equal(res.status,403,JSON.stringify(options));
    assert.equal(await res.text(),"");
    assert.equal(f.calls.filter(c=>c.op==="recent"||c.op==="count").length,0);
    assert.equal(f.calls.at(-1).op,"close");
  }
  const f=fixture();
  const res=await serve(f,env,request(other));
  assert.equal(res.status,401);
  assert.equal(f.calls.filter(c=>c.op==="recent"||c.op==="count").length,0);
  assert.equal(f.calls.at(-1).op,"close");
});

test("malformed pages, storage errors and oversized strings return empty 503, no driver diagnostics",async()=>{
  for(const opts of [{invalidPage:true},{error:true}]){
    const f=fixture(opts);
    const res=await serve(f);
    assert.equal(res.status,503);
    assert.equal(await res.text(),"");
    assert.equal(f.calls.at(-1).op,"close");
  }
  for(const invalid of [
    {...summary,total:1},
    {...summary,draft:3},
    {...summary,recent:[{...summary.recent[0],id:"../passwd"}]},
    {...summary,recent:[{...summary.recent[0],updatedAt:"not-a-date"}]},
  ])assert.throws(()=>renderVerifiedStagingMerchantDashboard({
    shop,apiKey:env.SHOPIFY_API_KEY,summary:invalid,
  }));
});

test("Worker only mounts GET /app read-only Staging opt-in; existing readiness remains 503",async()=>{
  const src=readFileSync("workers/app.js","utf8");
  assert.match(src,/handleVerifiedStagingMerchantDashboard\(request,env\)/);
  assert.match(src,/url\.pathname==="\/readyz"/);
  assert.match(src,/return locked\(\);/);
  assert.match(src,/url\.pathname\.startsWith\("\/auth\/"\)/);
  const bad=await worker.fetch(request(),{...env,VSN_WORKER_NAME:"wrong"});
  assert.equal(bad.status,503);
  assert.equal(await bad.text(),"");
  const health=await worker.fetch(new Request(origin+"/healthz"),env);
  assert.equal(health.status,200);
  assert.equal((await health.json()).merchantAppReady,false);
  const ready=await worker.fetch(new Request(origin+"/readyz"),env);
  assert.equal(ready.status,503);
});
