import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {SHOPIFY_EXPECTED_SCOPES} from "../app/config/shopifyIntegration.js";
import {WORKER,PROJECT,auditStagingWorkerBindings,verifyStagingWorkerBindings} from "../scripts/t014-staging-worker-bindings.mjs";

const secretNames=["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET"];
const valid=()=>({
 settings:{bindings:[
  ...secretNames.map(name=>({name,type:"secret_text"})),
  {name:"APP_ENV",type:"plain_text",text:"staging"},
  {name:"VSN_WORKER_NAME",type:"plain_text",text:WORKER},
  {name:"NEON_PROJECT_ID",type:"plain_text",text:PROJECT},
  {name:"SHOPIFY_BILLING_TEST_MODE",type:"plain_text",text:"true"},
  {name:"SHOPIFY_APP_URL",type:"plain_text",text:"https://staging.vertexsystemsnetwork.com"},
  {name:"SCOPES",type:"plain_text",text:SHOPIFY_EXPECTED_SCOPES.join(",")},
 ]},
 secrets:secretNames.map(name=>({name,type:"secret_text"})),
 subdomain:{enabled:false,previews_enabled:false},
});
const check=x=>auditStagingWorkerBindings(x);

test("real binding metadata can pass while disabled public route remains uncertified",()=>{
 const result=check(valid());
 assert.deepEqual(result.errors,[]);
 assert.equal(result.bindingReady,true);
 assert.equal(result.publicUrlEnabled,false);
 assert.equal(result.hostedOAuthVerified,false);
 assert.equal(result.developerBranchVerified,false);
 assert.equal(result.githubEnvironmentReviewersVerified,false);
 assert.equal(result.requiredSecretCount,3);
 assert.equal(result.requiredVariableCount,6);
 assert.doesNotMatch(JSON.stringify(result),/staging\.vertexsystemsnetwork\.com|SHOPIFY_API_SECRET:|password/i);
});

test("currently observed empty Staging Cloudflare settings and secrets fail closed",()=>{
 const proof=check({settings:{bindings:[]},secrets:[],subdomain:{enabled:false}});
 assert.equal(proof.bindingReady,false);
 assert(proof.errors.includes("T014_MISSING_ENCRYPTED_DATABASE_URL"));
 assert(proof.errors.includes("T014_INVALID_TIER_APP_ENV"));
 assert(proof.errors.includes("T014_NO_STABLE_STAGING_HTTPS_ORIGIN"));
 assert(proof.errors.includes("T014_MISSING_APPROVED_SHOPIFY_SCOPES"));
});

test("Cloudflare plain_text credentials cannot masquerade as secret_text",()=>{
 const x=valid();
 x.settings.bindings.find(z=>z.name==="DATABASE_URL").type="plain_text";
 x.settings.bindings.find(z=>z.name==="DATABASE_URL").text="postgresql://PRIVATE@wronghost/";
 assert(check(x).errors.includes("T014_MISSING_ENCRYPTED_DATABASE_URL"));
 assert.doesNotMatch(JSON.stringify(check(x)),/postgresql:|PRIVATE/);
 const y=valid();
 y.secrets=y.secrets.filter(z=>z.name!=="SHOPIFY_API_SECRET");
 assert(check(y).errors.includes("T014_MISSING_ENCRYPTED_SHOPIFY_API_SECRET"));
});

test("cross-environment variables and leaked admin/migration credentials fail closed",()=>{
 for(const [key,text] of [
  ["APP_ENV","production"],
  ["VSN_WORKER_NAME","vsn-builder-production"],
  ["NEON_PROJECT_ID","nameless-violet-68750490"],
  ["SHOPIFY_BILLING_TEST_MODE","false"],
 ]){
  const a=valid();
  a.settings.bindings.find(z=>z.name===key).text=text;
  assert(check(a).errors.includes("T014_INVALID_TIER_"+key));
 }
 for(const name of ["DIRECT_URL","CLOUDFLARE_API_TOKEN","SHOPIFY_DEVELOPMENT_CLIENT_ID"]){
  const a=valid();a.settings.bindings.push({name,type:"secret_text"});
  assert(check(a).errors.includes("T014_FORBIDDEN_WORKER_BINDING_"+name));
 }
});

