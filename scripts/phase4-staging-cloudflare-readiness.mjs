// T019: a single canonical, read-only Cloudflare Worker binding attestation.
// Unlike the old Phase 4 inventory, NEVER accept a plaintext Shopify API key,
// one-sided Cloudflare secret metadata, wrong scopes or an unverified origin.
// No Worker secret mutation, Staging deployment, Neon SQL or Live access.
import {verifyStagingWorkerBindings,WORKER,PROJECT} from "./t014-staging-worker-bindings.mjs";
const REPO="Vertex-Systems-Network/vsn-builder";
const ACCOUNT="f63cf3af0868a5c8a0b26ebee5dd039f";

const blocked=()=>{
 const error=new Error("T019_STAGING_WORKER_BINDINGS_UNVERIFIED");
 error.code="VSN_STAGING_CLOUDFLARE_BINDINGS_NOT_VERIFIED";
 return error;
};

export async function verifyCloudflareStagingBindings(env={},{
 fetchImpl=fetch,signal=AbortSignal.timeout(10000),
}={}) {
 // Validate protected/manual ref and source-specific staging identifiers
 // BEFORE looking at scoped Cloudflare credentials or sending GET requests.
 if(env.GITHUB_REPOSITORY!==REPO ||
    env.GITHUB_REF!=="refs/heads/development" ||
    env.GITHUB_REF_PROTECTED!=="true" ||
    env.GITHUB_EVENT_NAME!=="workflow_dispatch" ||
    env.APP_ENV!=="staging" ||
    env.CLOUDFLARE_WORKER_NAME!==WORKER ||
    env.NEON_PROJECT_ID!==PROJECT)
   throw blocked();
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||"").toLowerCase();
 const token=env.CLOUDFLARE_API_TOKEN;
 if(account!==ACCOUNT || typeof token!=="string" || token.length<12 ||
    typeof fetchImpl!=="function")
   throw blocked();
 try {
  // Canonical GET-only audit checks BOTH settings/secrets inventories,
  // encrypts all three sensitive bindings, validates approved scopes,
  // Staging tier variables and stable HTTPS origin.
  const proof=await verifyStagingWorkerBindings({
   token,accountId:account,
   fetcher:(url,options)=>fetchImpl(url,{...options,signal}),
  });
  if(!proof.bindingReady)throw blocked();
  return {
   ready:true,worker:WORKER,tier:"staging",
   secretPresenceVerified:true,configPresenceVerified:true,
   publicUrlEnabled:proof.publicUrlEnabled,
   hostedOAuthVerified:false,merchantReady:false,
  };
 }catch{throw blocked()}
}

if(process.argv[1]?.endsWith("/phase4-staging-cloudflare-readiness.mjs")){
 try{
  await verifyCloudflareStagingBindings(process.env);
  console.log("T019 PASS exact Cloudflare Staging binding metadata; no Worker deploy or secret values");
  console.log("Real hosted Shopify OAuth, merchant readiness and Staging release remain separately gated.");
 }catch{
  console.error("::error::T019_STAGING_WORKER_BINDINGS_UNVERIFIED");
  process.exitCode=1;
 }
}
