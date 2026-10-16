import test from "node:test";
import assert from "node:assert/strict";
import {verifyCloudflareStagingBindings} from "../scripts/phase4-staging-cloudflare-readiness.mjs";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";

const account="f63cf3af0868a5c8a0b26ebee5dd039f";
const secrets=["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET"];
function env(overrides={}){
 return {
  GITHUB_REPOSITORY:"Vertex-Systems-Network/vsn-builder",
  GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true",
  GITHUB_EVENT_NAME:"workflow_dispatch",APP_ENV:"staging",
  NEON_PROJECT_ID:"shiny-violet-61219572",
  CLOUDFLARE_WORKER_NAME:"vsn-builder-staging",
  CLOUDFLARE_ACCOUNT_ID:account,
  CLOUDFLARE_API_TOKEN:"synthetic-test-not-a-real-cloudflare-api-token",
  ...overrides,
 };
}
function payload(){
 return {
  secrets:secrets.map(name=>({name,type:"secret_text"})),
  settings:{bindings:[
   ...secrets.map(name=>({name,type:"secret_text"})),
   {name:"SHOPIFY_APP_URL",type:"plain_text",text:"https://vsn-builder-staging.vertexsystemsnetwork.workers.dev"},
   {name:"SCOPES",type:"plain_text",text:SHOPIFY_EXPECTED_SCOPES.join(",")},
   {name:"APP_ENV",type:"plain_text",text:"staging"},
   {name:"VSN_WORKER_NAME",type:"plain_text",text:"vsn-builder-staging"},
   {name:"NEON_PROJECT_ID",type:"plain_text",text:"shiny-violet-61219572"},
   {name:"SHOPIFY_BILLING_TEST_MODE",type:"plain_text",text:"true"},
  ]},
  subdomain:{enabled:false,previews_enabled:false},
 };
}
function cloud(data=payload(),status=200){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  const endpoint=new URL(url).pathname.split("/").at(-1);
  calls.push({endpoint,url,options:opts});
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"error");
  assert.equal(opts.headers.Authorization,"Bearer synthetic-test-not-a-real-cloudflare-api-token");
  assert.equal(new URL(url).origin,"https://api.cloudflare.com");
  assert.ok(url.includes("/accounts/"+account+"/workers/scripts/vsn-builder-staging/"));
  return {ok:status===200,status,async json(){
   return {success:status===200,result:data[endpoint]};
  }};
 };
 return {fetchImpl,calls};
}
test("real-looking Staging metadata succeeds via three canonical GETs only",async()=>{
 const c=cloud();
 const result=await verifyCloudflareStagingBindings(env(),{fetchImpl:c.fetchImpl});
 assert.equal(result.ready,true);
 assert.equal(result.publicUrlEnabled,false);
 assert.equal(result.hostedOAuthVerified,false);
 assert.equal(result.merchantReady,false);
 assert.deepEqual(c.calls.map(x=>x.endpoint).sort(),["secrets","settings","subdomain"]);
 assert(!JSON.stringify(result).includes("synthetic-test-not-a-real-cloudflare-api-token"));
 assert(!JSON.stringify(result).includes("SHOPIFY_API_SECRET"));
});
test("wrong repo, unprotected branch, PR event, tier or Cloudflare account refuse before API",async()=>{
 for(const overrides of [
  {GITHUB_REPOSITORY:"attacker/fork"},{GITHUB_REF_PROTECTED:"false"},
  {GITHUB_REF:"refs/heads/main"},{GITHUB_EVENT_NAME:"pull_request"},
  {APP_ENV:"production"},{NEON_PROJECT_ID:"nameless-violet-68750490"},
  {CLOUDFLARE_WORKER_NAME:"vsn-builder-production"},
  {CLOUDFLARE_ACCOUNT_ID:"a".repeat(32)},{CLOUDFLARE_API_TOKEN:""},
 ]) {
  const c=cloud();
  await assert.rejects(verifyCloudflareStagingBindings(env(overrides),{
   fetchImpl:c.fetchImpl,
  }),/T019_STAGING_WORKER_BINDINGS_UNVERIFIED/);
  assert.equal(c.calls.length,0);
 }
});
test("missing or plaintext Shopify API key and one-sided secret metadata always block",async()=>{
 const bad=[
  d=>d.secrets=[],
  d=>d.secrets.find(x=>x.name==="SHOPIFY_API_KEY").type="plain_text",
  d=>d.settings.bindings.find(x=>x.name==="SHOPIFY_API_KEY").type="plain_text",
  d=>d.settings.bindings.find(x=>x.name==="DATABASE_URL").type="plain_text",
  d=>d.settings.bindings=d.settings.bindings.filter(x=>x.name!=="SHOPIFY_API_SECRET"),
  d=>d.secrets=d.secrets.filter(x=>x.name!=="DATABASE_URL"),
  d=>d.secrets.push({name:"DATABASE_URL",type:"secret_text"}),
 ];
 for(const change of bad){
  const data=payload();change(data);
  await assert.rejects(verifyCloudflareStagingBindings(env(),{
   fetchImpl:cloud(data).fetchImpl,
  }),/T019_STAGING_WORKER_BINDINGS_UNVERIFIED/);
 }
});
test("wrong approved scopes, tier vars, origins or leaked privileged settings fail closed",async()=>{
 const bad=[
  d=>d.settings.bindings.find(x=>x.name==="SCOPES").text="read_products",
  d=>d.settings.bindings.find(x=>x.name==="SHOPIFY_APP_URL").text="http://localhost:3000",
  d=>d.settings.bindings.find(x=>x.name==="APP_ENV").text="production",
  d=>d.settings.bindings.find(x=>x.name==="SHOPIFY_BILLING_TEST_MODE").text="false",
  d=>d.settings.bindings.find(x=>x.name==="NEON_PROJECT_ID").text="nameless-violet-68750490",
  d=>d.settings.bindings.push({name:"DIRECT_URL",type:"secret_text"}),
  d=>d.settings.bindings.push({name:"CLOUDFLARE_API_TOKEN",type:"plain_text",text:"unsafe"}),
 ];
 for(const change of bad){
  const data=payload();change(data);
  await assert.rejects(verifyCloudflareStagingBindings(env(),{
   fetchImpl:cloud(data).fetchImpl,
  }),/T019_STAGING_WORKER_BINDINGS_UNVERIFIED/);
 }
});
test("provider error and partial control-plane response block without exposing response",async()=>{
 await assert.rejects(verifyCloudflareStagingBindings(env(),{
  fetchImpl:cloud(payload(),401).fetchImpl,
 }),/T019_STAGING_WORKER_BINDINGS_UNVERIFIED/);
 await assert.rejects(verifyCloudflareStagingBindings(env(),{
  fetchImpl:cloud({settings:{bindings:[]},secrets:[],subdomain:null}).fetchImpl,
 }),/T019_STAGING_WORKER_BINDINGS_UNVERIFIED/);
});
