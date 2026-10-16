import test from "node:test";
import assert from "node:assert/strict";
import {syncPrivateStagingSecrets} from "../scripts/t019-private-staging-secret-sync.mjs";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
const ORIGIN="https://vsn-builder-staging.vertexsystemsnetwork.workers.dev";
const ACCOUNT="f63cf3af0868a5c8a0b26ebee5dd039f";
const SECRET_KEYS=["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET"];
const STAGE="0ecd6b7151485b41ea65924fe827806a";
const baseEnv=()=>({
 GITHUB_REPOSITORY:"Vertex-Systems-Network/vsn-builder",
 GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true",
 GITHUB_EVENT_NAME:"push",APP_ENV:"staging",
 NEON_PROJECT_ID:"shiny-violet-61219572",
 CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
 CLOUDFLARE_API_TOKEN:"synthetic-private-cloud-token-not-real",
 SHOPIFY_API_KEY:STAGE,
 SHOPIFY_API_SECRET:"synthetic-private-shopify-secret-not-real",
 DATABASE_URL:"postgresql://synthetic:password@ep-little-dream-b3g6puj2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
});
const plain=()=>[
 {name:"APP_ENV",type:"plain_text",text:"staging"},
 {name:"VSN_WORKER_NAME",type:"plain_text",text:"vsn-builder-staging"},
 {name:"NEON_PROJECT_ID",type:"plain_text",text:"shiny-violet-61219572"},
 {name:"SHOPIFY_BILLING_TEST_MODE",type:"plain_text",text:"true"},
 {name:"SHOPIFY_APP_URL",type:"plain_text",text:ORIGIN},
 {name:"SCOPES",type:"plain_text",text:SHOPIFY_EXPECTED_SCOPES.join(",")},
];
function provider({alreadyBound=false,publicRoute=false,mutate,deployChange=false,
 failPatch=false}={}){
 const state={bindings:plain(),secrets:[]};
 if(alreadyBound){state.secrets=SECRET_KEYS.map(name=>({name,type:"secret_text"}));
   state.bindings.push(...state.secrets.map(x=>({...x})))}
 if(mutate)mutate(state);
 const ops=[];
 const fake=async(url,opts)=>{
  const pathname=new URL(url).pathname;
  const path=pathname.split("/").at(-1);
  ops.push({path,method:opts.method,body:opts.body});
  assert.equal(new URL(url).origin,"https://api.cloudflare.com");
  assert(pathname.includes("/accounts/"+ACCOUNT+"/workers/scripts/vsn-builder-staging/"));
  assert.equal(opts.redirect,"error");
  assert.equal(opts.headers.authorization,"Bearer synthetic-private-cloud-token-not-real");
  if(opts.method==="PATCH"){
   assert.equal(path,"secrets-bulk");
   assert.equal(opts.headers["content-type"],"application/merge-patch+json");
   if(failPatch)return {ok:false,status:403};
   const patch=JSON.parse(opts.body);
   assert.deepEqual(Object.keys(patch),["secrets"]);
   assert.deepEqual(Object.keys(patch.secrets).sort(),SECRET_KEYS.slice().sort());
   for(const name of SECRET_KEYS){
    const secret=patch.secrets[name];
    assert.deepEqual({name:secret.name,type:secret.type},{name,type:"secret_text"});
    assert.equal(secret.text,baseEnv()[name]);
   }
   state.secrets=SECRET_KEYS.map(name=>({name,type:"secret_text"}));
   state.bindings.push(...state.secrets.map(x=>({...x})));
   return {ok:true,json:async()=>({success:true,result:{id:"version-only"}})};
  }
  assert.equal(opts.method,"GET");
  const result=path==="settings"?{bindings:state.bindings}:
   path==="secrets"?state.secrets:
   path==="subdomain"?{enabled:publicRoute,previews_enabled:false}:
   path==="deployments"?{deployments:[{id:deployChange&&ops.some(x=>x.method==="PATCH")?
       "unexpected-new-deploy":"existing-locked-deploy"}]}:null;
  assert.notEqual(result,null);
  return {ok:true,json:async()=>({success:true,result})};
 };
 return {fake,ops,state};
}
test("secure 3-secret staging bulk write creates ONE new version without deploying Worker",async()=>{
 const cloud=provider();
 const result=await syncPrivateStagingSecrets(baseEnv(),{fetchImpl:cloud.fake});
 assert.deepEqual(result,{ready:true,worker:"vsn-builder-staging",
  secretCount:3,updated:true,activeDeploymentUnchanged:true,
  publicRouteEnabled:false,merchantOAuthVerified:false,productionTouched:false});
 assert.equal(cloud.ops.filter(x=>x.method==="PATCH").length,1);
 assert.deepEqual(cloud.ops.filter(x=>x.method==="GET").length,8);
 const metadata=JSON.stringify(result);
 for(const value of ["synthetic-private-cloud-token-not-real",
 "synthetic-private-shopify-secret-not-real","postgresql://"])
  assert(!metadata.includes(value));
});
test("idempotent existing binding inventory performs no secret writes",async()=>{
 const cloud=provider({alreadyBound:true});
 const result=await syncPrivateStagingSecrets(baseEnv(),{fetchImpl:cloud.fake});
 assert.equal(result.ready,true);
 assert.equal(result.updated,false);
 assert.equal(cloud.ops.some(x=>x.method==="PATCH"),false);
});
test("untrusted ref, fork, missing/wrong tier identities and bad Neon host reject before any Cloudflare request",async()=>{
 const cases=[
 {GITHUB_REPOSITORY:"attacker/fork"},
 {GITHUB_REF:"refs/heads/main"},{GITHUB_REF_PROTECTED:"false"},
 {GITHUB_EVENT_NAME:"pull_request"},{APP_ENV:"production"},
 {NEON_PROJECT_ID:"nameless-violet-68750490"},
 {CLOUDFLARE_ACCOUNT_ID:"a".repeat(32)},{CLOUDFLARE_API_TOKEN:""},
 {SHOPIFY_API_KEY:"997eae5a9961f21d131e5f31bbbe31d3"},
 {SHOPIFY_API_SECRET:""},
 {DATABASE_URL:"postgresql://synthetic:pwd@ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"},
 {DATABASE_URL:"postgresql://synthetic:pwd@ep-little-dream-b3g6puj2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=disable"},
 ];
 for(const changes of cases){
  const cloud=provider();
  await assert.rejects(syncPrivateStagingSecrets({...baseEnv(),...changes},{
   fetchImpl:cloud.fake,
  }),{code:"T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED"});
  assert.equal(cloud.ops.length,0);
 }
});
test("never upload secrets to a public Worker, nonempty secret inventory, or unexpected binding",async()=>{
 const cases=[
 {publicRoute:true},
 {mutate:s=>s.bindings.push({name:"DIRECT_URL",type:"plain_text",text:"bad"})},
 {mutate:s=>s.bindings.push({name:"SHOPIFY_API_KEY",type:"plain_text",text:STAGE})},
 {mutate:s=>s.secrets.push({name:"CLOUDFLARE_API_TOKEN",type:"secret_text"})},
 {mutate:s=>s.bindings.find(x=>x.name==="APP_ENV").text="production"},
 {mutate:s=>s.bindings.find(x=>x.name==="SCOPES").text="read_products"},
 {mutate:s=>s.bindings.push({...s.bindings[0]})},
 ];
 for(const condition of cases){
  const cloud=provider(condition);
  await assert.rejects(syncPrivateStagingSecrets(baseEnv(),{fetchImpl:cloud.fake}),
   {code:"T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED"});
  assert.equal(cloud.ops.some(x=>x.method==="PATCH"),false);
 }
});
test("partial existing secrets and Cloudflare PATCH failure block without provider error disclosure",async()=>{
 const partial=provider({mutate:s=>{
  s.secrets.push({name:"DATABASE_URL",type:"secret_text"});
  s.bindings.push({name:"DATABASE_URL",type:"secret_text"});
 }});
 await assert.rejects(syncPrivateStagingSecrets(baseEnv(),{fetchImpl:partial.fake}),
  {code:"T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED"});
 assert(!partial.ops.some(x=>x.method==="PATCH"));
 const failed=provider({failPatch:true});
 const error=await syncPrivateStagingSecrets(baseEnv(),{fetchImpl:failed.fake}).catch(x=>x);
 assert.equal(error.code,"T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED");
 assert(!String(error).includes("synthetic-private-cloud"));
});
test("bulk version MUST NOT cause active deployment ID to change",async()=>{
 const cloud=provider({deployChange:true});
 await assert.rejects(syncPrivateStagingSecrets(baseEnv(),{fetchImpl:cloud.fake}),
  {code:"T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED"});
 assert.equal(cloud.ops.filter(x=>x.method==="PATCH").length,1);
 assert.equal(cloud.ops.filter(x=>x.path==="deployments").length,2);
});
