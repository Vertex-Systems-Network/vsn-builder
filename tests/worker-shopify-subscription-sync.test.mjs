import test from "node:test";
import assert from "node:assert/strict";
import {syncStagingShopifySubscription} from "../app/services/worker-shopify-subscription-sync.js";

const now=new Date("2026-10-25T12:00:00.000Z");
const shop="staging-oath3rth.myshopify.com";
const env={
  APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging",
  SHOPIFY_BILLING_TEST_MODE:"true",VSN_STAGING_BILLING_SYNC_ENABLED:"true",
  SHOPIFY_PARTNER_ORGANIZATION_ID:"4859256",
  SHOPIFY_PARTNER_API_TOKEN:"synthetic-partner-token",
  SHOPIFY_PARTNER_API_VERSION:"2026-07",
};
function setup({active=true,handle="starter",existing=null,identityShop=shop,
  trialEndsAt="2026-11-04T12:00:00.000Z"}={}){
  const calls=[];
  const rows={current:existing};
  const database={builderSubscription:{
    async findUnique(args){calls.push(["find",args]);return rows.current;},
    async upsert(args){calls.push(["upsert",args]);rows.current={shop:args.where.shop,...args.create,...args.update};return rows.current;},
  }};
  const admin={async graphql(query,options){
    calls.push(["admin",query,options]);
    return new Response(JSON.stringify({data:{
      currentAppInstallation:{app:{id:"gid://shopify/App/434691211265"}},
      shop:{id:"gid://shopify/Shop/123",myshopifyDomain:identityShop},
    }}),{status:200,headers:{"content-type":"application/json"}});
  }};
  const fetchImpl=async(url,options)=>{
    calls.push(["partner",url,options]);
    return new Response(JSON.stringify({data:{
      activeSubscription:active?{
        shop:{id:"gid://shopify/Shop/123",myshopifyDomain:shop},
        billingPeriod:"EVERY_30_DAYS",cancelAtEndOfCycle:false,
        trialEndsAt,
        currentBillingCycle:{startTime:"2026-10-25T12:00:00.000Z",endTime:"2026-11-24T12:00:00.000Z"},
        items:[{handle}],pendingUpdate:null,legacySubscriptionId:null,
      }:null,
      events:{edges:[]},
    }}),{status:200,headers:{"content-type":"application/json"}});
  };
  return {calls,rows,database,admin,fetchImpl};
}

test("Partner-verified trial is persisted with canonical plan handle and zero raw payload",async()=>{
  const fx=setup();
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.verified,true);
  assert.equal(result.row.planKey,"starter");
  assert.equal(result.row.planHandle,"starter");
  assert.equal(result.row.status,"trialing");
  assert.equal(result.row.provider,"shopify-app-pricing");
  assert.equal(result.row.trialEndsAt.toISOString(),"2026-11-04T12:00:00.000Z");
  assert.deepEqual(JSON.parse(result.row.snapshotJson),{source:"shopify-partner-api",verified:true});
  assert.equal(fx.calls.filter(call=>call[0]==="partner").length,1);
  assert.match(fx.calls.find(call=>call[0]==="partner")[2].headers["x-shopify-access-token"],/synthetic/);
});

test("allowlisted private $0 test plan is verified for the Staging shell",async()=>{
  const fx=setup({active:true,handle:"shopify-test",trialEndsAt:null});
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.verified,true);
  assert.equal(result.row.planKey,"shopify-test");
  assert.equal(result.row.planHandle,"shopify-test");
  assert.equal(result.row.status,"active");
});

test("a returned plan handle forces a new Partner lookup even when the mirror is cached",async()=>{
  const cached={shop,provider:"shopify-app-pricing",planKey:"inactive",status:"inactive",verifiedAt:now};
  const fx=setup({active:true,handle:"sliver",existing:cached});
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl,force:true});
  assert.equal(result.row.planKey,"sliver");
  assert.equal(fx.calls.filter(call=>call[0]==="partner").length,1);
});

test("fresh mirror avoids an unnecessary Partner request",async()=>{
  const existing={shop,provider:"shopify-app-pricing",planKey:"gold",status:"trialing",verifiedAt:new Date(now.getTime()-30_000)};
  const fx=setup({existing});
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(result.skipped,true);
  assert.equal(result.row,existing);
  assert.equal(fx.calls.filter(call=>call[0]==="partner").length,0);
  assert.equal(fx.calls.filter(call=>call[0]==="admin").length,0);
});

test("missing Partner secret or wrong tier cannot reach external APIs",async()=>{
  for(const config of [{...env,SHOPIFY_PARTNER_API_TOKEN:""},{...env,APP_ENV:"production"},{...env,VSN_WORKER_NAME:"vsn-builder-production"}]){
    const fx=setup();
    const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env:config,now,fetchImpl:fx.fetchImpl});
    assert.equal(result.ok,false);
    assert.equal(result.reason,"not-configured");
    assert.equal(fx.calls.some(call=>call[0]==="admin"||call[0]==="partner"),false);
  }
});