test("wrong scopes, duplicate metadata and invalid public origins fail closed",()=>{
 for(const bad of ["","read_products","read_products,write_products",SHOPIFY_EXPECTED_SCOPES.join(",")+",unauthorized"]){
  const a=valid();a.settings.bindings.find(z=>z.name==="SCOPES").text=bad;
  assert(check(a).errors.includes("T014_MISSING_APPROVED_SHOPIFY_SCOPES"));
 }
 for(const url of [
  "http://staging.vertexsystemsnetwork.com",
  "https://builder.example.com",
  "https://foo.trycloudflare.com",
  "https://stage.ngrok-free.app",
  "https://staging.vertexsystemsnetwork.com/callback",
  "https://localhost",
 ]){
  const a=valid();a.settings.bindings.find(z=>z.name==="SHOPIFY_APP_URL").text=url;
  assert(check(a).errors.includes("T014_NO_STABLE_STAGING_HTTPS_ORIGIN"),url);
 }
 const d=valid();d.settings.bindings.push({name:"SCOPES",type:"plain_text",text:"none"});
 assert(check(d).errors.includes("T014_DUPLICATE_BINDING_METADATA"));
 const unpaired=valid();unpaired.secrets.push({name:"MISSING",type:"secret_text"});
 assert(check(unpaired).errors.includes("T014_UNPAIRED_SECRET_METADATA"));
});

test("Cloudflare metadata verification makes only three GET requests and returns no values",async()=>{
 const accountId="a".repeat(32);
 const fakeToken="super-secret-synthetic-must-never-log";
 const expected=valid();
 const urls=[];
 const fetcher=async(url,options)=>{
  urls.push({url,method:options.method,auth:options.headers.Authorization,
    redirect:options.redirect});
  let result=url.endsWith("/settings")?expected.settings:
    url.endsWith("/secrets")?expected.secrets:expected.subdomain;
  return {ok:true,json:async()=>({success:true,result})};
 };
 const result=await verifyStagingWorkerBindings({token:fakeToken,accountId,fetcher});
 assert.equal(result.bindingReady,true);
 assert.equal(urls.length,3);
 assert(urls.every(x=>x.url.startsWith("https://api.cloudflare.com/client/v4/accounts/"+accountId+"/workers/scripts/"+WORKER)));
 assert(urls.every(x=>x.method==="GET"&&x.redirect==="error"&&x.auth==="Bearer "+fakeToken));
 assert.doesNotMatch(JSON.stringify(result),/super-secret|staging\.vertexsystemsnetwork\.com/);
});

test("API errors, missing token or malformed account always fail closed without exposing responses",async()=>{
 await assert.rejects(verifyStagingWorkerBindings({token:"private",accountId:"not-an-id"}),
  /T014_ACCOUNT_ID_INVALID/);
 await assert.rejects(verifyStagingWorkerBindings({token:"",accountId:"a".repeat(32)}),
  /T014_READ_TOKEN_MISSING/);
 const bad=async()=>({ok:false,status:403,json:async()=>({success:false,errors:[{message:"secrets!"}]})});
 await assert.rejects(verifyStagingWorkerBindings({token:"private",accountId:"a".repeat(32),fetcher:bad}),
  e=>e.message==="T014_CLOUDFLARE_READ_UNAVAILABLE"&&!e.message.includes("private"));
});

test("unprotected or cross-repository manual CI never reads a Cloudflare API token",()=>{
 for(const env of [
  {GITHUB_REPOSITORY:"Vertex-Systems-Network/vsn-builder",GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"false"},
  {GITHUB_REPOSITORY:"Vertex-Systems-Network/vsn-builder",GITHUB_REF:"refs/heads/main",GITHUB_REF_PROTECTED:"true"},
  {GITHUB_REPOSITORY:"unknown/other",GITHUB_REF:"refs/heads/development",GITHUB_REF_PROTECTED:"true"},
 ]){
  const out=spawnSync(process.execPath,["scripts/t014-staging-worker-bindings.mjs"],{
   encoding:"utf8",timeout:3000,
   env:{PATH:process.env.PATH,...env,CLOUDFLARE_API_TOKEN:"private-should-not-print"}
  });
  assert.equal(out.status,1);
  assert.match(out.stderr,/T014_UNPROTECTED_OR_WRONG_SOURCE_REF/);
  assert.doesNotMatch(out.stdout+out.stderr,/private-should-not-print/);
 }
});
