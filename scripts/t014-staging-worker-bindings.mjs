// T014/T019: NO-DEPLOY verification of Cloudflare's actual Staging bindings.
// Never log, return or persist a Cloudflare binding value or secret payload.
import {pathToFileURL} from "node:url";

export const WORKER="vsn-builder-staging";
export const PROJECT="shiny-violet-61219572";
const REPO="Vertex-Systems-Network/vsn-builder";
const SECRET_NAMES=Object.freeze(["DATABASE_URL","SHOPIFY_API_KEY","SHOPIFY_API_SECRET"]);
const PLAIN_VALUES=Object.freeze({
 APP_ENV:"staging",
 VSN_WORKER_NAME:WORKER,
 NEON_PROJECT_ID:PROJECT,
 SHOPIFY_BILLING_TEST_MODE:"true",
});
const FORBIDDEN=Object.freeze(["DIRECT_URL","CLOUDFLARE_API_TOKEN","SHOPIFY_DEVELOPMENT_CLIENT_ID"]);
const BINDING_TYPES=new Set(["plain_text"]);
const SECRET_TYPES=new Set(["secret_text","secret_key"]);

const code=(s)=>"T014_"+s;
function bindingList(value){
 return Array.isArray(value)?value:[];
}
function safeOrigin(value){
 try{
  const raw=String(value||"");
  const url=new URL(raw);
  return url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&
    url.pathname==="/"&&!url.search&&!url.hash&&
    url.hostname.includes(".") &&
    !/(?:^|\\.)(?:localhost|invalid|test)$/.test(url.hostname) &&
    !/(?:^|\\.)example\\.(?:com|org|net)$/.test(url.hostname) &&
    !/\\.(?:trycloudflare\\.com|ngrok-free\\.app|ngrok\\.io|loca\\.lt)$/.test(url.hostname);
 }catch{return false;}
}

export function auditStagingWorkerBindings({settings,secrets,subdomain}={}){
 const errors=[];
 const bindingRows=bindingList(settings?.bindings);
 const secretRows=bindingList(secrets);
 const nameMap=new Map();
 for(const item of bindingRows){
  if(typeof item?.name!=="string" || !item.name) {
   errors.push(code("INVALID_BINDING_METADATA"));continue;
  }
  nameMap.set(item.name,(nameMap.get(item.name)||0)+1);
 }
 for(const [name,count] of nameMap)if(count>1)
  errors.push(code("DUPLICATE_BINDING_"+name));
 const find=(name)=>bindingRows.find(x=>x?.name===name);
 const metadata=new Map(secretRows.map(item=>[item?.name,item?.type]));
 for(const name of SECRET_NAMES){
  const attached=find(name);
  const listed=metadata.get(name);
  // Both APIs must agree that the binding is encrypted, not plaintext.
  if(!attached || !SECRET_TYPES.has(attached.type) || !SECRET_TYPES.has(listed))
   errors.push(code("MISSING_ENCRYPTED_"+name));
 }
 for(const [name,value] of Object.entries(PLAIN_VALUES)){
  const item=find(name);
  if(!item || !BINDING_TYPES.has(item.type) || item.text!==value)
   errors.push(code("INVALID_TIER_"+name));
 }
 const origin=find("SHOPIFY_APP_URL");
 if(!origin || !BINDING_TYPES.has(origin.type) || !safeOrigin(origin.text))
   errors.push(code("NO_STABLE_STAGING_HTTPS_ORIGIN"));
 const scopes=find("SCOPES");
 if(!scopes || !BINDING_TYPES.has(scopes.type) ||
    !/^read_products,write_products,read_orders,write_metaobject_definitions,write_metaobjects$/.test(String(scopes.text||"")))
   errors.push(code("MISSING_APPROVED_SHOPIFY_SCOPES"));
 for(const name of FORBIDDEN)
  if(find(name)||metadata.has(name))errors.push(code("FORBIDDEN_WORKER_BINDING_"+name));
 // Ensure one layer cannot lie about the actual deployed bindings inventory.
 for(const item of secretRows)if(item?.name && !find(item.name))
  errors.push(code("UNPAIRED_SECRET_METADATA"));
 if(!settings || !secrets || !subdomain)
  errors.push(code("INCOMPLETE_CONTROL_PLANE_EVIDENCE"));
 // Keep the URL state separate from the staged bindings acceptance: public
 // publishing is T021 and MUST NOT be implicitly enabled by this probe.
 return {
  bindingReady:errors.length===0,
  errors:[...new Set(errors)],
  worker:WORKER,
  tier:"staging",
  requiredSecretCount:SECRET_NAMES.length,
  requiredVariableCount:Object.keys(PLAIN_VALUES).length+2,
  publicUrlEnabled:subdomain?.enabled===true,
  hostedOAuthVerified:false,
  developerBranchVerified:false,
  githubEnvironmentReviewersVerified:false,
 };
}

async function getCloudflare(url,token,fetcher){
 const response=await fetcher(url,{
  method:"GET",redirect:"error",
  headers:{Authorization:"Bearer "+token,Accept:"application/json"},
  signal:AbortSignal.timeout(10000),
 });
 if(!response?.ok)throw new Error(code("CLOUDFLARE_READ_UNAVAILABLE"));
 const json=await response.json();
 if(json?.success!==true || !Object.hasOwn(json,"result"))
  throw new Error(code("CLOUDFLARE_EVIDENCE_INVALID"));
 return json.result;
}
export async function verifyStagingWorkerBindings({
 token,accountId,fetcher=fetch,
}={}){
 if(!/^[0-9a-f]{32}$/i.test(String(accountId||"")))
   throw new Error(code("ACCOUNT_ID_INVALID"));
 if(typeof token!=="string"||!token.trim())
   throw new Error(code("READ_TOKEN_MISSING"));
 if(typeof fetcher!=="function")
   throw new Error(code("FETCH_UNAVAILABLE"));
 const base="https://api.cloudflare.com/client/v4/accounts/"+accountId+
  "/workers/scripts/"+WORKER;
 const suffixes=["/settings","/secrets","/subdomain"];
 const [settings,secrets,subdomain]=await Promise.all(
  suffixes.map(s=>getCloudflare(base+s,token,fetcher))
 );
 return auditStagingWorkerBindings({settings,secrets,subdomain});
}

async function main(){
 // Hard prerequisite evaluated BEFORE reading any token or making API calls.
 if(process.env.GITHUB_REPOSITORY!==REPO ||
    process.env.GITHUB_REF!=="refs/heads/development" ||
    process.env.GITHUB_REF_PROTECTED!=="true"){
  console.error("::error::"+code("UNPROTECTED_OR_WRONG_SOURCE_REF"));
  process.exitCode=1;
  return;
 }
 try{
  const proof=await verifyStagingWorkerBindings({
   token:process.env.CLOUDFLARE_API_TOKEN,
   accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
  });
  for(const err of proof.errors)console.error("::error::"+err);
  console.log("T014 Staging binding contract "+(proof.bindingReady?"PASS":"BLOCKED")+
   "; encrypted secrets required "+proof.requiredSecretCount+
   "; scoped variables required "+proof.requiredVariableCount+
   "; public Worker subdomain enabled "+proof.publicUrlEnabled+".");
  console.log("No secret or plain-text binding values exposed. Hosted Shopify E2E not certified.");
  if(!proof.bindingReady)process.exitCode=1;
 }catch(err){
  const name=String(err?.message||"");
  console.error("::error::"+(name.startsWith("T014_")?name:code("UNAVAILABLE")));
  process.exitCode=1;
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