test("mismatched authenticated Shopify identity fails closed without writing a mirror",async()=>{
  const fx=setup({identityShop:"foreign-shop.myshopify.com"});
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.reason,"partner-verification-failed");
  assert.equal(result.stage,"identity-mismatch");
  assert.equal(fx.calls.some(call=>call[0]==="upsert"),false);
});

test("unknown or absent contract never creates a paid entitlement",async()=>{
  for(const options of [{active:false},{active:true,handle:"unknown-plan"}]){
    const fx=setup(options);
    const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
    assert.equal(result.ok,true);
    assert.equal(result.row.planKey,"inactive");
    assert.equal(result.row.planHandle,null);
    assert.equal(result.row.status,"inactive");
  }
});

test("Partner HTTP failure reports only a fixed diagnostic stage",async()=>{
  const fx=setup();
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,
    fetchImpl:async()=>new Response("secret body",{status:401})});
  assert.equal(result.ok,false);
  assert.equal(result.stage,"partner-http-401");
  assert.equal(fx.calls.some(([op])=>op==="upsert"),false);
});

test("uncoded failures report the failing step without payload",async()=>{
  const fx=setup();
  const network=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,
    fetchImpl:async()=>{throw new TypeError("fetch failed");}});
  assert.equal(network.stage,"partner-type-error");
  const fy=setup();
  fy.database.builderSubscription.upsert=async()=>{throw Object.assign(new Error("column missing"),{code:"P2022"});};
  const write=await syncStagingShopifySubscription({database:fy.database,admin:fy.admin,shop,env,now,fetchImpl:fy.fetchImpl});
  assert.equal(write.stage,"mirror-write-p2022");
});

test("Shopify SDK HTTP and GraphQL failures report a fixed status or code",async()=>{
  const fx=setup();
  fx.admin.graphql=async()=>{throw new Response("{}",{status:401});};
  const http=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(http.stage,"admin-identity-http-401");
  const fy=setup();
  fy.admin.graphql=async()=>{throw Object.assign(new Error("GraphQL Client: denied"),
    {name:"GraphqlQueryError",code:"admin-identity-error",body:{errors:{graphQLErrors:[{message:"secret",extensions:{code:"ACCESS_DENIED"}}]}}});};
  const gql=await syncStagingShopifySubscription({database:fy.database,admin:fy.admin,shop,env,now,fetchImpl:fy.fetchImpl});
  assert.equal(gql.stage,"admin-identity-gql-access-denied");

  const fz=setup();
  fz.admin.graphql=async()=>new Response(JSON.stringify({errors:[
    {message:"secret",extensions:{code:"ACCESS_DENIED"}},
  ]}),{status:200,headers:{"content-type":"application/json"}});
  const returnedGql=await syncStagingShopifySubscription({database:fz.database,admin:fz.admin,shop,env,now,fetchImpl:fz.fetchImpl});
  assert.equal(returnedGql.stage,"admin-identity-gql-access-denied");

  const fw=setup();
  fw.admin.graphql=async()=>{throw Object.assign(new Error("wrapped SDK error"),{
    code:"admin-identity-error",
    cause:Object.assign(new Error("denied"),{
      name:"GraphqlQueryError",
      body:{errors:[{extensions:{code:"ACCESS_DENIED"}}]},
    }),
  });};
  const wrappedGql=await syncStagingShopifySubscription({database:fw.database,admin:fw.admin,shop,env,now,fetchImpl:fw.fetchImpl});
  assert.equal(wrappedGql.stage,"admin-identity-gql-access-denied");

  const fh=setup();
  fh.admin.graphql=async()=>{throw Object.assign(new Error("wrapped SDK error"),{
    code:"admin-identity-error",cause:new Response("secret",{status:403}),
  });};
  const wrappedHttp=await syncStagingShopifySubscription({database:fh.database,admin:fh.admin,shop,env,now,fetchImpl:fh.fetchImpl});
  assert.equal(wrappedHttp.stage,"admin-identity-http-403");
});


test("wrapped Shopify SDK responses expose GraphQL codes without logging response bodies",async()=>{
  const fx=setup();
  fx.admin.graphql=async()=>{throw Object.assign(new Error("GraphQL Client: denied"),{
    code:"admin-identity-error",
    response:new Response(JSON.stringify({errors:[
      {message:"private detail",extensions:{code:"ACCESS_DENIED"}},
    ]}),{status:200,headers:{"content-type":"application/json"}}),
  });};
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.equal(result.stage,"admin-identity-gql-access-denied");
  assert.equal(fx.calls.some(([op])=>op==="partner"||op==="upsert"),false);
});


test("opaque SDK identity errors expose only a bounded wrapper shape",async()=>{
  const fx=setup();
  fx.admin.graphql=async()=>{throw Object.assign(new Error("private error text"),{
    code:"admin-identity-error",
    response:new Response("private response text",{status:200}),
  });};
  const result=await syncStagingShopifySubscription({database:fx.database,admin:fx.admin,shop,env,now,fetchImpl:fx.fetchImpl});
  assert.match(result.stage,/^admin-identity-shape-/);
  assert.equal(result.stage.includes("private"),false);
  assert.equal(fx.calls.some(([op])=>op==="partner"||op==="upsert"),false);
});
