// Phase 4 Staging-only Cloudflare binding inventory. Read-only GET calls.
// This is NOT a deployment, a secrets write, or an acceptance of Shopify OAuth.
import targets from "../config/deployment/environments.json" with { type:"json" };
const stage=targets.staging;
const REQUIRED_SECRET_NAMES=["DATABASE_URL","SHOPIFY_API_SECRET"];
const REQUIRED_CONFIG_NAMES=[
  "SHOPIFY_API_KEY","SHOPIFY_APP_URL",
  "SHOPIFY_PRODUCTION_CLIENT_ID","SCOPES",
];
const EXPECTED_CONFIG={
  APP_ENV:"staging",
  VSN_WORKER_NAME:stage.cloudflare_worker,
  NEON_PROJECT_ID:stage.neon_project_id,
  SHOPIFY_BILLING_TEST_MODE:"true",
};
function blocked(message) {
 const e=new Error("Staging Cloudflare observation blocked: "+message);
 e.code="VSN_STAGING_CLOUDFLARE_BINDINGS_NOT_VERIFIED";
 return e;
}
async function getJson(request,token,fetchImpl,signal){
 const response=await fetchImpl(request,{
   method:"GET",headers:{authorization:"Bearer "+token,accept:"application/json"},
   redirect:"error",signal,
 });
 if(!response?.ok)throw blocked("Cloudflare Worker metadata GET request failed");
 const value=await response.json();
 if(value?.success!==true)throw blocked("Cloudflare Worker metadata response rejected");
 return value.result;
}
export async function verifyCloudflareStagingBindings(env={},{
 fetchImpl=fetch,signal=AbortSignal.timeout(10000),
}={}){
 if(env.GITHUB_REF!=="refs/heads/development" ||
    env.GITHUB_REF_PROTECTED!=="true" ||
    env.GITHUB_EVENT_NAME!=="workflow_dispatch")
    throw blocked("protected manual Staging branch context missing");
 if(env.APP_ENV!=="staging" ||
    env.CLOUDFLARE_WORKER_NAME!==stage.cloudflare_worker ||
    env.NEON_PROJECT_ID!==stage.neon_project_id)
    throw blocked("Staging Worker/Neon tier identity mismatch");
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||"").trim();
 const token=String(env.CLOUDFLARE_API_TOKEN||"");
 if(!/^[0-9a-f]{32}$/i.test(account) || token.length<12)
    throw blocked("account identity or scoped read token missing");
 const path="https://api.cloudflare.com/client/v4/accounts/"+
   account+"/workers/scripts/"+stage.cloudflare_worker;
 try {
  const [secrets,settings]=await Promise.all([
    getJson(path+"/secrets",token,fetchImpl,signal),
    getJson(path+"/settings",token,fetchImpl,signal),
  ]);
  if(!Array.isArray(secrets) || !Array.isArray(settings?.bindings))
    throw blocked("Worker secret/binding inventory absent or malformed");
  // Read names and binding types ONLY, never reveal or log secret values.
  const secretNames=new Set(secrets.filter(s=>s?.type==="secret_text" &&
    typeof s.name==="string").map(s=>s.name));
  const bindings=new Map(settings.bindings.filter(x=>
    x && typeof x.name==="string" && typeof x.type==="string"
  ).map(x=>[x.name,x]));
  for(const key of REQUIRED_SECRET_NAMES){
    if(!secretNames.has(key) &&
       bindings.get(key)?.type!=="secret_text")
      throw blocked("required Staging Worker secret "+key+" is missing");
  }
  for(const key of REQUIRED_CONFIG_NAMES){
    if(!bindings.has(key) && !secretNames.has(key))
      throw blocked("required Shopify configuration binding "+key+" is missing");
  }
  for(const [key,expected] of Object.entries(EXPECTED_CONFIG)){
    const setting=bindings.get(key);
    if(setting?.type!=="plain_text" || setting.text!==expected)
      throw blocked("Staging Worker tier variable "+key+" is not verified");
  }
  return {ready:true,worker:stage.cloudflare_worker,
    tier:"staging",secretPresenceVerified:true,
    configPresenceVerified:true};
 }catch(error){
  if(error?.code==="VSN_STAGING_CLOUDFLARE_BINDINGS_NOT_VERIFIED")throw error;
  throw blocked("Cloudflare API verification unavailable");
 }
}
if(process.argv[1]?.endsWith("/phase4-staging-cloudflare-readiness.mjs")){
 try {
  await verifyCloudflareStagingBindings(process.env);
  console.log("PASS real Staging Worker scoped secrets/settings metadata (no deploy or secret values)");
 }catch(e){
  console.error("BLOCKED "+(e?.code==="VSN_STAGING_CLOUDFLARE_BINDINGS_NOT_VERIFIED"?
   e.message:"Cloudflare metadata unverifiable"));
  process.exitCode=1;
 }
}
