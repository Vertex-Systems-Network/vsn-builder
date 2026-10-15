import test from "node:test";
import assert from "node:assert/strict";
import {verifyCloudflareStagingBindings} from "../scripts/phase4-staging-cloudflare-readiness.mjs";
function env(overrides={}){
 return {
  GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true",
  GITHUB_EVENT_NAME:"workflow_dispatch",APP_ENV:"staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",
  CLOUDFLARE_WORKER_NAME:"vsn-builder-staging",
  CLOUDFLARE_ACCOUNT_ID:"a".repeat(32),
  CLOUDFLARE_API_TOKEN:"synthetic-ci-never-cloud-token",...overrides,
 };
}
function payload(){
 return {
  secrets:[
   {name:"DATABASE_URL",type:"secret_text"},{name:"SHOPIFY_API_SECRET",type:"secret_text"},
  ],
  settings:{bindings:[
   {name:"SHOPIFY_API_KEY",type:"plain_text",text:"b".repeat(32)},
   {name:"SHOPIFY_APP_URL",type:"plain_text",text:"https://staging.builder.synthetic.dev"},
   {name:"SHOPIFY_PRODUCTION_CLIENT_ID",type:"plain_text",text:"c".repeat(32)},
   {name:"SCOPES",type:"plain_text",text:"read_products"},
   {name:"APP_ENV",type:"plain_text",text:"staging"},
   {name:"VSN_WORKER_NAME",type:"plain_text",text:"vsn-builder-staging"},
   {name:"NEON_PROJECT_ID",type:"plain_text",text:"shiny-violet-61219572"},
   {name:"SHOPIFY_BILLING_TEST_MODE",type:"plain_text",text:"true"},
  ]},
 };
}
function cloud(data=payload(),status=200){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  const endpoint=new URL(url).pathname.split("/").at(-1);
  calls.push(endpoint);
  assert.equal(opts.method,"GET");
  assert.equal(opts.headers.authorization,"Bearer synthetic-ci-never-cloud-token");
  assert.ok(url.includes("/workers/scripts/vsn-builder-staging/"));
  return {ok:status===200,status,async json(){
   return {success:status===200,result:data[endpoint]};
  }};
 };
 return {fetchImpl,calls};
}
test("Cloudflare Staging metadata attestation only checks scoped names and tier config",async()=>{
 const c=cloud();
 const result=await verifyCloudflareStagingBindings(env(),{fetchImpl:c.fetchImpl});
 assert.equal(result.ready,true);
 assert.deepEqual(c.calls.sort(),["secrets","settings"]);
});
test("Reject missing credentials, unprotected branch, Live project before network",async()=>{
 for(const extra of [
  {CLOUDFLARE_API_TOKEN:""},{CLOUDFLARE_ACCOUNT_ID:"invalid"},
  {GITHUB_REF_PROTECTED:"false"},{GITHUB_REF:"refs/heads/main"},
  {APP_ENV:"production"},{NEON_PROJECT_ID:"nameless-violet-68750490"},
  {CLOUDFLARE_WORKER_NAME:"vsn-builder-production"},
 ]) {
  const c=cloud();
  await assert.rejects(verifyCloudflareStagingBindings(env(extra),{
   fetchImpl:c.fetchImpl,
  }),/blocked/);
  assert.equal(c.calls.length,0);
 }
});
test("Reject absent secrets, wrong billing/env, nonsecret DATABASE_URL or missing Shopify binding",async()=>{
 const bad=[
  d=>d.secrets=[],
  d=>d.secrets[0].type="plain_text",
  d=>d.settings.bindings.find(x=>x.name==="APP_ENV").text="production",
  d=>d.settings.bindings.find(x=>x.name==="SHOPIFY_BILLING_TEST_MODE").text="false",
  d=>d.settings.bindings.find(x=>x.name==="NEON_PROJECT_ID").text="nameless-violet-68750490",
  d=>d.settings.bindings=d.settings.bindings.filter(x=>x.name!=="SCOPES"),
  d=>d.settings.bindings.find(x=>x.name==="VSN_WORKER_NAME").text="vsn-builder-production",
 ];
 for(const change of bad){
  const data=payload();change(data);
  await assert.rejects(verifyCloudflareStagingBindings(env(),{
   fetchImpl:cloud(data).fetchImpl,
  }),/blocked/);
 }
});
test("Cloudflare 401 or invalid bindings response never certifies readiness",async()=>{
 const c=cloud(payload(),401);
 await assert.rejects(verifyCloudflareStagingBindings(env(),{
  fetchImpl:c.fetchImpl,
 }),/blocked/);
 const c2=cloud({secrets:[],settings:{}});
 await assert.rejects(verifyCloudflareStagingBindings(env(),{
  fetchImpl:c2.fetchImpl,
 }),/blocked/);
});
