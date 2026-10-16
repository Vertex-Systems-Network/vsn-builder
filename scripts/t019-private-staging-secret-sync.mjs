// T019: one atomic encrypted binding update to PRIVATE Staging Worker only.
// Trigger only from an audited, protected development push with trusted
// cloudflare-staging GitHub Environment secrets. No worker deployment or routes.
// Do not log secret contents, request bodies, provider errors or URLs.
import {pathToFileURL} from "node:url";
import {SHOPIFY_EXPECTED_SCOPES,normalizeShopifyScopes} from "../app/config/shopifyIntegration.js";

const REPO="Vertex-Systems-Network/vsn-builder";
const ACCOUNT="f63cf3af0868a5c8a0b26ebee5dd039f";
const WORKER="vsn-builder-staging";
const NEON="shiny-violet-61219572";
const ID="0ecd6b7151485b41ea65924fe827806a";
const HOST="ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech";
const STAGING_ORIGIN="https://vsn-builder-staging.vertexsystemsnetwork.workers.dev";
const PREFIX=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}`;
const SECRET_NAMES=Object.freeze(["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET"]);
const EXPECTED=Object.freeze({
 APP_ENV:"staging",VSN_WORKER_NAME:WORKER,NEON_PROJECT_ID:NEON,
 SHOPIFY_BILLING_TEST_MODE:"true",SHOPIFY_APP_URL:STAGING_ORIGIN,
});
const CODE="T019_STAGING_PRIVATE_SECRET_SYNC_BLOCKED";
const fail=()=>{const error=new Error(CODE);error.code=CODE;return error};

function authContext(env){
 if(env.GITHUB_REPOSITORY!==REPO || env.GITHUB_REF!=="refs/heads/development" ||
    env.GITHUB_REF_PROTECTED!=="true" || env.GITHUB_EVENT_NAME!=="push" ||
    env.APP_ENV!=="staging" || env.NEON_PROJECT_ID!==NEON ||
    env.CLOUDFLARE_ACCOUNT_ID?.toLowerCase()!==ACCOUNT ||
    typeof env.CLOUDFLARE_API_TOKEN!=="string" ||
    env.CLOUDFLARE_API_TOKEN.length<12 ||
    typeof env.SHOPIFY_API_KEY!=="string" || env.SHOPIFY_API_KEY!==ID ||
    !env.SHOPIFY_API_SECRET || !env.DATABASE_URL)throw fail();
 try{
  const db=new URL(env.DATABASE_URL);
  if(!["postgresql:","postgres:"].includes(db.protocol) ||
     db.hostname!==HOST.replace(".","-pooler.") ||
     (db.port && db.port!=="5432") ||
     !db.username || !db.password || !db.pathname || db.pathname==="/" ||
     db.searchParams.get("sslmode")!=="require" || db.hash ||
     db.searchParams.getAll("sslmode").length!==1)throw fail();
 }catch{throw fail()}
 return true;
}
const secretShape=x=>x&&typeof x.name==="string"&&
 (x.type==="secret_text"||x.type==="secret_key");
function inventory(settings,secrets,subdomain){
 if(!Array.isArray(settings?.bindings)||!Array.isArray(secrets)||
    subdomain?.enabled!==false || subdomain?.previews_enabled!==false)
   throw fail();
 const items=settings.bindings;
 const map=new Map();
 for(const item of items) {
  if(!item?.name || map.has(item.name))throw fail();
  map.set(item.name,item);
 }
 for(const [name,text] of Object.entries(EXPECTED)) {
  const item=map.get(name);
  if(item?.type!=="plain_text" || item.text!==text)throw fail();
 }
 const scopes=map.get("SCOPES");
 if(scopes?.type!=="plain_text" ||
    normalizeShopifyScopes(scopes.text).join(",")!==
    normalizeShopifyScopes(SHOPIFY_EXPECTED_SCOPES).join(","))
   throw fail();
 const allowed=new Set([...Object.keys(EXPECTED),"SCOPES",...SECRET_NAMES]);
 if([...map.keys()].some(k=>!allowed.has(k)) ||
    secrets.some(s=>!secretShape(s) || !SECRET_NAMES.includes(s.name)))
   throw fail();
 const secretMap=new Map();
 for(const entry of secrets){
  if(secretMap.has(entry.name))throw fail();
  secretMap.set(entry.name,entry.type);
 }
 const count=SECRET_NAMES.filter(name=>{
  const bound=map.get(name);
  const listed=secretMap.get(name);
  if(!bound&&!listed)return false;
  if(bound?.type!=="secret_text"||listed!=="secret_text")throw fail();
  return true;
 }).length;
 return count;
}
async function call(fetchImpl,suffix,method,token,body){
 const headers={authorization:"Bearer "+token,accept:"application/json"};
 if(body)headers["content-type"]="application/merge-patch+json";
 let response;
 try{
  response=await fetchImpl(PREFIX+suffix,{
   method,headers,redirect:"error",signal:AbortSignal.timeout(12000),
   ...(body?{body:JSON.stringify(body)}:{}),
  });
  if(!response.ok)throw fail();
  const doc=await response.json();
  if(doc?.success!==true)throw fail();
  return doc.result;
 }catch{throw fail()}
}
async function readSnapshot(fetchImpl,token){
 const [settings,secrets,subdomain,deployments]=await Promise.all([
  call(fetchImpl,"/settings","GET",token),
  call(fetchImpl,"/secrets","GET",token),
  call(fetchImpl,"/subdomain","GET",token),
  call(fetchImpl,"/deployments","GET",token),
 ]);
 const list=Array.isArray(deployments?.deployments)?deployments.deployments:
  Array.isArray(deployments)?deployments:null;
 if(!list || !list[0]?.id)throw fail();
 return {count:inventory(settings,secrets,subdomain),deploymentId:list[0].id};
}
export async function syncPrivateStagingSecrets(env={}, {fetchImpl=fetch}={}){
 // No provider request OR sensitive-value handling on an unprotected ref.
 authContext(env);
 if(typeof fetchImpl!=="function")throw fail();
 const token=env.CLOUDFLARE_API_TOKEN;
 const before=await readSnapshot(fetchImpl,token);
 if(before.count!==0 && before.count!==SECRET_NAMES.length)throw fail();
 let updated=false;
 if(before.count===0){
  const payload={secrets:Object.fromEntries(SECRET_NAMES.map(name=>[
   name,{name,type:"secret_text",text:env[name]},
  ]))};
  // A single Cloudflare Worker version; no deployment API is called.
  await call(fetchImpl,"/secrets-bulk","PATCH",token,payload);
  updated=true;
 }
 const after=await readSnapshot(fetchImpl,token);
 if(after.count!==SECRET_NAMES.length ||
    after.deploymentId!==before.deploymentId)throw fail();
 return {ready:true,worker:WORKER,secretCount:after.count,updated,
  activeDeploymentUnchanged:true,publicRouteEnabled:false,
  merchantOAuthVerified:false,productionTouched:false};
}
async function main(){
 try{
  const proof=await syncPrivateStagingSecrets(process.env);
  console.log("T019 private Staging Worker secret metadata: PASS; encrypted bindings="+proof.secretCount);
  console.log("Existing Worker deployment unchanged; public subdomain remains disabled; merchant OAuth and migration not certified.");
 }catch{
  console.error("::error::"+CODE);
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
